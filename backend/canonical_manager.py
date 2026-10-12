"""
Entity Resolution Platform — Phase 3 Canonical Product & Storage Manager
========================================================================
Implements:
  - Task 2: Canonical Product Data Model with conflict tracking & validation
  - Task 3: Canonical Product CRUD operations & source listing access
  - Task 4: Transactional Safe Merge with conflict detection & cycle prevention
  - Task 5: Safe Split and Undo Merge operations
  - Task 6: Source Listing Management (view, attach, detach, reassign)
  - Task 7: Unified Audit History with snapshots and correlation IDs
  - Task 8: Storage Integrity Service with journaling, backups & recovery
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Time & ID Helpers
# ---------------------------------------------------------------------------
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_id(prefix: str = "can") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def make_tx_id() -> str:
    return f"tx-{uuid.uuid4().hex[:10]}"


# ---------------------------------------------------------------------------
# Normalization Helpers (matching main.py pipeline)
# ---------------------------------------------------------------------------
def normalize_text(text: Any) -> str:
    if text is None:
        return ""
    s = str(text).strip()
    s = unicodedata_normalize(s)
    import re
    s = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", s)
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def unicodedata_normalize(s: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFKC", s)


def normalize_brand(brand: Any) -> str:
    from main import BRAND_ALIASES, normalize_brand as main_norm_brand
    try:
        return main_norm_brand(brand)
    except Exception:
        if not brand:
            return "Unknown"
        b = normalize_text(brand)
        return BRAND_ALIASES.get(b, str(brand).strip())


def normalize_identifier(raw: Any) -> str:
    import re
    if raw is None:
        return ""
    s = str(raw).strip()
    s = re.sub(r"^(upc|gtin|ean)[:\s-]*", "", s, flags=re.IGNORECASE).strip()
    digits = re.sub(r"\D", "", s)
    return digits if len(digits) >= 8 else s


# ===========================================================================
# TASK 8 — JSON Storage Integrity Service
# ===========================================================================

class StorageIntegrityManager:
    """
    Coordinates changes across canonical products, source listings, clusters,
    match decisions, and audit logs.
    
    Provides:
      - RLock protection against concurrent threads
      - Atomic write via tmp file + fsync + os.replace
      - Transaction journaling for multi-entity operations (data/journal.json)
      - Pre-mutation backup snapshots in data/backups/
      - Crash recovery on initialization
      - Monotonic revision counters to prevent stale overwrites
    """

    def __init__(self, data_dir: Path, state_file: Path, lock: threading.RLock):
        self.data_dir = data_dir
        self.state_file = state_file
        self.lock = lock
        self.backups_dir = data_dir / "backups"
        self.journal_file = data_dir / "journal.json"
        
        self.backups_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Automatic crash recovery on startup
        self.recover_interrupted_transactions()

    def load_state(self) -> dict[str, Any]:
        with self.lock:
            if not self.state_file.exists():
                return {}
            try:
                with self.state_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                if not isinstance(data, dict):
                    return {}
                return data
            except (json.JSONDecodeError, OSError) as exc:
                raise HTTPException(
                    status_code=500, detail=f"Storage read failure: {exc}"
                ) from exc

    def save_state_atomic(
        self,
        state: dict[str, Any],
        expected_revision: Optional[int] = None
    ) -> dict[str, Any]:
        """
        Atomically saves state dictionary with fsync and revision increment.
        Validates structure before writing.
        """
        with self.lock:
            # Check revision if provided to prevent stale overwrites
            current_revision = int(state.get("_revision", 0))
            if expected_revision is not None and expected_revision != current_revision:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"State conflict: Expected revision {expected_revision}, "
                        f"but storage is at revision {current_revision}. Refresh and retry."
                    ),
                )

            # Validate basic container types
            for key in ("products", "canonicalProducts", "matchPairs", "duplicateClusters", "auditLogs"):
                if key in state and not isinstance(state[key], list):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Storage validation failed: '{key}' must be a list."
                    )

            state["_revision"] = current_revision + 1
            state["_lastUpdated"] = utc_now()

            tmp_file = self.state_file.with_suffix(f".tmp.{uuid.uuid4().hex[:8]}")
            try:
                with tmp_file.open("w", encoding="utf-8") as f:
                    json.dump(state, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp_file, self.state_file)
            except OSError as exc:
                if tmp_file.exists():
                    try:
                        tmp_file.unlink()
                    except OSError:
                        pass
                raise HTTPException(
                    status_code=500, detail=f"Atomic write failed: {exc}"
                ) from exc

            return {
                "saved": True,
                "revision": state["_revision"],
                "updatedAt": state["_lastUpdated"]
            }

    def create_backup_snapshot(self, state: dict[str, Any], tx_id: str) -> Path:
        """Creates a timestamped snapshot of current state before a mutation."""
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = self.backups_dir / f"backup_{ts}_{tx_id}.json"
        with self.lock:
            try:
                with backup_path.open("w", encoding="utf-8") as f:
                    json.dump(state, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
            except OSError as exc:
                raise HTTPException(
                    status_code=500, detail=f"Could not create pre-mutation backup: {exc}"
                ) from exc

            # Keep only the latest 20 backup files
            self._prune_backups(keep=20)
            return backup_path

    def _prune_backups(self, keep: int = 20) -> None:
        try:
            files = sorted(self.backups_dir.glob("backup_*.json"), key=os.path.getmtime)
            if len(files) > keep:
                for old in files[:-keep]:
                    try:
                        old.unlink()
                    except OSError:
                        pass
        except Exception:
            pass

    def start_transaction_journal(self, entry: dict[str, Any]) -> None:
        with self.lock:
            journal = self._read_journal()
            entry["status"] = "in_progress"
            journal.insert(0, entry)
            self._write_journal(journal)

    def commit_transaction_journal(self, tx_id: str) -> None:
        with self.lock:
            journal = self._read_journal()
            for entry in journal:
                if entry.get("txId") == tx_id:
                    entry["status"] = "committed"
                    entry["committedAt"] = utc_now()
                    break
            self._write_journal(journal)

    def rollback_transaction_journal(self, tx_id: str, reason: str = "") -> None:
        with self.lock:
            journal = self._read_journal()
            for entry in journal:
                if entry.get("txId") == tx_id:
                    entry["status"] = "rolled_back"
                    entry["rollbackReason"] = reason
                    break
            self._write_journal(journal)

    def record_journal(self, entry: dict[str, Any]) -> None:
        tx_id = entry.get("txId")
        with self.lock:
            journal = self._read_journal()
            if tx_id:
                for idx, existing in enumerate(journal):
                    if existing.get("txId") == tx_id:
                        journal[idx] = {**existing, **entry}
                        self._write_journal(journal)
                        return
            journal.insert(0, entry)
            self._write_journal(journal)

    def _write_journal(self, journal: list[dict[str, Any]]) -> None:
        journal = journal[:50]
        tmp = self.journal_file.with_suffix(f".tmp.{uuid.uuid4().hex[:6]}")
        try:
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(journal, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, self.journal_file)
        except OSError:
            if tmp.exists():
                try:
                    tmp.unlink()
                except OSError:
                    pass

    def _read_journal(self) -> list[dict[str, Any]]:
        if not self.journal_file.exists():
            return []
        try:
            with self.journal_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def recover_interrupted_transactions(self) -> None:
        """
        Scans journal for 'in_progress' multi-file mutations and restores
        from pre-mutation backup snapshot if one was interrupted.
        """
        with self.lock:
            journal = self._read_journal()
            recovered = False
            for entry in journal:
                if entry.get("status") == "in_progress":
                    backup_file = entry.get("backupFile")
                    tx_id = entry.get("txId", "unknown")
                    if backup_file and Path(backup_file).exists():
                        try:
                            with open(backup_file, "r", encoding="utf-8") as f:
                                restored_state = json.load(f)
                            # Roll back state
                            tmp = self.state_file.with_suffix(".tmp.recovered")
                            with tmp.open("w", encoding="utf-8") as f:
                                json.dump(restored_state, f, ensure_ascii=False, indent=2)
                                f.flush()
                                os.fsync(f.fileno())
                            os.replace(tmp, self.state_file)
                            entry["status"] = "rolled_back"
                            entry["recoveredAt"] = utc_now()
                            recovered = True
                        except Exception:
                            entry["status"] = "failed_recovery"
                    else:
                        entry["status"] = "abandoned"
            if recovered:
                self.record_journal_full(journal)

    def record_journal_full(self, journal: list[dict[str, Any]]) -> None:
        with self.lock:
            tmp = self.journal_file.with_suffix(".tmp")
            try:
                with tmp.open("w", encoding="utf-8") as f:
                    json.dump(journal, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, self.journal_file)
            except OSError:
                if tmp.exists():
                    tmp.unlink()


# ===========================================================================
# Pydantic Schemas for Canonical Operations
# ===========================================================================

class CanonicalProductCreate(BaseModel):
    title: str = Field(min_length=1)
    brand: Optional[str] = "Unknown"
    category: Optional[str] = "Uncategorized"
    subCategory: Optional[str] = ""
    modelNumber: Optional[str] = ""
    upcOrGtin: Optional[str] = ""
    attributes: dict[str, str] = Field(default_factory=dict)
    sourceProductIds: list[str] = Field(default_factory=list)
    price: float = 0.0
    currency: str = "₹"
    imageUrl: str = ""
    reviewer: str = "unauthenticated_reviewer"
    reason: str = "Manual canonical product creation"

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Title must be a non-empty string.")
        return v.strip()


class CanonicalProductUpdate(BaseModel):
    title: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    subCategory: Optional[str] = None
    modelNumber: Optional[str] = None
    upcOrGtin: Optional[str] = None
    attributes: Optional[dict[str, str]] = None
    price: Optional[float] = None
    imageUrl: Optional[str] = None
    status: Optional[str] = None  # 'active' | 'archived'
    version: Optional[int] = None
    reviewer: str = "unauthenticated_reviewer"
    reason: str = "Canonical product update"


class CanonicalMergeRequest(BaseModel):
    survivingCanonicalId: str
    mergedCanonicalIds: list[str] = Field(min_length=1)
    confirmConflicts: bool = False
    reviewer: str = "unauthenticated_reviewer"
    reason: str = ""


class CanonicalSplitRequest(BaseModel):
    sourceProductIds: list[str] = Field(min_length=1)
    newCanonicalTitle: Optional[str] = None
    destinationCanonicalId: Optional[str] = None
    reviewer: str = "unauthenticated_reviewer"
    reason: str = ""


class CanonicalUndoMergeRequest(BaseModel):
    mergedCanonicalId: Optional[str] = None
    reviewer: str = "unauthenticated_reviewer"
    reason: str = "Undo previous entity merge"


class SourceAttachRequest(BaseModel):
    sourceProductId: str
    reviewer: str = "unauthenticated_reviewer"
    reason: str = "Manual source listing attachment"


class SourceDetachRequest(BaseModel):
    sourceProductId: str
    reviewer: str = "unauthenticated_reviewer"
    reason: str = "Manual source listing detachment"


# ===========================================================================
# TASK 2 & 3 & 4 & 5 & 6 & 7 — Canonical Operations Manager
# ===========================================================================

class CanonicalManager:
    """
    Manages Canonical Products lifecycle, safe transactional merges,
    splits, source listing assignments, and comprehensive audit history.
    """

    def __init__(self, storage: StorageIntegrityManager):
        self.storage = storage

    # -----------------------------------------------------------------------
    # State synchronization & lazy initialization
    # -----------------------------------------------------------------------
    def ensure_canonical_products(self, state: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Ensures state has 'canonicalProducts'. If missing (from Phase 1/2 state),
        bootstraps canonical entities from existing catalog products having
        status == 'Canonical Master' or having a canonicalId.
        """
        canonical_list = state.get("canonicalProducts")
        if isinstance(canonical_list, list) and (len(canonical_list) > 0 or "canonicalProducts" in state):
            return canonical_list

        products = state.get("products", [])
        bootstrapped: dict[str, dict[str, Any]] = {}

        # 1. First pass: find canonical masters
        for p in products:
            status = p.get("status")
            can_id = p.get("canonicalId")
            pid = str(p.get("id", ""))
            
            if status == "Canonical Master" or (can_id and can_id.startswith("can-")):
                assigned_id = can_id or f"can-{pid.replace('prod-', '')}"
                if assigned_id not in bootstrapped:
                    attrs = p.get("attributes", {})
                    bootstrapped[assigned_id] = {
                        "id": assigned_id,
                        "title": str(p.get("title", "")),
                        "normalizedTitle": normalize_text(p.get("title", "")),
                        "brand": normalize_brand(p.get("brand")),
                        "modelNumber": str(p.get("modelNumber", "")),
                        "category": str(p.get("category", "Uncategorized")),
                        "subCategory": str(p.get("subCategory", "")),
                        "upcOrGtin": normalize_identifier(p.get("upcOrGtin", "")),
                        "attributes": dict(attrs) if isinstance(attrs, dict) else {},
                        "variants": [],
                        "status": "active",
                        "sourceProductIds": [pid],
                        "sellerOffers": copy.deepcopy(p.get("sellerOffers", [])),
                        "price": float(p.get("price", 0.0)),
                        "currency": str(p.get("currency", "₹")),
                        "imageUrl": str(p.get("imageUrl", "")),
                        "rating": float(p.get("rating", 0.0)),
                        "reviewsCount": int(p.get("reviewsCount", 0)),
                        "mergedIntoCanonicalId": None,
                        "conflicts": {},
                        "version": 1,
                        "createdAt": str(p.get("createdAt") or utc_now()),
                        "updatedAt": utc_now(),
                    }
                else:
                    if pid not in bootstrapped[assigned_id]["sourceProductIds"]:
                        bootstrapped[assigned_id]["sourceProductIds"].append(pid)

        # 2. Second pass: associate any source products with matching canonicalId
        for p in products:
            can_id = p.get("canonicalId")
            pid = str(p.get("id", ""))
            if can_id and can_id in bootstrapped:
                if pid not in bootstrapped[can_id]["sourceProductIds"]:
                    bootstrapped[can_id]["sourceProductIds"].append(pid)

        result = list(bootstrapped.values())
        state["canonicalProducts"] = result
        return result

    def get_source_products_map(self, state: dict[str, Any]) -> dict[str, dict[str, Any]]:
        return {str(p.get("id", "")): p for p in state.get("products", [])}

    def recompute_canonical_aggregates(
        self,
        canonical: dict[str, Any],
        products_map: dict[str, dict[str, Any]]
    ) -> None:
        """
        Harmonizes seller offers, lowest price, rating, and review counts
        from all attached source listings.
        """
        attached_ids = canonical.get("sourceProductIds", [])
        all_offers: list[dict[str, Any]] = []
        prices: list[float] = []
        ratings: list[float] = []
        total_reviews = 0

        for pid in attached_ids:
            sp = products_map.get(pid)
            if not sp:
                continue
            # Incorporate direct sellerOffers on product
            for offer in sp.get("sellerOffers", []):
                all_offers.append(offer)
                if offer.get("price"):
                    prices.append(float(offer["price"]))

            # If no sellerOffers, create a synthetic offer from the product itself
            if not sp.get("sellerOffers") and sp.get("price"):
                p_val = float(sp["price"])
                prices.append(p_val)
                all_offers.append({
                    "id": f"off-{pid}",
                    "sellerId": f"s-{sp.get('source', 'direct').lower()}",
                    "sellerName": sp.get("source", "Direct"),
                    "sellerRating": float(sp.get("rating", 4.5)),
                    "sellerReviewCount": int(sp.get("reviewsCount", 100)),
                    "price": p_val,
                    "originalPrice": p_val,
                    "currency": sp.get("currency", "₹"),
                    "availability": "In Stock",
                    "shippingCost": 0,
                    "shippingDays": "Standard Shipping",
                    "listingUrl": "#",
                    "sku": sp.get("sourceSku", pid),
                    "condition": "Brand New",
                    "isBuyBoxWinner": False
                })

            if sp.get("rating"):
                ratings.append(float(sp["rating"]))
            if sp.get("reviewsCount"):
                total_reviews += int(sp["reviewsCount"])

        # Determine Buy-Box winner (lowest price offer)
        if all_offers:
            min_price = min(o["price"] for o in all_offers)
            for o in all_offers:
                o["isBuyBoxWinner"] = (o["price"] == min_price)
            canonical["price"] = min_price
        elif prices:
            canonical["price"] = min(prices)

        canonical["sellerOffers"] = all_offers
        if ratings:
            canonical["rating"] = round(sum(ratings) / len(ratings), 1)
        if total_reviews:
            canonical["reviewsCount"] = total_reviews

    # -----------------------------------------------------------------------
    # TASK 3 — Canonical Product CRUD
    # -----------------------------------------------------------------------
    def list_canonical_products(
        self,
        q: Optional[str] = None,
        brand: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = "active",
        limit: int = 50,
        offset: int = 0
    ) -> dict[str, Any]:
        state = self.storage.load_state()
        can_list = self.ensure_canonical_products(state)

        filtered = can_list
        if status and status != "all":
            # Support 'active' matching both 'active' and Phase 1 'Canonical Master'
            if status == "active":
                filtered = [c for c in filtered if c.get("status") in ("active", "Canonical Master")]
            else:
                filtered = [c for c in filtered if c.get("status") == status]

        if brand and brand != "all":
            norm_b = normalize_brand(brand)
            filtered = [c for c in filtered if normalize_brand(c.get("brand")) == norm_b]

        if category and category != "all":
            cat_lower = category.lower()
            filtered = [c for c in filtered if str(c.get("category", "")).lower() == cat_lower]

        if q:
            norm_q = normalize_text(q)
            filtered = [
                c for c in filtered
                if norm_q in normalize_text(
                    f"{c.get('title', '')} {c.get('brand', '')} {c.get('modelNumber', '')} {c.get('upcOrGtin', '')}"
                )
            ]

        total = len(filtered)
        paginated = filtered[offset: offset + limit]
        return {
            "items": paginated,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    def get_canonical_product(
        self,
        canonical_id: str,
        follow_redirect: bool = False
    ) -> dict[str, Any]:
        state = self.storage.load_state()
        can_list = self.ensure_canonical_products(state)
        
        target = next((c for c in can_list if c.get("id") == canonical_id), None)
        if not target:
            raise HTTPException(
                status_code=404,
                detail=f"Canonical product '{canonical_id}' not found."
            )

        if follow_redirect and target.get("status") == "merged":
            survivor_id = target.get("mergedIntoCanonicalId")
            if survivor_id:
                survivor = next((c for c in can_list if c.get("id") == survivor_id), None)
                if survivor:
                    return {
                        **survivor,
                        "_redirectedFrom": canonical_id,
                        "_originalStatus": "merged"
                    }

        return target

    def create_canonical_product(self, payload: CanonicalProductCreate) -> dict[str, Any]:
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            products_map = self.get_source_products_map(state)

            can_id = make_id("can")
            norm_title = normalize_text(payload.title)
            norm_brand = normalize_brand(payload.brand)
            norm_upc = normalize_identifier(payload.upcOrGtin)

            # Validate source products if provided
            valid_source_ids = []
            for spid in payload.sourceProductIds:
                if spid in products_map:
                    valid_source_ids.append(spid)
                    products_map[spid]["canonicalId"] = can_id
                    products_map[spid]["status"] = "Matched"

            now = utc_now()
            canonical = {
                "id": can_id,
                "title": payload.title.strip(),
                "normalizedTitle": norm_title,
                "brand": norm_brand,
                "modelNumber": payload.modelNumber.strip() if payload.modelNumber else "",
                "category": payload.category.strip() if payload.category else "Uncategorized",
                "subCategory": payload.subCategory.strip() if payload.subCategory else "",
                "upcOrGtin": norm_upc,
                "attributes": payload.attributes,
                "variants": [],
                "status": "active",
                "sourceProductIds": valid_source_ids,
                "sellerOffers": [],
                "price": payload.price,
                "currency": payload.currency,
                "imageUrl": payload.imageUrl,
                "rating": 0.0,
                "reviewsCount": 0,
                "mergedIntoCanonicalId": None,
                "conflicts": {},
                "version": 1,
                "createdAt": now,
                "updatedAt": now,
            }

            self.recompute_canonical_aggregates(canonical, products_map)
            can_list.insert(0, canonical)
            state["canonicalProducts"] = can_list

            # Audit record
            self._record_audit_event(
                state=state,
                action="Canonical Product Created",
                action_type="create",
                target=can_id,
                entity_ids=[can_id],
                user=payload.reviewer,
                reason=payload.reason,
                details=f"Created canonical product '{payload.title}' with ID {can_id}.",
                after_snapshot=canonical
            )

            self.storage.save_state_atomic(state)
            return canonical

    def update_canonical_product(
        self,
        canonical_id: str,
        payload: CanonicalProductUpdate
    ) -> dict[str, Any]:
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            idx = next((i for i, c in enumerate(can_list) if c.get("id") == canonical_id), None)
            if idx is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Canonical product '{canonical_id}' not found."
                )

            current = can_list[idx]
            if current.get("status") == "merged":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Cannot modify merged entity '{canonical_id}'. "
                        f"It redirects to surviving entity '{current.get('mergedIntoCanonicalId')}'."
                    ),
                )

            # Optimistic concurrency check
            if payload.version is not None and payload.version != current.get("version", 1):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Version conflict: Entity is at version {current.get('version', 1)}, "
                        f"but request submitted version {payload.version}. Reload and retry."
                    ),
                )

            before_snap = copy.deepcopy(current)

            # Apply fields
            if payload.title is not None:
                current["title"] = payload.title.strip()
                current["normalizedTitle"] = normalize_text(payload.title)
            if payload.brand is not None:
                current["brand"] = normalize_brand(payload.brand)
            if payload.category is not None:
                current["category"] = payload.category.strip()
            if payload.subCategory is not None:
                current["subCategory"] = payload.subCategory.strip()
            if payload.modelNumber is not None:
                current["modelNumber"] = payload.modelNumber.strip()
            if payload.upcOrGtin is not None:
                current["upcOrGtin"] = normalize_identifier(payload.upcOrGtin)
            if payload.attributes is not None:
                current["attributes"] = payload.attributes
            if payload.price is not None:
                current["price"] = max(0.0, float(payload.price))
            if payload.imageUrl is not None:
                current["imageUrl"] = payload.imageUrl
            if payload.status is not None and payload.status in ("active", "archived"):
                current["status"] = payload.status

            current["version"] = int(current.get("version", 1)) + 1
            current["updatedAt"] = utc_now()
            can_list[idx] = current
            state["canonicalProducts"] = can_list

            self._record_audit_event(
                state=state,
                action="Canonical Product Updated",
                action_type="update",
                target=canonical_id,
                entity_ids=[canonical_id],
                user=payload.reviewer,
                reason=payload.reason,
                details=f"Updated editable fields for canonical product '{canonical_id}'.",
                before_snapshot=before_snap,
                after_snapshot=current
            )

            self.storage.save_state_atomic(state)
            return current

    def archive_canonical_product(
        self,
        canonical_id: str,
        reviewer: str = "unauthenticated_reviewer",
        reason: str = "Archived canonical product"
    ) -> dict[str, Any]:
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            idx = next((i for i, c in enumerate(can_list) if c.get("id") == canonical_id), None)
            if idx is None:
                raise HTTPException(status_code=404, detail=f"Canonical product '{canonical_id}' not found.")

            current = can_list[idx]
            if current.get("status") == "archived":
                return current  # idempotent

            before_snap = copy.deepcopy(current)
            current["status"] = "archived"
            current["updatedAt"] = utc_now()
            current["version"] = int(current.get("version", 1)) + 1
            can_list[idx] = current
            state["canonicalProducts"] = can_list

            self._record_audit_event(
                state=state,
                action="Canonical Product Archived",
                action_type="archive",
                target=canonical_id,
                entity_ids=[canonical_id],
                user=reviewer,
                reason=reason,
                details=f"Deactivated canonical product '{canonical_id}'. Source listings preserved.",
                before_snapshot=before_snap,
                after_snapshot=current
            )

            self.storage.save_state_atomic(state)
            return current

    def get_canonical_sources(self, canonical_id: str) -> list[dict[str, Any]]:
        state = self.storage.load_state()
        can_list = self.ensure_canonical_products(state)
        canonical = next((c for c in can_list if c.get("id") == canonical_id), None)
        if not canonical:
            raise HTTPException(status_code=404, detail=f"Canonical product '{canonical_id}' not found.")

        products_map = self.get_source_products_map(state)
        attached_ids = canonical.get("sourceProductIds", [])
        return [products_map[pid] for pid in attached_ids if pid in products_map]

    def get_canonical_history(self, canonical_id: str) -> dict[str, Any]:
        state = self.storage.load_state()
        audits = state.get("auditLogs", [])
        pairs = state.get("matchPairs", [])

        # Filter audits mentioning this canonical ID
        relevant_audits = [
            a for a in audits
            if a.get("target") == canonical_id or canonical_id in a.get("entityIds", [])
        ]

        # Filter candidate pairs involving products of this canonical
        can = next((c for c in state.get("canonicalProducts", []) if c.get("id") == canonical_id), None)
        source_ids = set(can.get("sourceProductIds", [])) if can else set()
        relevant_pairs = [
            p for p in pairs
            if p.get("productIdA") in source_ids or p.get("productIdB") in source_ids
        ]

        return {
            "canonicalId": canonical_id,
            "auditLogs": relevant_audits,
            "matchPairs": relevant_pairs,
        }

    # -----------------------------------------------------------------------
    # TASK 4 — Safe Merge Operations
    # -----------------------------------------------------------------------
    def detect_merge_conflicts(
        self,
        survivor: dict[str, Any],
        merging_candidates: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Detects brand, category, UPC/GTIN, model number, and attribute conflicts.
        Returns a list of conflict descriptor dicts.
        """
        conflicts: list[dict[str, Any]] = []
        survivor_brand = normalize_brand(survivor.get("brand"))
        survivor_cat = str(survivor.get("category", "")).strip().lower()
        survivor_upc = normalize_identifier(survivor.get("upcOrGtin"))
        survivor_model = normalize_text(survivor.get("modelNumber"))
        survivor_attrs = {
            k.strip().lower(): str(v).strip()
            for k, v in survivor.get("attributes", {}).items()
        }

        for candidate in merging_candidates:
            cid = candidate.get("id", "unknown")
            # 1. Brand conflict
            cand_brand = normalize_brand(candidate.get("brand"))
            if survivor_brand and cand_brand:
                if survivor_brand not in ("Unknown", "") and cand_brand not in ("Unknown", ""):
                    if survivor_brand != cand_brand:
                        conflicts.append({
                            "type": "brand_mismatch",
                            "canonicalId": cid,
                            "survivorValue": survivor.get("brand"),
                            "candidateValue": candidate.get("brand"),
                            "message": f"Brand conflict: Survivor '{survivor.get('brand')}' vs Candidate '{candidate.get('brand')}'."
                        })

            # 2. Category conflict (major mismatch)
            cand_cat = str(candidate.get("category", "")).strip().lower()
            if survivor_cat and cand_cat:
                if survivor_cat != "uncategorized" and cand_cat != "uncategorized":
                    if survivor_cat != cand_cat:
                        conflicts.append({
                            "type": "category_mismatch",
                            "canonicalId": cid,
                            "survivorValue": survivor.get("category"),
                            "candidateValue": candidate.get("category"),
                            "message": f"Category conflict: Survivor '{survivor.get('category')}' vs Candidate '{candidate.get('category')}'."
                        })

            # 3. Barcode (UPC/GTIN) conflict
            cand_upc = normalize_identifier(candidate.get("upcOrGtin"))
            if survivor_upc and cand_upc and survivor_upc != cand_upc:
                conflicts.append({
                    "type": "identifier_mismatch",
                    "canonicalId": cid,
                    "survivorValue": survivor.get("upcOrGtin"),
                    "candidateValue": candidate.get("upcOrGtin"),
                    "message": f"Barcode/UPC conflict: Survivor has '{survivor.get('upcOrGtin')}' while Candidate has '{candidate.get('upcOrGtin')}'."
                })

            # 4. Model number conflict
            cand_model = normalize_text(candidate.get("modelNumber"))
            if survivor_model and cand_model and survivor_model != cand_model:
                from difflib import SequenceMatcher
                ratio = SequenceMatcher(None, survivor_model, cand_model).ratio()
                if ratio < 0.70:
                    conflicts.append({
                        "type": "model_mismatch",
                        "canonicalId": cid,
                        "survivorValue": survivor.get("modelNumber"),
                        "candidateValue": candidate.get("modelNumber"),
                        "message": f"Model number discrepancy: Survivor '{survivor.get('modelNumber')}' vs Candidate '{candidate.get('modelNumber')}'."
                    })

            # 5. Material attribute conflict (e.g. Storage, RAM, Display)
            cand_attrs = {
                k.strip().lower(): str(v).strip()
                for k, v in candidate.get("attributes", {}).items()
            }
            for attr_key in ("storage", "ram", "color", "screensize", "capacity"):
                if attr_key in survivor_attrs and attr_key in cand_attrs:
                    sv_norm = normalize_text(survivor_attrs[attr_key])
                    cv_norm = normalize_text(cand_attrs[attr_key])
                    if sv_norm and cv_norm and sv_norm != cv_norm:
                        conflicts.append({
                            "type": "attribute_conflict",
                            "canonicalId": cid,
                            "attribute": attr_key,
                            "survivorValue": survivor_attrs[attr_key],
                            "candidateValue": cand_attrs[attr_key],
                            "message": f"Specification conflict on '{attr_key}': Survivor '{survivor_attrs[attr_key]}' vs Candidate '{cand_attrs[attr_key]}'."
                        })

        return conflicts

    def execute_merge(self, payload: CanonicalMergeRequest) -> dict[str, Any]:
        """
        Transactional-style merge:
          - Rejects self-merges, duplicate IDs, invalid IDs
          - Detects cyclic redirects
          - Enforces conflict check unless confirmConflicts=True
          - Reassigns source product listings to survivor
          - Retains redirects and before/after snapshots
          - Atomic persistence with journal and backup
        """
        tx_id = make_tx_id()
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            products_map = self.get_source_products_map(state)

            survivor_id = payload.survivingCanonicalId
            merged_ids = payload.mergedCanonicalIds

            # 1. Validation: Self-merge and duplicates
            if survivor_id in merged_ids:
                raise HTTPException(
                    status_code=422,
                    detail="Self-merge rejected: Surviving canonical ID cannot be in the list of merged IDs."
                )
            if len(merged_ids) != len(set(merged_ids)):
                raise HTTPException(
                    status_code=422,
                    detail="Duplicate IDs found in mergedCanonicalIds list."
                )

            # 2. Check survivor existence & eligibility
            survivor = next((c for c in can_list if c.get("id") == survivor_id), None)
            if not survivor:
                raise HTTPException(
                    status_code=404,
                    detail=f"Surviving canonical product '{survivor_id}' not found."
                )
            if survivor.get("status") == "merged":
                raise HTTPException(
                    status_code=409,
                    detail=f"Cannot merge into '{survivor_id}': Entity is already merged into '{survivor.get('mergedIntoCanonicalId')}'."
                )

            # 3. Check merging entities
            merging_candidates: list[dict[str, Any]] = []
            for mid in merged_ids:
                cand = next((c for c in can_list if c.get("id") == mid), None)
                if not cand:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Candidate canonical product '{mid}' not found."
                    )
                # Idempotency check: already merged into THIS survivor
                if cand.get("status") == "merged" and cand.get("mergedIntoCanonicalId") == survivor_id:
                    continue  # already merged into survivor, safe no-op
                # Already merged into a different survivor
                if cand.get("status") == "merged":
                    raise HTTPException(
                        status_code=409,
                        detail=f"Entity '{mid}' is already merged into '{cand.get('mergedIntoCanonicalId')}'. Resolve that relationship first."
                    )
                merging_candidates.append(cand)

            if not merging_candidates:
                # All candidates were already merged into survivor (idempotent success)
                return {
                    "merged": True,
                    "idempotent": True,
                    "survivor": survivor,
                    "mergedCount": 0,
                    "transactionId": tx_id
                }

            # 4. Cycle prevention: Verify survivor does not redirect back
            self._verify_no_cycles(can_list, survivor_id, [c["id"] for c in merging_candidates])

            # 5. Conflict detection
            conflicts = self.detect_merge_conflicts(survivor, merging_candidates)
            if conflicts and not payload.confirmConflicts:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Material conflicts detected between canonical entities. Explicit confirmation is required to proceed with merge.",
                        "conflicts": conflicts,
                        "requiresConfirmation": True
                    }
                )

            # --- Begin Transaction Journaling & Backup ---
            backup_path = self.storage.create_backup_snapshot(state, tx_id)
            self.storage.start_transaction_journal({
                "txId": tx_id,
                "operation": "canonical_merge",
                "timestamp": utc_now(),
                "survivorId": survivor_id,
                "mergedIds": [c["id"] for c in merging_candidates],
                "backupFile": str(backup_path),
                "reviewer": payload.reviewer
            })

            before_survivor = copy.deepcopy(survivor)
            before_candidates = [copy.deepcopy(c) for c in merging_candidates]

            # 6. Reassign source listings to survivor
            all_transferred_spids: list[str] = []
            for cand in merging_candidates:
                cand_spids = cand.get("sourceProductIds", [])
                for spid in cand_spids:
                    if spid not in survivor["sourceProductIds"]:
                        survivor["sourceProductIds"].append(spid)
                    all_transferred_spids.append(spid)
                    # Update source product record
                    if spid in products_map:
                        products_map[spid]["canonicalId"] = survivor_id
                        products_map[spid]["status"] = "Matched"

                # Mark candidate entity as merged
                cand["status"] = "merged"
                cand["mergedIntoCanonicalId"] = survivor_id
                cand["mergedAt"] = utc_now()
                cand["mergedBy"] = payload.reviewer
                cand["version"] = int(cand.get("version", 1)) + 1
                cand["updatedAt"] = utc_now()

            # Record any acknowledged conflicts in survivor
            if conflicts:
                survivor.setdefault("conflicts", {})[f"merge_{tx_id}"] = {
                    "timestamp": utc_now(),
                    "conflicts": conflicts,
                    "reviewer": payload.reviewer,
                    "reason": payload.reason
                }

            # Recompute survivor aggregates
            self.recompute_canonical_aggregates(survivor, products_map)
            survivor["version"] = int(survivor.get("version", 1)) + 1
            survivor["updatedAt"] = utc_now()

            # Update match pairs: Pairs between survivor items and merged items -> 'Merged'
            survivor_spids_set = set(survivor["sourceProductIds"])
            for pair in state.get("matchPairs", []):
                p_a = pair.get("productIdA")
                p_b = pair.get("productIdB")
                if p_a in survivor_spids_set and p_b in survivor_spids_set:
                    pair["matchStatus"] = "Merged"
                    pair["reviewerDecision"] = "merged"
                    pair["reviewedAt"] = utc_now()
                    pair["reviewedBy"] = payload.reviewer

            # Update duplicate clusters
            for cluster in state.get("duplicateClusters", []):
                c_pids = set(cluster.get("productIds", []))
                if c_pids.issubset(survivor_spids_set) and cluster.get("status") != "Resolved":
                    cluster["status"] = "Resolved"
                    cluster["resolvedAt"] = utc_now()
                    cluster["resolvedBy"] = payload.reviewer

            # 7. Record unified audit event with before/after snapshots
            self._record_audit_event(
                state=state,
                action="Canonical Entities Merged",
                action_type="merge",
                target=survivor_id,
                entity_ids=[survivor_id] + [c["id"] for c in merging_candidates],
                user=payload.reviewer,
                reason=payload.reason or "Explicit user authorized merge",
                details=(
                    f"Merged {len(merging_candidates)} canonical product(s) "
                    f"({', '.join(c['id'] for c in merging_candidates)}) into surviving master '{survivor_id}'. "
                    f"Transferred {len(all_transferred_spids)} source product listings."
                ),
                before_snapshot={
                    "survivor": before_survivor,
                    "candidates": before_candidates
                },
                after_snapshot={
                    "survivor": survivor,
                    "candidates": merging_candidates
                },
                correlation_id=tx_id
            )

            # 8. Commit atomic save
            state["canonicalProducts"] = can_list
            self.storage.save_state_atomic(state)

            # 9. Mark journal complete
            self.storage.commit_transaction_journal(tx_id)

            return {
                "merged": True,
                "survivor": survivor,
                "mergedCount": len(merging_candidates),
                "transferredSourcesCount": len(all_transferred_spids),
                "transactionId": tx_id,
                "conflictsOverridden": len(conflicts) if conflicts else 0
            }

    def _verify_no_cycles(
        self,
        can_list: list[dict[str, Any]],
        survivor_id: str,
        merging_ids: list[str]
    ) -> None:
        """Ensures that following redirect chains never forms a loop."""
        redirect_map: dict[str, str] = {}
        for c in can_list:
            cid = c.get("id")
            target = c.get("mergedIntoCanonicalId")
            if cid and target:
                redirect_map[cid] = target

        # Simulate new redirects
        for mid in merging_ids:
            redirect_map[mid] = survivor_id

        # Check for cycles using Floyd's cycle detection
        for start_node in redirect_map:
            slow = start_node
            fast = start_node
            while fast in redirect_map and redirect_map[fast] in redirect_map:
                slow = redirect_map[slow]
                fast = redirect_map[redirect_map[fast]]
                if slow == fast:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Cyclic redirect detected: Merging would create a cycle involving '{slow}'."
                    )

    # -----------------------------------------------------------------------
    # TASK 5 — Safe Split and Undo Operations
    # -----------------------------------------------------------------------
    def execute_split(
        self,
        canonical_id: str,
        payload: CanonicalSplitRequest
    ) -> dict[str, Any]:
        """
        Detaches source listings from canonical entity and moves them to
        either a new canonical entity or an existing destination entity.
        """
        tx_id = make_tx_id()
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            products_map = self.get_source_products_map(state)

            canonical = next((c for c in can_list if c.get("id") == canonical_id), None)
            if not canonical:
                raise HTTPException(status_code=404, detail=f"Canonical product '{canonical_id}' not found.")
            if canonical.get("status") == "merged":
                raise HTTPException(
                    status_code=409,
                    detail=f"Cannot split merged canonical product '{canonical_id}'."
                )

            current_spids = canonical.get("sourceProductIds", [])
            detach_spids = payload.sourceProductIds

            # Validate that every detached ID is actually attached
            for spid in detach_spids:
                if spid not in current_spids:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Source listing '{spid}' is not attached to canonical product '{canonical_id}'."
                    )

            if len(detach_spids) == len(current_spids) and not payload.destinationCanonicalId:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Cannot detach all listings without specifying an existing destination. "
                        "This would leave an orphan canonical entity."
                    ),
                )

            # Pre-mutation backup
            backup_path = self.storage.create_backup_snapshot(state, tx_id)
            self.storage.start_transaction_journal({
                "txId": tx_id,
                "operation": "canonical_split",
                "timestamp": utc_now(),
                "canonicalId": canonical_id,
                "detachedCount": len(detach_spids),
                "backupFile": str(backup_path),
                "reviewer": payload.reviewer
            })

            before_canonical = copy.deepcopy(canonical)

            # Determine destination entity
            destination: dict[str, Any]
            if payload.destinationCanonicalId:
                dest = next((c for c in can_list if c.get("id") == payload.destinationCanonicalId), None)
                if not dest:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Destination canonical product '{payload.destinationCanonicalId}' not found."
                    )
                if dest.get("status") == "merged":
                    raise HTTPException(
                        status_code=409,
                        detail=f"Destination canonical product '{payload.destinationCanonicalId}' is merged."
                    )
                destination = dest
            else:
                # Create new canonical entity derived from first detached listing
                rep_spid = detach_spids[0]
                rep_sp = products_map.get(rep_spid, {})
                new_id = make_id("can")
                now = utc_now()
                destination = {
                    "id": new_id,
                    "title": payload.newCanonicalTitle or str(rep_sp.get("title", f"Split Product ({rep_spid})")),
                    "normalizedTitle": normalize_text(payload.newCanonicalTitle or rep_sp.get("title", "")),
                    "brand": normalize_brand(rep_sp.get("brand")),
                    "modelNumber": str(rep_sp.get("modelNumber", "")),
                    "category": str(rep_sp.get("category", canonical.get("category", "Uncategorized"))),
                    "subCategory": str(rep_sp.get("subCategory", "")),
                    "upcOrGtin": normalize_identifier(rep_sp.get("upcOrGtin", "")),
                    "attributes": dict(rep_sp.get("attributes", {})),
                    "variants": [],
                    "status": "active",
                    "sourceProductIds": [],
                    "sellerOffers": [],
                    "price": float(rep_sp.get("price", 0.0)),
                    "currency": str(rep_sp.get("currency", "₹")),
                    "imageUrl": str(rep_sp.get("imageUrl", "")),
                    "rating": float(rep_sp.get("rating", 0.0)),
                    "reviewsCount": int(rep_sp.get("reviewsCount", 0)),
                    "mergedIntoCanonicalId": None,
                    "conflicts": {},
                    "version": 1,
                    "createdAt": now,
                    "updatedAt": now,
                }
                can_list.insert(0, destination)

            # Move detached listings
            for spid in detach_spids:
                if spid in canonical["sourceProductIds"]:
                    canonical["sourceProductIds"].remove(spid)
                if spid not in destination["sourceProductIds"]:
                    destination["sourceProductIds"].append(spid)
                if spid in products_map:
                    products_map[spid]["canonicalId"] = destination["id"]

            # Recompute aggregates for both
            self.recompute_canonical_aggregates(canonical, products_map)
            self.recompute_canonical_aggregates(destination, products_map)

            canonical["version"] = int(canonical.get("version", 1)) + 1
            canonical["updatedAt"] = utc_now()
            destination["version"] = int(destination.get("version", 1)) + 1
            destination["updatedAt"] = utc_now()

            # Mark prior match decisions between remaining and detached products as 'Pending Review'
            remaining_set = set(canonical["sourceProductIds"])
            detached_set = set(detach_spids)
            for pair in state.get("matchPairs", []):
                p_a = pair.get("productIdA")
                p_b = pair.get("productIdB")
                if (p_a in remaining_set and p_b in detached_set) or (p_b in remaining_set and p_a in detached_set):
                    pair["matchStatus"] = "Pending Review"
                    pair["reviewerDecision"] = None
                    pair["reviewedAt"] = None
                    pair["reviewedBy"] = None

            # Record audit event
            self._record_audit_event(
                state=state,
                action="Canonical Product Split",
                action_type="split",
                target=canonical_id,
                entity_ids=[canonical_id, destination["id"]],
                user=payload.reviewer,
                reason=payload.reason or "Curator initiated product split",
                details=(
                    f"Detached {len(detach_spids)} source listing(s) from '{canonical_id}' "
                    f"into destination '{destination['id']}'."
                ),
                before_snapshot=before_canonical,
                after_snapshot={
                    "sourceCanonical": canonical,
                    "destinationCanonical": destination
                },
                correlation_id=tx_id
            )

            state["canonicalProducts"] = can_list
            self.storage.save_state_atomic(state)

            self.storage.commit_transaction_journal(tx_id)

            return {
                "split": True,
                "sourceCanonical": canonical,
                "destinationCanonical": destination,
                "detachedCount": len(detach_spids),
                "transactionId": tx_id
            }

    def execute_undo_merge(
        self,
        target_id: str,
        payload: CanonicalUndoMergeRequest
    ) -> dict[str, Any]:
        """
        Compensating operation for safe recovery from an incorrect merge.
        Restores merged entity to active status, reassigns original listings,
        and clears redirects without deleting audit history.
        """
        tx_id = make_tx_id()
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            products_map = self.get_source_products_map(state)

            target = next((c for c in can_list if c.get("id") == target_id), None)
            if not target:
                raise HTTPException(status_code=404, detail=f"Canonical product '{target_id}' not found.")

            merged_entity: dict[str, Any]
            survivor_entity: dict[str, Any]

            if target.get("status") == "merged":
                merged_entity = target
                survivor_id = target.get("mergedIntoCanonicalId")
                survivor_entity = next((c for c in can_list if c.get("id") == survivor_id), None)
                if not survivor_entity:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Surviving canonical entity '{survivor_id}' not found."
                    )
            else:
                # Target is survivor; find specified merged entity or most recent merge
                mid = payload.mergedCanonicalId
                if not mid:
                    # Find any entity merged into this target
                    candidates = [c for c in can_list if c.get("mergedIntoCanonicalId") == target_id]
                    if not candidates:
                        raise HTTPException(
                            status_code=400,
                            detail=f"No entities are currently merged into survivor '{target_id}'."
                        )
                    merged_entity = candidates[0]
                else:
                    merged_entity = next((c for c in can_list if c.get("id") == mid), None)
                    if not merged_entity or merged_entity.get("mergedIntoCanonicalId") != target_id:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Entity '{mid}' is not recorded as merged into '{target_id}'."
                        )
                survivor_entity = target

            backup_path = self.storage.create_backup_snapshot(state, tx_id)
            self.storage.start_transaction_journal({
                "txId": tx_id,
                "operation": "undo_merge",
                "timestamp": utc_now(),
                "survivorId": survivor_entity["id"],
                "mergedId": merged_entity["id"],
                "backupFile": str(backup_path),
                "reviewer": payload.reviewer
            })

            before_survivor = copy.deepcopy(survivor_entity)
            before_merged = copy.deepcopy(merged_entity)

            # Restore merged entity
            merged_entity["status"] = "active"
            merged_entity["mergedIntoCanonicalId"] = None
            merged_entity.pop("mergedAt", None)
            merged_entity.pop("mergedBy", None)
            merged_entity["version"] = int(merged_entity.get("version", 1)) + 1
            merged_entity["updatedAt"] = utc_now()

            # Reassign source listings originally belonging to merged entity
            restored_spids = merged_entity.get("sourceProductIds", [])
            for spid in restored_spids:
                if spid in survivor_entity["sourceProductIds"]:
                    survivor_entity["sourceProductIds"].remove(spid)
                if spid in products_map:
                    products_map[spid]["canonicalId"] = merged_entity["id"]

            # Recompute aggregates for both
            self.recompute_canonical_aggregates(survivor_entity, products_map)
            self.recompute_canonical_aggregates(merged_entity, products_map)

            survivor_entity["version"] = int(survivor_entity.get("version", 1)) + 1
            survivor_entity["updatedAt"] = utc_now()

            # Audit record (strictly preserving audit trail)
            self._record_audit_event(
                state=state,
                action="Compensating Undo Merge",
                action_type="undo",
                target=survivor_entity["id"],
                entity_ids=[survivor_entity["id"], merged_entity["id"]],
                user=payload.reviewer,
                reason=payload.reason or "Reviewer reversed prior entity merge",
                details=(
                    f"Undid merge between survivor '{survivor_entity['id']}' and restored entity '{merged_entity['id']}'. "
                    f"Restored {len(restored_spids)} source product assignments."
                ),
                before_snapshot={
                    "survivor": before_survivor,
                    "merged": before_merged
                },
                after_snapshot={
                    "survivor": survivor_entity,
                    "merged": merged_entity
                },
                correlation_id=tx_id
            )

            state["canonicalProducts"] = can_list
            self.storage.save_state_atomic(state)

            self.storage.commit_transaction_journal(tx_id)

            return {
                "undone": True,
                "survivor": survivor_entity,
                "restoredEntity": merged_entity,
                "transactionId": tx_id
            }

    # -----------------------------------------------------------------------
    # TASK 6 — Source Listing Management
    # -----------------------------------------------------------------------
    def attach_source_listing(
        self,
        canonical_id: str,
        payload: SourceAttachRequest
    ) -> dict[str, Any]:
        """
        Attaches a source listing to a canonical entity. If previously attached
        elsewhere, safely reassigns it and updates both canonical records.
        """
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            products_map = self.get_source_products_map(state)

            canonical = next((c for c in can_list if c.get("id") == canonical_id), None)
            if not canonical:
                raise HTTPException(status_code=404, detail=f"Canonical product '{canonical_id}' not found.")
            if canonical.get("status") == "merged":
                raise HTTPException(status_code=409, detail=f"Cannot attach listing to merged product '{canonical_id}'.")

            spid = payload.sourceProductId
            sp = products_map.get(spid)
            if not sp:
                raise HTTPException(status_code=404, detail=f"Source listing '{spid}' not found in catalog.")

            # Idempotency check
            if spid in canonical.get("sourceProductIds", []):
                return {
                    "attached": True,
                    "idempotent": True,
                    "canonical": canonical,
                    "sourceListing": sp
                }

            # Check if assigned to another canonical entity
            prev_canonical: Optional[dict[str, Any]] = None
            old_can_id = sp.get("canonicalId")
            if old_can_id and old_can_id != canonical_id:
                prev_canonical = next((c for c in can_list if c.get("id") == old_can_id), None)
                if prev_canonical and spid in prev_canonical.get("sourceProductIds", []):
                    prev_canonical["sourceProductIds"].remove(spid)
                    self.recompute_canonical_aggregates(prev_canonical, products_map)
                    prev_canonical["version"] = int(prev_canonical.get("version", 1)) + 1
                    prev_canonical["updatedAt"] = utc_now()

            canonical.setdefault("sourceProductIds", []).append(spid)
            sp["canonicalId"] = canonical_id
            sp["status"] = "Matched"

            self.recompute_canonical_aggregates(canonical, products_map)
            canonical["version"] = int(canonical.get("version", 1)) + 1
            canonical["updatedAt"] = utc_now()

            self._record_audit_event(
                state=state,
                action="Source Listing Attached",
                action_type="attach",
                target=canonical_id,
                entity_ids=[canonical_id, spid] + ([prev_canonical["id"]] if prev_canonical else []),
                user=payload.reviewer,
                reason=payload.reason,
                details=(
                    f"Attached source listing '{spid}' ({sp.get('source')}) to canonical '{canonical_id}'. "
                    + (f"Reassigned from previous canonical '{prev_canonical['id']}'." if prev_canonical else "")
                )
            )

            self.storage.save_state_atomic(state)
            return {
                "attached": True,
                "canonical": canonical,
                "sourceListing": sp,
                "reassignedFrom": prev_canonical["id"] if prev_canonical else None
            }

    def detach_source_listing(
        self,
        canonical_id: str,
        payload: SourceDetachRequest
    ) -> dict[str, Any]:
        with self.storage.lock:
            state = self.storage.load_state()
            can_list = self.ensure_canonical_products(state)
            products_map = self.get_source_products_map(state)

            canonical = next((c for c in can_list if c.get("id") == canonical_id), None)
            if not canonical:
                raise HTTPException(status_code=404, detail=f"Canonical product '{canonical_id}' not found.")

            spid = payload.sourceProductId
            if spid not in canonical.get("sourceProductIds", []):
                raise HTTPException(
                    status_code=404,
                    detail=f"Source listing '{spid}' is not attached to canonical '{canonical_id}'."
                )

            canonical["sourceProductIds"].remove(spid)
            sp = products_map.get(spid)
            if sp:
                sp["canonicalId"] = None
                sp["status"] = "Unmatched"

            self.recompute_canonical_aggregates(canonical, products_map)
            canonical["version"] = int(canonical.get("version", 1)) + 1
            canonical["updatedAt"] = utc_now()

            self._record_audit_event(
                state=state,
                action="Source Listing Detached",
                action_type="detach",
                target=canonical_id,
                entity_ids=[canonical_id, spid],
                user=payload.reviewer,
                reason=payload.reason,
                details=f"Detached source listing '{spid}' from canonical '{canonical_id}'."
            )

            self.storage.save_state_atomic(state)
            return {
                "detached": True,
                "canonical": canonical,
                "detachedSourceId": spid
            }

    # -----------------------------------------------------------------------
    # TASK 7 — Unified Audit History
    # -----------------------------------------------------------------------
    def _record_audit_event(
        self,
        state: dict[str, Any],
        action: str,
        action_type: str,
        target: str,
        entity_ids: list[str],
        user: str = "unauthenticated_reviewer",
        reason: str = "",
        details: str = "",
        before_snapshot: Optional[Any] = None,
        after_snapshot: Optional[Any] = None,
        correlation_id: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Creates an immutable, standardized audit record with UTC timestamp.
        Defaults actor to 'unauthenticated_reviewer' if not configured.
        """
        event_id = make_id("log")
        entry = {
            "id": event_id,
            "timestamp": utc_now(),
            "user": user or "unauthenticated_reviewer",
            "action": action,
            "type": action_type,
            "target": target,
            "entityIds": entity_ids,
            "details": details or action,
            "reason": reason,
            "beforeSnapshot": before_snapshot,
            "afterSnapshot": after_snapshot,
            "correlationId": correlation_id or make_tx_id(),
        }
        state.setdefault("auditLogs", []).insert(0, entry)
        return entry

    def list_audit_events(
        self,
        entity_id: Optional[str] = None,
        action_type: Optional[str] = None,
        user: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> dict[str, Any]:
        state = self.storage.load_state()
        audits = state.get("auditLogs", [])
        if not isinstance(audits, list):
            audits = []

        filtered = audits
        if entity_id:
            filtered = [
                a for a in filtered
                if a.get("target") == entity_id or entity_id in a.get("entityIds", [])
            ]
        if action_type and action_type != "all":
            filtered = [a for a in filtered if a.get("type") == action_type]
        if user and user != "all":
            filtered = [a for a in filtered if a.get("user") == user]
        if start_time:
            filtered = [a for a in filtered if a.get("timestamp", "") >= start_time]
        if end_time:
            filtered = [a for a in filtered if a.get("timestamp", "") <= end_time]

        total = len(filtered)
        paginated = filtered[offset: offset + limit]
        return {
            "items": paginated,
            "total": total,
            "limit": limit,
            "offset": offset
        }
