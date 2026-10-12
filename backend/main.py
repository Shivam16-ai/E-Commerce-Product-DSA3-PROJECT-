"""
Entity Resolution Platform — Phase 2 Backend
=============================================
Implements:
  - Product normalization pipeline (Task 2)
  - Candidate generation with blocking (Task 3)
  - Explainable, configurable match scoring (Task 4)
  - Duplicate detection & clustering (Task 5)
  - Match review workflow (Task 6)
  - Performance, locking, atomic writes (Task 8)

All Phase 1 routes are preserved for backward compatibility.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import re
import threading
import unicodedata
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from canonical_manager import (
    CanonicalManager,
    CanonicalMergeRequest,
    CanonicalProductCreate,
    CanonicalProductUpdate,
    CanonicalSplitRequest,
    CanonicalUndoMergeRequest,
    SourceAttachRequest,
    SourceDetachRequest,
    StorageIntegrityManager,
)

# ---------------------------------------------------------------------------
# Paths & global state
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("APP_DATA_DIR", str(BASE_DIR / "data"))).resolve()
STATE_FILE = DATA_DIR / "state.json"
LOCK = threading.RLock()
_MATCHING_LOCK = threading.Lock()          # prevents concurrent matching runs
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Entity Resolution Platform API — Phase 2",
    description=(
        "Database-free backend for product catalog ingestion, explainable entity "
        "resolution, duplicate detection, and match review workflow."
    ),
    version="2.0.0",
)
origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# State persistence (atomic write, locking, journaling)
# ---------------------------------------------------------------------------
_STORAGE_MANAGER: StorageIntegrityManager | None = None
_CANONICAL_MANAGER: CanonicalManager | None = None


def get_storage_manager() -> StorageIntegrityManager:
    global _STORAGE_MANAGER
    if _STORAGE_MANAGER is None or _STORAGE_MANAGER.data_dir != DATA_DIR or _STORAGE_MANAGER.state_file != STATE_FILE:
        _STORAGE_MANAGER = StorageIntegrityManager(DATA_DIR, STATE_FILE, LOCK)
    return _STORAGE_MANAGER


def get_canonical_manager() -> CanonicalManager:
    global _CANONICAL_MANAGER
    sm = get_storage_manager()
    if _CANONICAL_MANAGER is None or _CANONICAL_MANAGER.storage != sm:
        _CANONICAL_MANAGER = CanonicalManager(sm)
    return _CANONICAL_MANAGER


def load_state() -> dict[str, Any] | None:
    res = get_storage_manager().load_state()
    return res if res else None


def save_state(state: dict[str, Any]) -> dict[str, Any]:
    return get_storage_manager().save_state_atomic(state)


def get_products(state: dict[str, Any]) -> list[dict[str, Any]]:
    products = state.get("products", [])
    return products if isinstance(products, list) else []


# ===========================================================================
# TASK 2 — Product Normalization Pipeline
# ===========================================================================

# Configurable brand alias table
BRAND_ALIASES: dict[str, str] = {
    "apple inc": "Apple",
    "apple inc.": "Apple",
    "samsung electronics": "Samsung",
    "samsung elec": "Samsung",
    "lg electronics": "LG",
    "hewlett packard": "HP",
    "hewlett-packard": "HP",
    "h.p.": "HP",
    "international business machines": "IBM",
    "sony corporation": "Sony",
    "sony corp": "Sony",
    "microsoft corporation": "Microsoft",
    "msft": "Microsoft",
    "oneplus": "OnePlus",
    "one plus": "OnePlus",
    "poco": "Poco",
    "motorola mobility": "Motorola",
    "amazon.com": "Amazon",
    "google llc": "Google",
}

# Regex patterns for attribute extraction
_RE_MODEL_NUMBER = re.compile(
    r"\b([A-Z]{1,4}[-_]?[0-9]{2,6}[A-Z0-9]{0,6}|[0-9]{3,6}[A-Z]{1,6})\b",
    re.IGNORECASE,
)
_RE_STORAGE = re.compile(r"\b(\d+)\s*(gb|tb|mb)\b", re.IGNORECASE)
_RE_RAM = re.compile(r"\b(\d+)\s*gb\s*(ram|memory)\b", re.IGNORECASE)
_RE_SCREEN = re.compile(r"\b(\d+(?:\.\d+)?)\s*(inch|\")\b", re.IGNORECASE)
_RE_COLOR = re.compile(
    r"\b(black|white|red|blue|green|gold|silver|gray|grey|rose|purple|yellow"
    r"|pink|orange|navy|teal|coral|lavender|titanium|midnight|starlight|natural)\b",
    re.IGNORECASE,
)
_RE_UPC = re.compile(r"\b(\d{8,14})\b")
_RE_NOISE = re.compile(
    r"\b(free shipping|limited stock|hot sale|new arrival|brand new|genuine|"
    r"authentic|original|official|imported|warranty|pack of \d+|set of \d+|"
    r"combo|bundle|deal|offer)\b",
    re.IGNORECASE,
)
_RE_PAREN_BRACKET = re.compile(r"\[[^\]]*\]|\([^)]*\)")


def normalize_unicode(text: str) -> str:
    """Decompose Unicode, strip combining marks, normalize to NFC."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return unicodedata.normalize("NFC", text)


def normalize_text(value: Any) -> str:
    """
    Full normalization: Unicode, whitespace, case, punctuation, noise.
    Preserves digits and alphanumeric characters.
    """
    text = str(value or "").strip()
    text = normalize_unicode(text)
    text = text.lower()
    text = _RE_PAREN_BRACKET.sub(" ", text)
    text = _RE_NOISE.sub(" ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# Keep the legacy ``normalize`` name for backward compatibility with
# Phase 1 route helpers that still call it.
normalize = normalize_text


def normalize_brand(raw_brand: Any) -> str:
    """
    Normalize a brand name: check alias table, apply title-case.
    Returns 'Unknown' for empty/missing values.
    """
    if not raw_brand or str(raw_brand).strip().lower() in ("", "unknown"):
        return "Unknown"
    text = str(raw_brand).strip()
    lower = text.lower()
    if lower in BRAND_ALIASES:
        return BRAND_ALIASES[lower]
    # Partial prefix match
    for alias_key, canonical in BRAND_ALIASES.items():
        if lower.startswith(alias_key):
            return canonical
    return text.strip()


def normalize_identifier(raw_id: Any) -> str:
    """
    Normalize UPC / EAN / GTIN without losing leading zeros.
    Only strips surrounding whitespace and non-digit/non-alpha noise,
    but preserves the digit string as-is.
    """
    if not raw_id:
        return ""
    text = str(raw_id).strip()
    # Remove common prefixes like "UPC:", "EAN:", "GTIN:"
    text = re.sub(r"^(?:upc|ean|gtin|isbn|asin)[:\-\s]+", "", text, flags=re.IGNORECASE)
    # Keep only digits (identifiers are numeric)
    digits_only = re.sub(r"[^0-9]", "", text)
    return digits_only if digits_only else text.strip()


def extract_attributes(title: str, attributes: dict[str, str]) -> dict[str, str]:
    """
    Extract structured attributes from title and existing attribute dict.
    Merges extracted values with existing attributes (existing take precedence).
    """
    extracted: dict[str, str] = {}

    # Storage
    storage_match = _RE_STORAGE.search(title)
    if storage_match:
        qty, unit = storage_match.groups()
        extracted["storage"] = f"{qty} {unit.upper()}"

    # Screen size
    screen_match = _RE_SCREEN.search(title)
    if screen_match:
        extracted["screen_size"] = f"{screen_match.group(1)} inch"

    # Color
    color_match = _RE_COLOR.search(title)
    if color_match:
        extracted["color"] = color_match.group(1).title()

    # Merge: existing attributes override extracted ones
    merged = {k.lower(): str(v) for k, v in attributes.items()}
    for k, v in extracted.items():
        if k not in merged:
            merged[k] = v
    return merged


def build_normalized_record(product: dict[str, Any]) -> dict[str, Any]:
    """
    Build a fully normalized record from a raw product dict.
    Preserves original data; adds 'normalized' sub-keys.
    """
    title = str(product.get("title") or product.get("name") or "")
    brand = normalize_brand(product.get("brand"))
    model_raw = str(product.get("modelNumber") or product.get("model_number") or "")
    upc_raw = str(
        product.get("upcOrGtin")
        or product.get("upc_gtin")
        or product.get("upc")
        or ""
    )
    attrs = product.get("attributes", {})
    if not isinstance(attrs, dict):
        attrs = {}

    norm_title = normalize_text(title)
    norm_brand = normalize_text(brand)
    norm_model = normalize_text(model_raw)
    norm_upc = normalize_identifier(upc_raw)
    extracted_attrs = extract_attributes(title, attrs)

    # Token set for blocking
    title_tokens = set(t for t in norm_title.split() if len(t) >= 3)

    return {
        "norm_title": norm_title,
        "norm_brand": norm_brand,
        "norm_model": norm_model,
        "norm_upc": norm_upc,
        "canonical_brand": brand,
        "title_tokens": title_tokens,
        "extracted_attrs": extracted_attrs,
    }


# ===========================================================================
# TASK 3 — Candidate Generation
# ===========================================================================

class CandidateGenerator:
    """
    Generates candidate product pairs for comparison without O(n²) exhaustive search.

    Blocking strategies (applied in order, de-duplicated):
      1. Exact normalized UPC/GTIN match
      2. Exact normalized brand + model block
      3. Token-based title blocking (shared significant tokens)

    For catalogs with < MAX_EXHAUSTIVE products, falls back to full comparison.
    """

    MAX_EXHAUSTIVE = 200  # threshold under which we do full O(n²) comparison

    def __init__(
        self,
        products: list[dict[str, Any]],
        norm_cache: dict[str, dict[str, Any]],
        max_candidates: int = 5000,
    ) -> None:
        self._products = products
        self._norm = norm_cache
        self._max = max_candidates

    def _pid(self, p: dict[str, Any]) -> str:
        return str(p.get("id", ""))

    def generate(self) -> list[tuple[dict[str, Any], dict[str, Any]]]:
        products = self._products
        n = len(products)
        if n < 2:
            return []

        seen: set[frozenset[str]] = set()
        pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []

        def add_pair(a: dict[str, Any], b: dict[str, Any]) -> None:
            key = frozenset({self._pid(a), self._pid(b)})
            if key not in seen and self._pid(a) != self._pid(b):
                seen.add(key)
                pairs.append((a, b))

        if n <= self.MAX_EXHAUSTIVE:
            for i in range(n):
                for j in range(i + 1, n):
                    add_pair(products[i], products[j])
            return pairs

        # --- Blocking index build ---
        upc_index: dict[str, list[dict[str, Any]]] = {}
        brand_model_index: dict[str, list[dict[str, Any]]] = {}
        token_index: dict[str, list[dict[str, Any]]] = {}

        for p in products:
            pid = self._pid(p)
            nr = self._norm.get(pid, {})

            norm_upc = nr.get("norm_upc", "")
            if norm_upc and len(norm_upc) >= 8:
                upc_index.setdefault(norm_upc, []).append(p)

            brand = nr.get("norm_brand", "")
            model = nr.get("norm_model", "")
            if brand and brand not in ("unknown",) and model:
                bm_key = f"{brand}::{model}"
                brand_model_index.setdefault(bm_key, []).append(p)

            for token in nr.get("title_tokens", set()):
                if len(token) >= 4:
                    token_index.setdefault(token, []).append(p)

        # UPC block
        for bucket in upc_index.values():
            for i in range(len(bucket)):
                for j in range(i + 1, len(bucket)):
                    add_pair(bucket[i], bucket[j])

        # Brand+model block
        for bucket in brand_model_index.values():
            for i in range(len(bucket)):
                for j in range(i + 1, len(bucket)):
                    add_pair(bucket[i], bucket[j])

        # Token block (only pairs sharing multiple significant tokens)
        token_pair_count: dict[frozenset[str], int] = {}
        for token, bucket in token_index.items():
            if len(bucket) < 2 or len(bucket) > 100:
                continue
            for i in range(len(bucket)):
                for j in range(i + 1, len(bucket)):
                    pid_a, pid_b = self._pid(bucket[i]), self._pid(bucket[j])
                    if pid_a == pid_b:
                        continue
                    key = frozenset({pid_a, pid_b})
                    token_pair_count[key] = token_pair_count.get(key, 0) + 1

        # Require at least 2 shared tokens before adding from token index
        pid_to_product = {self._pid(p): p for p in products}
        for key, count in token_pair_count.items():
            if count >= 2 and len(pairs) < self._max:
                pid_list = list(key)
                if len(pid_list) == 2:
                    a = pid_to_product.get(pid_list[0])
                    b = pid_to_product.get(pid_list[1])
                    if a and b:
                        add_pair(a, b)

        return pairs[: self._max]


# ===========================================================================
# TASK 4 — Explainable Match Scoring
# ===========================================================================

class MatchingSettings(BaseModel):
    """Validated settings for the matching engine. All thresholds 0–1."""

    high_confidence_threshold: float = Field(default=0.85, ge=0.0, le=1.0)
    review_threshold: float = Field(default=0.55, ge=0.0, le=1.0)
    reject_below: float = Field(default=0.30, ge=0.0, le=1.0)

    # Feature weights (must not need to sum to 1; engine normalises)
    weight_upc: float = Field(default=0.40, ge=0.0, le=1.0)
    weight_model: float = Field(default=0.25, ge=0.0, le=1.0)
    weight_brand: float = Field(default=0.15, ge=0.0, le=1.0)
    weight_title: float = Field(default=0.15, ge=0.0, le=1.0)
    weight_attrs: float = Field(default=0.05, ge=0.0, le=1.0)

    # Penalty multipliers
    conflict_model_penalty: float = Field(default=0.60, ge=0.0, le=1.0)
    conflict_upc_penalty: float = Field(default=0.20, ge=0.0, le=1.0)
    unknown_brand_penalty: float = Field(default=0.92, ge=0.0, le=1.0)

    @field_validator("review_threshold")
    @classmethod
    def review_below_high(cls, v: float, info: Any) -> float:
        high = info.data.get("high_confidence_threshold", 0.85)
        if v >= high:
            raise ValueError("review_threshold must be below high_confidence_threshold")
        return v

    @field_validator("reject_below")
    @classmethod
    def reject_below_review(cls, v: float, info: Any) -> float:
        review = info.data.get("review_threshold", 0.55)
        if v >= review:
            raise ValueError("reject_below must be below review_threshold")
        return v


DEFAULT_SETTINGS = MatchingSettings()


def _seq_ratio(a: str, b: str) -> float:
    """SequenceMatcher ratio, 0–1."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _jaccard(set_a: set[str], set_b: set[str]) -> float:
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def score_pair(
    product_a: dict[str, Any],
    product_b: dict[str, Any],
    norm_a: dict[str, Any],
    norm_b: dict[str, Any],
    settings: MatchingSettings = DEFAULT_SETTINGS,
) -> dict[str, Any]:
    """
    Score a product pair and return a structured explanation.

    Returns
    -------
    dict with:
      - overall_score: float 0–1
      - feature_scores: dict of named component scores 0–1
      - positive_evidence: list[str]
      - conflicting_evidence: list[str]
      - explanation: str
      - recommended_action: 'auto_candidate' | 'review' | 'reject'
      - confidence_level: 'High' | 'Medium' | 'Low'
    """
    positive: list[str] = []
    conflicts: list[str] = []
    feature_scores: dict[str, float] = {}

    pid_a = str(product_a.get("id", ""))
    pid_b = str(product_b.get("id", ""))

    # --- UPC/GTIN ---
    upc_a = norm_a.get("norm_upc", "")
    upc_b = norm_b.get("norm_upc", "")
    upc_score = 0.0
    upc_conflict = False

    if upc_a and upc_b:
        if upc_a == upc_b:
            upc_score = 1.0
            positive.append(f"Exact UPC/GTIN match: {upc_a}")
        else:
            upc_score = 0.0
            upc_conflict = True
            conflicts.append(f"UPC/GTIN mismatch: {upc_a} vs {upc_b}")
    # Missing identifier → no evidence in either direction
    feature_scores["upc"] = upc_score

    # --- Brand ---
    brand_a = norm_a.get("norm_brand", "")
    brand_b = norm_b.get("norm_brand", "")
    brand_conflict = False

    if brand_a and brand_b and brand_a not in ("unknown",) and brand_b not in ("unknown",):
        if brand_a == brand_b:
            brand_score = 1.0
            positive.append(f"Brand agreement: {norm_a.get('canonical_brand', brand_a)}")
        else:
            brand_score = 0.0
            brand_conflict = True
            conflicts.append(
                f"Brand mismatch: '{norm_a.get('canonical_brand', brand_a)}' vs "
                f"'{norm_b.get('canonical_brand', brand_b)}'"
            )
    else:
        brand_score = 0.0  # missing brand → no positive evidence
    feature_scores["brand"] = brand_score

    # --- Model Number ---
    model_a = norm_a.get("norm_model", "")
    model_b = norm_b.get("norm_model", "")
    model_conflict = False

    if model_a and model_b:
        if model_a == model_b:
            model_score = 1.0
            positive.append(f"Model number agreement: {model_a}")
        else:
            # Partial model similarity — models differ
            raw_ratio = _seq_ratio(model_a, model_b)
            model_score = raw_ratio * 0.4
            # Treat clearly different model numbers as a conflict (ratio < 0.7)
            if raw_ratio < 0.7:
                model_conflict = True
                conflicts.append(
                    f"Model number mismatch: '{model_a}' vs '{model_b}'"
                )
    else:
        model_score = 0.0
    feature_scores["model"] = model_score

    # --- Title similarity ---
    title_a = norm_a.get("norm_title", "")
    title_b = norm_b.get("norm_title", "")
    tokens_a = norm_a.get("title_tokens", set())
    tokens_b = norm_b.get("title_tokens", set())

    seq_sim = _seq_ratio(title_a, title_b)
    jac_sim = _jaccard(tokens_a, tokens_b)
    title_score = 0.6 * seq_sim + 0.4 * jac_sim

    if title_score >= 0.80:
        positive.append(f"High title similarity: {title_score:.0%}")
    elif title_score >= 0.55:
        positive.append(f"Moderate title similarity: {title_score:.0%}")
    feature_scores["title"] = title_score

    # --- Attribute agreement ---
    attrs_a = norm_a.get("extracted_attrs", {})
    attrs_b = norm_b.get("extracted_attrs", {})
    shared_keys = set(attrs_a.keys()) & set(attrs_b.keys())
    attr_score = 0.0

    if shared_keys:
        agreements = 0.0
        for key in shared_keys:
            val_a = normalize_text(str(attrs_a[key]))
            val_b = normalize_text(str(attrs_b[key]))
            if val_a and val_b:
                if val_a == val_b:
                    agreements += 1
                    positive.append(f"Attribute agreement — {key}: {attrs_a[key]}")
                else:
                    sim = _seq_ratio(val_a, val_b)
                    # Flag as conflict when values differ substantially (sim < 0.7)
                    if sim < 0.7:
                        conflicts.append(
                            f"Attribute conflict — {key}: "
                            f"'{attrs_a[key]}' vs '{attrs_b[key]}'"
                        )
                    else:
                        agreements += 0.5
        attr_score = agreements / len(shared_keys)
    feature_scores["attrs"] = attr_score

    # --- Weighted combination ---
    w = settings
    weights = {
        "upc": w.weight_upc,
        "model": w.weight_model,
        "brand": w.weight_brand,
        "title": w.weight_title,
        "attrs": w.weight_attrs,
    }
    total_weight = sum(weights.values()) or 1.0
    raw_score = sum(feature_scores[k] * v for k, v in weights.items()) / total_weight

    # --- Apply conflict penalties ---
    if upc_conflict:
        raw_score *= w.conflict_upc_penalty
        conflicts.append("UPC conflict applied a strong score penalty.")
    if model_conflict and not upc_score:
        raw_score *= w.conflict_model_penalty
        conflicts.append("Model number conflict applied a score penalty.")
    if brand_conflict:
        raw_score *= 0.5  # different brands → strong negative signal

    # Unknown brand penalty
    if "unknown" in (brand_a, brand_b):
        raw_score *= w.unknown_brand_penalty

    # Title-only cap: prevent matching on title similarity alone
    # If neither UPC, model, nor brand provide positive evidence, cap score
    identifier_evidence = feature_scores["upc"] > 0 or feature_scores["model"] >= 0.8
    brand_evidence = feature_scores["brand"] >= 0.9
    if not identifier_evidence and not brand_evidence:
        raw_score = min(raw_score, 0.60)
        if raw_score > 0.50:
            conflicts.append(
                "Score capped: no identifier or brand agreement; "
                "title similarity alone is insufficient for a match."
            )

    overall = max(0.0, min(1.0, raw_score))

    # --- Recommendation ---
    if overall >= w.high_confidence_threshold:
        action = "auto_candidate"
        confidence = "High"
    elif overall >= w.review_threshold:
        action = "review"
        confidence = "Medium"
    else:
        action = "reject"
        confidence = "Low"

    # --- Human-readable explanation ---
    explanation_parts = []
    if upc_score == 1.0:
        explanation_parts.append("Products share an exact UPC/GTIN identifier.")
    if feature_scores["model"] == 1.0:
        explanation_parts.append("Model numbers are identical.")
    if feature_scores["brand"] == 1.0:
        explanation_parts.append(
            f"Both products are from the same brand ({norm_a.get('canonical_brand', brand_a)})."
        )
    if conflicts:
        explanation_parts.append(
            "Conflicts detected: " + "; ".join(conflicts[:3]) + "."
        )
    if not explanation_parts:
        explanation_parts.append(
            f"Title similarity {title_score:.0%} with no strong identifier agreement."
        )

    explanation = " ".join(explanation_parts)

    # Deterministic pair ID (stable across repeated runs)
    sorted_ids = sorted([pid_a, pid_b])
    pair_hash = hashlib.sha256("|".join(sorted_ids).encode()).hexdigest()[:16]
    pair_id = f"match-{pair_hash}"

    return {
        "id": pair_id,
        "productIdA": pid_a,
        "productIdB": pid_b,
        "overallScore": round(overall * 100, 2),        # 0–100 for UI compat
        "overallScoreNorm": round(overall, 4),          # 0–1 precise
        "featureScores": {k: round(v * 100, 2) for k, v in feature_scores.items()},
        # Legacy field names consumed by Phase 1 UI
        "titleScore": round(feature_scores["title"] * 100, 2),
        "brandScore": round(feature_scores["brand"] * 100, 2),
        "attributeScore": round(feature_scores["attrs"] * 100, 2),
        "imageScore": 0,
        "confidenceLevel": confidence,
        "positiveEvidence": positive,
        "conflictingEvidence": conflicts,
        "explanation": explanation,
        "recommendedAction": action,
        "detectedReason": (
            "Exact UPC/GTIN"
            if upc_score == 1.0
            else "Model + Brand agreement"
            if feature_scores["model"] >= 0.8 and feature_scores["brand"] >= 0.8
            else "Weighted multi-feature similarity"
        ),
    }


# ===========================================================================
# TASK 5 — Duplicate Detection & Clustering
# ===========================================================================

def run_duplicate_detection(
    products: list[dict[str, Any]],
    settings: MatchingSettings = DEFAULT_SETTINGS,
    max_candidates: int = 5000,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """
    Run full duplicate detection over the product catalog.

    Returns
    -------
    (match_pairs, duplicate_clusters, run_metadata)
    """
    if len(products) < 2:
        meta = {
            "runId": f"run-{uuid.uuid4().hex[:8]}",
            "timestamp": utc_now(),
            "productsScanned": len(products),
            "candidatesGenerated": 0,
            "pairsAboveReview": 0,
            "clustersFound": 0,
            "status": "completed",
            "message": "Fewer than 2 products; nothing to compare.",
        }
        return [], [], meta

    run_id = f"run-{uuid.uuid4().hex[:8]}"

    # Build normalization cache
    norm_cache: dict[str, dict[str, Any]] = {}
    for p in products:
        pid = str(p.get("id", ""))
        norm_cache[pid] = build_normalized_record(p)

    # Generate candidates
    generator = CandidateGenerator(products, norm_cache, max_candidates=max_candidates)
    candidate_pairs = generator.generate()

    pid_to_product = {str(p.get("id", "")): p for p in products}
    match_pairs: list[dict[str, Any]] = []
    above_review = 0

    for a, b in candidate_pairs:
        pid_a = str(a.get("id", ""))
        pid_b = str(b.get("id", ""))
        na = norm_cache.get(pid_a, build_normalized_record(a))
        nb = norm_cache.get(pid_b, build_normalized_record(b))

        result = score_pair(a, b, na, nb, settings)

        if result["overallScoreNorm"] < settings.reject_below:
            continue

        above_review += 1

        pair = {
            **result,
            "primaryProduct": a,
            "secondaryProduct": b,
            "matchStatus": "Pending Review",
            "reviewerDecision": None,
            "reviewedAt": None,
            "reviewedBy": None,
            "timestamp": utc_now(),
            "runId": run_id,
        }
        match_pairs.append(pair)

    # Sort by score descending
    match_pairs.sort(key=lambda x: x["overallScore"], reverse=True)

    # --- Cluster connected components (conservative — no transitive merges) ---
    # Build adjacency for pairs scoring above review threshold
    adjacency: dict[str, set[str]] = {}
    for pair in match_pairs:
        pid_a = pair["productIdA"]
        pid_b = pair["productIdB"]
        if pair["overallScoreNorm"] >= settings.review_threshold:
            adjacency.setdefault(pid_a, set()).add(pid_b)
            adjacency.setdefault(pid_b, set()).add(pid_a)

    # BFS connected components
    visited: set[str] = set()
    clusters: list[dict[str, Any]] = []

    for start_pid in list(adjacency.keys()):
        if start_pid in visited:
            continue
        component: list[str] = []
        queue = [start_pid]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            component.append(current)
            for neighbor in adjacency.get(current, set()):
                if neighbor not in visited:
                    queue.append(neighbor)

        if len(component) < 2:
            continue

        # Compute average similarity within cluster
        cluster_products = [pid_to_product[pid] for pid in component if pid in pid_to_product]
        if len(cluster_products) < 2:
            continue

        scores_in_cluster = [
            p["overallScore"]
            for p in match_pairs
            if p["productIdA"] in component and p["productIdB"] in component
        ]
        avg_sim = round(sum(scores_in_cluster) / len(scores_in_cluster), 1) if scores_in_cluster else 0.0

        # Cluster representative title = longest title
        rep = max(cluster_products, key=lambda p: len(str(p.get("title", ""))))
        rep_brand = str(rep.get("brand", "Unknown"))
        rep_category = str(rep.get("category", "Uncategorized"))

        cluster_id_hash = hashlib.sha256(
            "|".join(sorted(component)).encode()
        ).hexdigest()[:12]

        clusters.append({
            "id": f"clus-{cluster_id_hash}",
            "canonicalTitle": str(rep.get("title", "")),
            "brand": rep_brand,
            "category": rep_category,
            "items": cluster_products,
            "averageSimilarity": avg_sim,
            "status": "Active Redundancy",
            "potentialSavingsEstimate": 0,  # real estimate requires pricing logic
            "productIds": component,
        })

    run_meta = {
        "runId": run_id,
        "timestamp": utc_now(),
        "productsScanned": len(products),
        "candidatesGenerated": len(candidate_pairs),
        "pairsAboveReview": above_review,
        "clustersFound": len(clusters),
        "status": "completed",
    }

    return match_pairs, clusters, run_meta


# ===========================================================================
# Pydantic request / response models
# ===========================================================================

class StatePayload(BaseModel):
    state: dict[str, Any]


class ComparePayload(BaseModel):
    products: list[dict[str, Any]] = Field(min_length=2, max_length=500)
    threshold: float = Field(default=65, ge=0, le=100)


class ProductPayload(BaseModel):
    product: dict[str, Any]


class RunMatchingPayload(BaseModel):
    settings: dict[str, Any] | None = None
    max_candidates: int = Field(default=5000, ge=10, le=50000)
    # When True, merges new run results with existing decisions (preserving
    # Approved/Rejected pairs) rather than replacing everything.
    incremental: bool = False


class ReviewDecisionPayload(BaseModel):
    decision: str  # 'approved' | 'rejected'
    reviewer: str = "api_user"
    notes: str = ""

    @field_validator("decision")
    @classmethod
    def valid_decision(cls, v: str) -> str:
        if v.lower() not in ("approved", "rejected"):
            raise ValueError("decision must be 'approved' or 'rejected'")
        return v.lower()


class MatchSettingsPayload(BaseModel):
    settings: dict[str, Any]


# ===========================================================================
# Phase 1 helper — canonicalize_product (unchanged, backward compat)
# ===========================================================================

def product_fingerprint(product: dict[str, Any]) -> str:
    identity = "|".join([
        normalize_text(product.get("brand")),
        normalize_text(product.get("modelNumber") or product.get("model_number")),
        normalize_identifier(product.get("upcOrGtin") or product.get("upc_gtin")),
        normalize_text(product.get("title")),
    ])
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def similarity(left: Any, right: Any) -> float:
    """Legacy helper — kept for Phase 1 /compare route."""
    a, b = normalize_text(left), normalize_text(right)
    if not a or not b:
        return 0.0
    return round(100 * SequenceMatcher(None, a, b).ratio(), 2)


def canonicalize_product(raw: dict[str, Any]) -> dict[str, Any]:
    title = raw.get("title") or raw.get("name")
    if not title or not str(title).strip():
        raise ValueError("Each product must include a non-empty title.")
    now = utc_now()
    attrs = raw.get("attributes", {})
    if isinstance(attrs, str):
        attrs = {"Specifications": attrs}
    if not isinstance(attrs, dict):
        attrs = {}
    price = raw.get("price", 0)
    try:
        price = float(str(price).replace(",", "").replace("₹", "").strip() or 0)
    except ValueError as exc:
        raise ValueError(f"Invalid price for product '{title}'.") from exc
    item = {
        "id": str(raw.get("id") or f"prod-{uuid.uuid4().hex[:12]}"),
        "title": str(title).strip(),
        "rawTitle": str(raw.get("rawTitle") or raw.get("raw_title") or title).strip(),
        "brand": normalize_brand(raw.get("brand")),
        "modelNumber": str(raw.get("modelNumber") or raw.get("model_number") or ""),
        "category": str(raw.get("category") or "Uncategorized"),
        "subCategory": str(raw.get("subCategory") or raw.get("subcategory") or ""),
        "upcOrGtin": normalize_identifier(
            raw.get("upcOrGtin") or raw.get("upc_gtin") or raw.get("upc") or ""
        ),
        "price": max(0, price),
        "currency": str(raw.get("currency") or "₹"),
        "imageUrl": str(raw.get("imageUrl") or raw.get("image_url") or ""),
        "source": str(raw.get("source") or "Manual Ingestion"),
        "sourceSku": str(raw.get("sourceSku") or raw.get("source_sku") or ""),
        "rating": float(raw.get("rating") or 0),
        "reviewsCount": int(raw.get("reviewsCount") or raw.get("reviews_count") or 0),
        "status": str(raw.get("status") or "Unmatched"),
        "attributes": {str(k): str(v) for k, v in attrs.items()},
        "createdAt": str(raw.get("createdAt") or raw.get("created_at") or now),
        "fingerprintHash": str(raw.get("fingerprintHash") or product_fingerprint(raw)),
    }
    for key in ("canonicalId", "matchScore", "sellerOffers"):
        if key == "canonicalId" and raw.get("canonical_id") is not None:
            item[key] = raw["canonical_id"]
        elif key == "matchScore" and raw.get("match_score") is not None:
            item[key] = raw["match_score"]
        elif raw.get(key) is not None:
            item[key] = raw[key]
    return item


def read_upload(filename: str, content: bytes) -> list[dict[str, Any]]:
    suffix = Path(filename.lower()).suffix
    try:
        if suffix == ".json":
            data = json.loads(content.decode("utf-8-sig"))
            if isinstance(data, dict):
                data = data.get("products", data.get("items", [data]))
            if not isinstance(data, list):
                raise ValueError(
                    "JSON must be a list of products or an object containing a products/items list."
                )
            return data
        if suffix == ".csv":
            decoded = content.decode("utf-8-sig")
            return list(csv.DictReader(io.StringIO(decoded)))
        if suffix == ".xlsx":
            from openpyxl import load_workbook  # lazy import

            workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            sheet = workbook.active
            rows = sheet.iter_rows(values_only=True)
            headers = [str(x).strip() if x is not None else "" for x in next(rows, [])]
            return [dict(zip(headers, row)) for row in rows if any(v is not None for v in row)]
    except (UnicodeDecodeError, json.JSONDecodeError, csv.Error, StopIteration) as exc:
        raise ValueError(f"Could not parse {filename}: {exc}") from exc
    except ImportError as exc:
        raise ValueError("Excel support is unavailable. Install openpyxl.") from exc
    raise ValueError("Unsupported file type. Upload CSV, JSON or XLSX.")


# ===========================================================================
# Phase 1 routes (preserved — backward compatible)
# ===========================================================================

@app.get("/")
def root():
    return {"name": "Entity Resolution Platform API", "status": "ok", "docs": "/docs", "version": "2.0.0"}


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "storage": "json-file",
        "dataFileExists": STATE_FILE.exists(),
        "timestamp": utc_now(),
    }


@app.get("/api/state")
def get_application_state():
    return {"state": load_state()}


@app.put("/api/state")
def put_application_state(payload: StatePayload):
    state = payload.state
    for key in ("products", "matchPairs", "duplicateClusters", "sellerFeeds", "auditLogs", "notifications"):
        if key in state and not isinstance(state[key], list):
            raise HTTPException(status_code=422, detail=f"'{key}' must be a list.")
    result = save_state(state)
    return {**result, "state": state}


@app.get("/api/products")
def list_products(q: str | None = None, limit: int = 500, offset: int = 0):
    state = load_state() or {}
    products = get_products(state)
    if q:
        query = normalize_text(q)
        products = [
            p
            for p in products
            if query
            in normalize_text(
                " ".join(
                    [
                        str(p.get("title", "")),
                        str(p.get("brand", "")),
                        str(p.get("modelNumber", "")),
                        str(p.get("category", "")),
                    ]
                )
            )
        ]
    return {"items": products[offset: offset + min(max(limit, 1), 1000)], "total": len(products)}


@app.post("/api/products", status_code=201)
def create_product(payload: ProductPayload):
    try:
        product = canonicalize_product(payload.product)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    state = load_state() or {}
    products = get_products(state)
    if any(p.get("id") == product["id"] for p in products):
        product["id"] = f"prod-{uuid.uuid4().hex[:12]}"
    products.insert(0, product)
    state["products"] = products
    state.setdefault("auditLogs", []).insert(
        0,
        {
            "id": f"log-{uuid.uuid4().hex[:10]}",
            "timestamp": utc_now(),
            "user": "api",
            "action": "Product Created",
            "target": product["title"],
            "details": "Product created through the backend API.",
            "type": "import",
        },
    )
    save_state(state)
    return product


@app.put("/api/products/{product_id}")
def update_product(product_id: str, payload: ProductPayload):
    state = load_state() or {}
    products = get_products(state)
    index = next((i for i, p in enumerate(products) if p.get("id") == product_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="Product not found.")
    try:
        product = canonicalize_product({**products[index], **payload.product, "id": product_id})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    products[index] = product
    state["products"] = products
    save_state(state)
    return product


@app.delete("/api/products/{product_id}")
def delete_product(product_id: str):
    state = load_state() or {}
    products = get_products(state)
    remaining = [p for p in products if p.get("id") != product_id]
    if len(remaining) == len(products):
        raise HTTPException(status_code=404, detail="Product not found.")
    state["products"] = remaining
    save_state(state)
    return {"deleted": True, "id": product_id}


@app.post("/api/matching/compare")
def compare_products(payload: ComparePayload):
    """
    Phase 1-compatible compare endpoint, now backed by the Phase 2 scoring engine.
    Returns items matching the legacy MatchCandidatePair shape.
    """
    items = []
    for p in payload.products:
        try:
            items.append(canonicalize_product(p))
        except ValueError:
            continue

    norm_cache = {str(p.get("id", "")): build_normalized_record(p) for p in items}
    threshold_norm = payload.threshold / 100.0
    results = []

    for i, first in enumerate(items):
        for second in items[i + 1:]:
            pid_a = str(first.get("id", ""))
            pid_b = str(second.get("id", ""))
            na = norm_cache.get(pid_a, build_normalized_record(first))
            nb = norm_cache.get(pid_b, build_normalized_record(second))
            scored = score_pair(first, second, na, nb)

            if scored["overallScoreNorm"] >= threshold_norm:
                results.append({
                    **scored,
                    "primaryProduct": first,
                    "secondaryProduct": second,
                    "matchStatus": "Pending Review",
                    "timestamp": utc_now(),
                })

    results.sort(key=lambda x: x["overallScore"], reverse=True)
    return {"items": results, "count": len(results), "threshold": payload.threshold}


@app.post("/api/ingest/upload")
async def ingest_upload(file: UploadFile = File(...), commit: bool = False):
    filename = file.filename or "upload"
    if Path(filename).suffix.lower() not in {".csv", ".json", ".xlsx"}:
        raise HTTPException(status_code=415, detail="Supported formats: CSV, JSON and XLSX.")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Upload exceeds the 15 MB limit.")
    try:
        raw_items = read_upload(filename, content)
        products = [canonicalize_product(item) for item in raw_items]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if commit:
        state = load_state() or {}
        existing = get_products(state)
        seen = {p.get("fingerprintHash") for p in existing}
        unique = []
        for product in products:
            if product["fingerprintHash"] not in seen:
                unique.append(product)
                seen.add(product["fingerprintHash"])
        state["products"] = unique + existing
        state.setdefault("auditLogs", []).insert(
            0,
            {
                "id": f"log-{uuid.uuid4().hex[:10]}",
                "timestamp": utc_now(),
                "user": "batch_uploader",
                "action": "Batch Catalog Ingestion",
                "target": f"{len(unique)} products ingested",
                "details": (
                    f"Imported from {filename}; "
                    f"skipped {len(products)-len(unique)} duplicate fingerprints."
                ),
                "type": "import",
            },
        )
        save_state(state)
        return {
            "filename": filename,
            "parsed": len(products),
            "inserted": len(unique),
            "skippedDuplicates": len(products) - len(unique),
            "products": unique,
            "committed": True,
        }
    return {"filename": filename, "parsed": len(products), "products": products, "committed": False}


@app.get("/api/analytics/summary")
def analytics_summary():
    state = load_state() or {}
    products = get_products(state)
    pairs = state.get("matchPairs", [])
    clusters = state.get("duplicateClusters", [])
    canonicals = state.get("canonicalProducts", [])
    can_count = len(canonicals) if canonicals else sum(p.get("status") == "Canonical Master" for p in products)
    return {
        "totalProducts": len(products),
        "canonicalProducts": can_count,
        "pendingMatches": sum(p.get("matchStatus") == "Pending Review" for p in pairs),
        "approvedMatches": sum(p.get("matchStatus") == "Approved" for p in pairs),
        "resolvedClusters": sum(c.get("status") == "Resolved" for c in clusters),
        "activeClusters": sum(c.get("status") != "Resolved" for c in clusters),
        "auditEvents": len(state.get("auditLogs", [])),
        "storage": "json-file",
    }


# ===========================================================================
# Phase 2 — NEW ROUTES
# ===========================================================================

# ---------------------------------------------------------------------------
# TASK 6 — Matching settings management
# ---------------------------------------------------------------------------

@app.get("/api/matching/settings")
def get_matching_settings():
    state = load_state() or {}
    stored = state.get("matchingSettings", {})
    try:
        settings = MatchingSettings(**stored) if stored else DEFAULT_SETTINGS
    except Exception:
        settings = DEFAULT_SETTINGS
    return settings.model_dump()


@app.put("/api/matching/settings")
def update_matching_settings(payload: MatchSettingsPayload):
    try:
        settings = MatchingSettings(**payload.settings)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid settings: {exc}") from exc
    state = load_state() or {}
    state["matchingSettings"] = settings.model_dump()
    save_state(state)
    return settings.model_dump()


# ---------------------------------------------------------------------------
# TASK 5+6 — Full catalog matching run
# ---------------------------------------------------------------------------

@app.post("/api/matching/run")
def run_matching(payload: RunMatchingPayload):
    """
    Run full entity-resolution over the persisted product catalog.

    - Generates candidate pairs using blocking.
    - Scores each pair with the explainable engine.
    - Persists match pairs and duplicate clusters.
    - Idempotent: repeated runs update scores; Approved/Rejected decisions
      are preserved when incremental=True.
    - Prevents concurrent runs via a module-level lock.
    """
    if not _MATCHING_LOCK.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail="A matching run is already in progress. Please wait and retry.",
        )
    try:
        state = load_state() or {}
        products = get_products(state)

        if len(products) < 2:
            raise HTTPException(
                status_code=422,
                detail="At least 2 products are required to run entity matching.",
            )

        # Load settings
        stored_settings = state.get("matchingSettings", {})
        if payload.settings:
            stored_settings.update(payload.settings)
        try:
            settings = MatchingSettings(**stored_settings)
        except Exception:
            settings = DEFAULT_SETTINGS

        new_pairs, new_clusters, run_meta = run_duplicate_detection(
            products, settings, max_candidates=payload.max_candidates
        )

        # Preserve reviewer decisions if incremental
        if payload.incremental:
            old_pairs: dict[str, dict[str, Any]] = {
                p["id"]: p for p in state.get("matchPairs", []) if "id" in p
            }
            for pair in new_pairs:
                old = old_pairs.get(pair["id"])
                if old and old.get("matchStatus") in ("Approved", "Rejected"):
                    pair["matchStatus"] = old["matchStatus"]
                    pair["reviewerDecision"] = old.get("reviewerDecision")
                    pair["reviewedAt"] = old.get("reviewedAt")
                    pair["reviewedBy"] = old.get("reviewedBy")

            # Also preserve status of old clusters
            old_clusters: dict[str, dict[str, Any]] = {
                c["id"]: c for c in state.get("duplicateClusters", []) if "id" in c
            }
            for cluster in new_clusters:
                old_c = old_clusters.get(cluster["id"])
                if old_c and old_c.get("status") == "Resolved":
                    cluster["status"] = "Resolved"

        state["matchPairs"] = new_pairs
        state["duplicateClusters"] = new_clusters
        state.setdefault("matchingRunHistory", []).insert(0, run_meta)
        # Keep only last 20 run records
        state["matchingRunHistory"] = state["matchingRunHistory"][:20]

        state.setdefault("auditLogs", []).insert(
            0,
            {
                "id": f"log-{uuid.uuid4().hex[:10]}",
                "timestamp": utc_now(),
                "user": "matching_engine",
                "action": "Backend Entity Matching Run",
                "target": f"{len(products)} catalog products",
                "details": (
                    f"Run {run_meta['runId']}: {run_meta['candidatesGenerated']} candidates generated, "
                    f"{len(new_pairs)} pairs scored, {len(new_clusters)} duplicate clusters found."
                ),
                "type": "verification",
            },
        )

        save_state(state)
        return {
            "runMetadata": run_meta,
            "pairsCount": len(new_pairs),
            "clustersCount": len(new_clusters),
            "matchPairs": new_pairs,
            "duplicateClusters": new_clusters,
        }
    finally:
        _MATCHING_LOCK.release()


# ---------------------------------------------------------------------------
# TASK 6 — Match review workflow
# ---------------------------------------------------------------------------

@app.get("/api/matching/candidates")
def list_match_candidates(
    status: str | None = Query(None, description="Filter by matchStatus"),
    confidence: str | None = Query(None, description="Filter by confidenceLevel"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    min_score: float = Query(0.0, ge=0.0, le=100.0),
):
    state = load_state() or {}
    pairs = state.get("matchPairs", [])
    if not isinstance(pairs, list):
        pairs = []

    if status and status != "All":
        pairs = [p for p in pairs if p.get("matchStatus") == status]
    if confidence and confidence != "All":
        pairs = [p for p in pairs if p.get("confidenceLevel") == confidence]
    if min_score > 0:
        pairs = [p for p in pairs if p.get("overallScore", 0) >= min_score]

    total = len(pairs)
    page = pairs[offset: offset + limit]
    return {"items": page, "total": total, "limit": limit, "offset": offset}


@app.get("/api/matching/candidates/{pair_id}")
def get_match_candidate(pair_id: str):
    state = load_state() or {}
    pairs = state.get("matchPairs", [])
    pair = next((p for p in pairs if p.get("id") == pair_id), None)
    if not pair:
        raise HTTPException(status_code=404, detail=f"Match candidate '{pair_id}' not found.")
    return pair


@app.post("/api/matching/candidates/{pair_id}/decision")
def record_match_decision(pair_id: str, payload: ReviewDecisionPayload):
    """
    Record a reviewer decision (approved / rejected) on a match candidate.
    Prevents repeated decisions from corrupting state — re-posting the same
    decision is idempotent; changing a decision raises 409.
    """
    state = load_state() or {}
    pairs: list[dict[str, Any]] = state.get("matchPairs", [])

    pair_index = next((i for i, p in enumerate(pairs) if p.get("id") == pair_id), None)
    if pair_index is None:
        raise HTTPException(status_code=404, detail=f"Match candidate '{pair_id}' not found.")

    pair = pairs[pair_index]
    existing_status = pair.get("matchStatus", "Pending Review")
    new_status = "Approved" if payload.decision == "approved" else "Rejected"

    # Idempotency: same decision again → 200 OK
    if existing_status == new_status:
        return pair

    # Prevent overwriting a finalised decision
    if existing_status in ("Approved", "Rejected"):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Candidate already has status '{existing_status}'. "
                "Create a manual override to change a finalised decision."
            ),
        )

    pair["matchStatus"] = new_status
    pair["reviewerDecision"] = payload.decision
    pair["reviewedAt"] = utc_now()
    pair["reviewedBy"] = payload.reviewer
    if payload.notes:
        pair["reviewerNotes"] = payload.notes

    pairs[pair_index] = pair
    state["matchPairs"] = pairs

    state.setdefault("auditLogs", []).insert(
        0,
        {
            "id": f"log-{uuid.uuid4().hex[:10]}",
            "timestamp": utc_now(),
            "user": payload.reviewer,
            "action": f"Match {new_status}",
            "target": pair_id,
            "details": (
                f"Reviewer '{payload.reviewer}' marked candidate as {new_status}. "
                + (f"Notes: {payload.notes}" if payload.notes else "")
            ),
            "type": "verification",
        },
    )
    save_state(state)
    return pair


@app.post("/api/matching/candidates/{pair_id}/override")
def override_match_decision(pair_id: str, payload: ReviewDecisionPayload):
    """
    Force-override a finalised decision. Records the override separately in audit log.
    """
    state = load_state() or {}
    pairs: list[dict[str, Any]] = state.get("matchPairs", [])

    pair_index = next((i for i, p in enumerate(pairs) if p.get("id") == pair_id), None)
    if pair_index is None:
        raise HTTPException(status_code=404, detail=f"Match candidate '{pair_id}' not found.")

    pair = pairs[pair_index]
    previous_status = pair.get("matchStatus", "Pending Review")
    new_status = "Approved" if payload.decision == "approved" else "Rejected"

    pair["matchStatus"] = new_status
    pair["reviewerDecision"] = payload.decision
    pair["reviewedAt"] = utc_now()
    pair["reviewedBy"] = payload.reviewer
    pair["manualOverride"] = True
    pair["previousStatus"] = previous_status
    if payload.notes:
        pair["reviewerNotes"] = payload.notes

    pairs[pair_index] = pair
    state["matchPairs"] = pairs

    state.setdefault("auditLogs", []).insert(
        0,
        {
            "id": f"log-{uuid.uuid4().hex[:10]}",
            "timestamp": utc_now(),
            "user": payload.reviewer,
            "action": f"Manual Override — {new_status}",
            "target": pair_id,
            "details": (
                f"Previous status '{previous_status}' overridden to '{new_status}' "
                f"by '{payload.reviewer}'. Notes: {payload.notes or 'none'}"
            ),
            "type": "override",
        },
    )
    save_state(state)
    return pair


# ---------------------------------------------------------------------------
# Duplicate cluster review
# ---------------------------------------------------------------------------

@app.get("/api/duplicates")
def list_duplicate_clusters(
    status: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    state = load_state() or {}
    clusters = state.get("duplicateClusters", [])
    if not isinstance(clusters, list):
        clusters = []
    if status and status != "All":
        clusters = [c for c in clusters if c.get("status") == status]
    total = len(clusters)
    return {"items": clusters[offset: offset + limit], "total": total}


@app.post("/api/duplicates/{cluster_id}/resolve")
def resolve_duplicate_cluster(cluster_id: str, reviewer: str = "api_user"):
    """Mark a duplicate cluster as Resolved."""
    state = load_state() or {}
    clusters: list[dict[str, Any]] = state.get("duplicateClusters", [])
    idx = next((i for i, c in enumerate(clusters) if c.get("id") == cluster_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_id}' not found.")
    cluster = clusters[idx]
    if cluster.get("status") == "Resolved":
        return cluster  # idempotent
    cluster["status"] = "Resolved"
    cluster["resolvedAt"] = utc_now()
    cluster["resolvedBy"] = reviewer
    clusters[idx] = cluster
    state["duplicateClusters"] = clusters
    state.setdefault("auditLogs", []).insert(
        0,
        {
            "id": f"log-{uuid.uuid4().hex[:10]}",
            "timestamp": utc_now(),
            "user": reviewer,
            "action": "Resolved Duplicate Cluster",
            "target": cluster.get("canonicalTitle", cluster_id),
            "details": f"Cluster '{cluster_id}' marked as resolved by '{reviewer}'.",
            "type": "merge",
        },
    )
    save_state(state)
    return cluster


# ---------------------------------------------------------------------------
# Matching run history
# ---------------------------------------------------------------------------

@app.get("/api/matching/runs")
def list_matching_runs(limit: int = Query(10, ge=1, le=50)):
    state = load_state() or {}
    history = state.get("matchingRunHistory", [])
    return {"items": history[:limit], "total": len(history)}


# ===========================================================================
# Phase 3 — CANONICAL PRODUCT & AUDIT ROUTES
# ===========================================================================

# ---------------------------------------------------------------------------
# TASK 3 — Canonical Product CRUD
# ---------------------------------------------------------------------------

@app.get("/api/canonical")
def list_canonical_products(
    q: str | None = None,
    brand: str | None = None,
    category: str | None = None,
    status: str | None = "active",
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    mgr = get_canonical_manager()
    return mgr.list_canonical_products(
        q=q, brand=brand, category=category, status=status, limit=limit, offset=offset
    )


@app.get("/api/canonical/{canonical_id}")
def get_canonical_product(canonical_id: str, follow_redirect: bool = False):
    mgr = get_canonical_manager()
    return mgr.get_canonical_product(canonical_id, follow_redirect=follow_redirect)


@app.post("/api/canonical", status_code=201)
def create_canonical_product(payload: CanonicalProductCreate):
    mgr = get_canonical_manager()
    return mgr.create_canonical_product(payload)


@app.put("/api/canonical/{canonical_id}")
def update_canonical_product(canonical_id: str, payload: CanonicalProductUpdate):
    mgr = get_canonical_manager()
    return mgr.update_canonical_product(canonical_id, payload)


@app.delete("/api/canonical/{canonical_id}")
def archive_canonical_product_delete(
    canonical_id: str,
    reviewer: str = Query("unauthenticated_reviewer"),
    reason: str = Query("Archived canonical product"),
):
    mgr = get_canonical_manager()
    return mgr.archive_canonical_product(canonical_id, reviewer=reviewer, reason=reason)


@app.post("/api/canonical/{canonical_id}/archive")
def archive_canonical_product_post(
    canonical_id: str,
    reviewer: str = "unauthenticated_reviewer",
    reason: str = "Archived canonical product",
):
    mgr = get_canonical_manager()
    return mgr.archive_canonical_product(canonical_id, reviewer=reviewer, reason=reason)


@app.get("/api/canonical/{canonical_id}/sources")
def get_canonical_sources(canonical_id: str):
    mgr = get_canonical_manager()
    return mgr.get_canonical_sources(canonical_id)


@app.get("/api/canonical/{canonical_id}/history")
def get_canonical_history(canonical_id: str):
    mgr = get_canonical_manager()
    return mgr.get_canonical_history(canonical_id)


# ---------------------------------------------------------------------------
# TASK 4 — Safe Merge Operations
# ---------------------------------------------------------------------------

@app.post("/api/canonical/merge")
def merge_canonical_products(payload: CanonicalMergeRequest):
    mgr = get_canonical_manager()
    return mgr.execute_merge(payload)


# ---------------------------------------------------------------------------
# TASK 5 — Safe Split and Undo Operations
# ---------------------------------------------------------------------------

@app.post("/api/canonical/{canonical_id}/split")
def split_canonical_product(canonical_id: str, payload: CanonicalSplitRequest):
    mgr = get_canonical_manager()
    return mgr.execute_split(canonical_id, payload)


@app.post("/api/canonical/{canonical_id}/undo-merge")
def undo_merge_canonical_product(canonical_id: str, payload: CanonicalUndoMergeRequest = CanonicalUndoMergeRequest()):
    mgr = get_canonical_manager()
    return mgr.execute_undo_merge(canonical_id, payload)


# ---------------------------------------------------------------------------
# TASK 6 — Source Listing Management
# ---------------------------------------------------------------------------

@app.post("/api/canonical/{canonical_id}/sources/attach")
def attach_source_to_canonical(canonical_id: str, payload: SourceAttachRequest):
    mgr = get_canonical_manager()
    return mgr.attach_source_listing(canonical_id, payload)


@app.post("/api/canonical/{canonical_id}/sources/detach")
def detach_source_from_canonical(canonical_id: str, payload: SourceDetachRequest):
    mgr = get_canonical_manager()
    return mgr.detach_source_listing(canonical_id, payload)


# ---------------------------------------------------------------------------
# TASK 7 — Unified Audit History
# ---------------------------------------------------------------------------

@app.get("/api/audit")
def list_audit_logs(
    entity_id: str | None = Query(None, description="Filter by affected entity ID"),
    action_type: str | None = Query(None, description="Filter by action category"),
    user: str | None = Query(None, description="Filter by reviewer/actor"),
    start_time: str | None = Query(None),
    end_time: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    mgr = get_canonical_manager()
    return mgr.list_audit_events(
        entity_id=entity_id,
        action_type=action_type,
        user=user,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )

