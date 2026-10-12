"""
Phase 3 Backend Tests — Entity Resolution Platform
===================================================
Tests for:
  - Canonical Product Model & Validation (Task 2)
  - Canonical Product CRUD, Search & Sources (Task 3)
  - Safe Merge Operations with Conflict & Cycle Checks (Task 4)
  - Safe Split and Compensating Undo Operations (Task 5)
  - Source Listing Attachment & Detachment (Task 6)
  - Unified Audit History with Snapshots (Task 7)
  - Storage Integrity, Journaling & Crash Recovery (Task 8)
  - Concurrent Mutations & Idempotency Safeguards
  - Backward Compatibility
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Set up isolated temporary storage per test run
# ---------------------------------------------------------------------------
_TMP_DATA_DIR = tempfile.mkdtemp()
os.environ["APP_DATA_DIR"] = _TMP_DATA_DIR

import main
from main import app, get_canonical_manager, get_storage_manager

# Wire client
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_storage():
    """Wipes and reinitializes temporary test storage before each test."""
    p = Path(_TMP_DATA_DIR)
    if p.exists():
        for item in p.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                try:
                    item.unlink()
                except OSError:
                    pass
    (p / "backups").mkdir(parents=True, exist_ok=True)
    yield


def _seed(products=None, canonicals=None, pairs=None, audits=None):
    state = {
        "products": products or [],
        "canonicalProducts": canonicals or [],
        "matchPairs": pairs or [],
        "duplicateClusters": [],
        "sellerFeeds": [],
        "auditLogs": audits or [],
        "notifications": [],
        "_revision": 1,
    }
    main.save_state(state)
    return state


def _make_prod(pid: str, title: str, brand="Apple", upc="", model="", price=1000.0, attrs=None):
    return {
        "id": pid,
        "title": title,
        "brand": brand,
        "upcOrGtin": upc,
        "modelNumber": model,
        "category": "Smartphones",
        "price": price,
        "currency": "₹",
        "source": "Amazon",
        "sourceSku": f"SKU-{pid}",
        "rating": 4.5,
        "reviewsCount": 10,
        "status": "Unmatched",
        "attributes": attrs or {},
        "fingerprintHash": f"hash-{pid}",
    }


# ===========================================================================
# TASK 2 & 3 — Canonical Product CRUD & Search
# ===========================================================================

class TestCanonicalProductCRUD:
    def test_create_canonical_product(self):
        payload = {
            "title": "Apple iPhone 15 Pro Max 256GB",
            "brand": "Apple",
            "category": "Smartphones",
            "modelNumber": "MU773LL/A",
            "upcOrGtin": "195949038297",
            "price": 134900,
            "attributes": {"Storage": "256GB", "Color": "Titanium"},
            "reviewer": "test_curator",
            "reason": "New flagship catalog master"
        }
        r = client.post("/api/canonical", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["id"].startswith("can-")
        assert data["title"] == "Apple iPhone 15 Pro Max 256GB"
        assert data["normalizedTitle"] == "apple iphone 15 pro max 256gb"
        assert data["brand"] == "Apple"
        assert data["status"] == "active"
        assert data["version"] == 1

    def test_create_canonical_product_empty_title_fails(self):
        r = client.post("/api/canonical", json={"title": "   "})
        # Should fail validation (422)
        assert r.status_code == 422

    def test_get_canonical_product(self):
        r = client.post("/api/canonical", json={"title": "Sony WH-1000XM5", "brand": "Sony"})
        can_id = r.json()["id"]

        fetch_r = client.get(f"/api/canonical/{can_id}")
        assert fetch_r.status_code == 200
        assert fetch_r.json()["id"] == can_id
        assert fetch_r.json()["title"] == "Sony WH-1000XM5"

    def test_get_nonexistent_canonical_404(self):
        r = client.get("/api/canonical/can-nonexistent")
        assert r.status_code == 404

    def test_update_canonical_product(self):
        r = client.post("/api/canonical", json={"title": "MacBook Air M2", "brand": "Apple", "price": 99900})
        can_id = r.json()["id"]
        version = r.json()["version"]

        update_r = client.put(f"/api/canonical/{can_id}", json={
            "title": "MacBook Air 13-inch M2 (Midnight)",
            "price": 94900,
            "version": version
        })
        assert update_r.status_code == 200
        updated = update_r.json()
        assert updated["title"] == "MacBook Air 13-inch M2 (Midnight)"
        assert updated["price"] == 94900
        assert updated["version"] == version + 1

    def test_update_version_conflict_409(self):
        r = client.post("/api/canonical", json={"title": "Galaxy Tab S9", "brand": "Samsung"})
        can_id = r.json()["id"]

        # Pass wrong version
        update_r = client.put(f"/api/canonical/{can_id}", json={
            "title": "Stale Update",
            "version": 999
        })
        assert update_r.status_code == 409

    def test_archive_canonical_product(self):
        r = client.post("/api/canonical", json={"title": "Obsolete SKU", "brand": "Generic"})
        can_id = r.json()["id"]

        del_r = client.delete(f"/api/canonical/{can_id}?reason=End-of-life")
        assert del_r.status_code == 200
        assert del_r.json()["status"] == "archived"

        # Verify not returned in default active list
        list_r = client.get("/api/canonical?status=active")
        ids = [item["id"] for item in list_r.json()["items"]]
        assert can_id not in ids

        # But returned in status=all or status=archived
        arch_r = client.get("/api/canonical?status=archived")
        arch_ids = [item["id"] for item in arch_r.json()["items"]]
        assert can_id in arch_ids

    def test_list_canonical_search_and_filters(self):
        client.post("/api/canonical", json={"title": "Dell XPS 15", "brand": "Dell", "category": "Laptops"})
        client.post("/api/canonical", json={"title": "Dell Inspiron 14", "brand": "Dell", "category": "Laptops"})
        client.post("/api/canonical", json={"title": "Apple iPad Air", "brand": "Apple", "category": "Tablets"})

        # Search Dell
        r_dell = client.get("/api/canonical?brand=Dell")
        assert r_dell.status_code == 200
        assert r_dell.json()["total"] == 2

        # Search query 'xps'
        r_q = client.get("/api/canonical?q=xps")
        assert r_q.status_code == 200
        assert r_q.json()["total"] == 1
        assert "XPS" in r_q.json()["items"][0]["title"]


# ===========================================================================
# TASK 4 — Safe Merge Operations
# ===========================================================================

class TestSafeMergeOperations:
    def test_successful_merge_transfers_sources_and_sets_redirect(self):
        # Create 2 source products
        p1 = _make_prod("p1", "Galaxy S24 Ultra", brand="Samsung", upc="887276751234")
        p2 = _make_prod("p2", "Galaxy S24 Ultra (512GB)", brand="Samsung", upc="887276751234")
        _seed(products=[p1, p2])

        # Create 2 canonicals
        c1 = client.post("/api/canonical", json={
            "title": "Samsung Galaxy S24 Ultra",
            "brand": "Samsung",
            "upcOrGtin": "887276751234",
            "sourceProductIds": ["p1"]
        }).json()
        c2 = client.post("/api/canonical", json={
            "title": "Samsung Galaxy S24 Ultra 512GB",
            "brand": "Samsung",
            "upcOrGtin": "887276751234",
            "sourceProductIds": ["p2"]
        }).json()

        merge_payload = {
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
            "reviewer": "chief_curator",
            "reason": "Identical product listing across channels"
        }
        res = client.post("/api/canonical/merge", json=merge_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["merged"] is True
        assert data["survivor"]["id"] == c1["id"]
        assert "p1" in data["survivor"]["sourceProductIds"]
        assert "p2" in data["survivor"]["sourceProductIds"]

        # Check c2 is marked as merged and redirects to c1
        c2_refetched = client.get(f"/api/canonical/{c2['id']}").json()
        assert c2_refetched["status"] == "merged"
        assert c2_refetched["mergedIntoCanonicalId"] == c1["id"]

        # Following redirect returns survivor
        c2_redirected = client.get(f"/api/canonical/{c2['id']}?follow_redirect=true").json()
        assert c2_redirected["id"] == c1["id"]
        assert c2_redirected["_redirectedFrom"] == c2["id"]

    def test_reject_self_merge(self):
        c1 = client.post("/api/canonical", json={"title": "iPhone 15", "brand": "Apple"}).json()
        res = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c1["id"]]
        })
        assert res.status_code == 422
        assert "Self-merge rejected" in res.text

    def test_reject_duplicate_ids_in_merge_request(self):
        c1 = client.post("/api/canonical", json={"title": "Product 1", "brand": "BrandA"}).json()
        c2 = client.post("/api/canonical", json={"title": "Product 2", "brand": "BrandA"}).json()
        res = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"], c2["id"]]
        })
        assert res.status_code == 422
        assert "Duplicate IDs" in res.text

    def test_merge_conflict_detected_and_requires_confirmation(self):
        # Conflicting barcodes (UPCs)
        c1 = client.post("/api/canonical", json={
            "title": "Product A", "brand": "Sony", "upcOrGtin": "111111111111"
        }).json()
        c2 = client.post("/api/canonical", json={
            "title": "Product B", "brand": "Sony", "upcOrGtin": "222222222222"
        }).json()

        # Without confirmation flag -> 409 Conflict
        res = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
            "confirmConflicts": False
        })
        assert res.status_code == 409
        err = res.json()["detail"]
        assert err["requiresConfirmation"] is True
        assert any(c["type"] == "identifier_mismatch" for c in err["conflicts"])

        # With explicit confirmation flag -> 200 OK
        res_ok = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
            "confirmConflicts": True,
            "reason": "Verified regional UPC packaging discrepancy"
        })
        assert res_ok.status_code == 200
        assert res_ok.json()["merged"] is True

    def test_brand_conflict_detected(self):
        c1 = client.post("/api/canonical", json={"title": "Phone", "brand": "Apple"}).json()
        c2 = client.post("/api/canonical", json={"title": "Phone", "brand": "Google"}).json()

        res = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
            "confirmConflicts": False
        })
        assert res.status_code == 409
        conflicts = res.json()["detail"]["conflicts"]
        assert any(c["type"] == "brand_mismatch" for c in conflicts)

    def test_idempotent_merge_retry(self):
        c1 = client.post("/api/canonical", json={"title": "Laptop", "brand": "HP"}).json()
        c2 = client.post("/api/canonical", json={"title": "Laptop", "brand": "HP"}).json()

        # Merge once
        res1 = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
        })
        assert res1.status_code == 200

        # Merge again with exact same payload
        res2 = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
        })
        assert res2.status_code == 200
        assert res2.json()["idempotent"] is True

    def test_prevent_cyclic_redirects(self):
        c1 = client.post("/api/canonical", json={"title": "A", "brand": "BrandX"}).json()
        c2 = client.post("/api/canonical", json={"title": "B", "brand": "BrandX"}).json()

        # Merge c2 into c1
        client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]],
        })

        # Now try to merge c1 into c2 -> cannot merge into merged entity
        res = client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c2["id"],
            "mergedCanonicalIds": [c1["id"]],
        })
        assert res.status_code == 409
        assert "already merged" in res.text


# ===========================================================================
# TASK 5 — Safe Split and Compensating Undo Operations
# ===========================================================================

class TestSafeSplitAndUndoOperations:
    def test_split_creates_new_canonical_and_reassigns_source(self):
        p1 = _make_prod("p1", "AirPods Pro (2nd Gen)", brand="Apple")
        p2 = _make_prod("p2", "AirPods Max (Silver)", brand="Apple")
        _seed(products=[p1, p2])

        c1 = client.post("/api/canonical", json={
            "title": "Apple Audio Bundle",
            "brand": "Apple",
            "sourceProductIds": ["p1", "p2"]
        }).json()

        # Split p2 into its own entity
        res = client.post(f"/api/canonical/{c1['id']}/split", json={
            "sourceProductIds": ["p2"],
            "newCanonicalTitle": "Apple AirPods Max",
            "reviewer": "audio_specialist",
            "reason": "AirPods Max is over-ear, distinct from in-ear Pro"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["split"] is True
        assert data["sourceCanonical"]["sourceProductIds"] == ["p1"]
        assert data["destinationCanonical"]["title"] == "Apple AirPods Max"
        assert data["destinationCanonical"]["sourceProductIds"] == ["p2"]

        # Verify source product p2's canonicalId updated to destination ID
        sources = client.get(f"/api/canonical/{data['destinationCanonical']['id']}/sources").json()
        assert len(sources) == 1
        assert sources[0]["id"] == "p2"

    def test_split_non_attached_source_fails_422(self):
        c1 = client.post("/api/canonical", json={"title": "TV", "brand": "Sony"}).json()
        res = client.post(f"/api/canonical/{c1['id']}/split", json={
            "sourceProductIds": ["unattached_prod_id"]
        })
        assert res.status_code == 422

    def test_compensating_undo_merge_restores_entity_and_listings(self):
        p1 = _make_prod("p1", "Monitor 27in", brand="LG")
        p2 = _make_prod("p2", "Monitor 32in", brand="LG")
        _seed(products=[p1, p2])

        c1 = client.post("/api/canonical", json={"title": "LG 27in", "brand": "LG", "sourceProductIds": ["p1"]}).json()
        c2 = client.post("/api/canonical", json={"title": "LG 32in", "brand": "LG", "sourceProductIds": ["p2"]}).json()

        # Merge c2 into c1
        client.post("/api/canonical/merge", json={
            "survivingCanonicalId": c1["id"],
            "mergedCanonicalIds": [c2["id"]]
        })

        # Verify merged
        c2_chk = client.get(f"/api/canonical/{c2['id']}").json()
        assert c2_chk["status"] == "merged"

        # Execute Undo Merge
        undo_res = client.post(f"/api/canonical/{c2['id']}/undo-merge", json={
            "reviewer": "quality_team",
            "reason": "Mistaken merge between different screen sizes"
        })
        assert undo_res.status_code == 200
        undo_data = undo_res.json()
        assert undo_data["undone"] is True
        assert undo_data["restoredEntity"]["status"] == "active"
        assert undo_data["restoredEntity"]["mergedIntoCanonicalId"] is None

        # Verify source p2 is back with c2
        c2_restored = client.get(f"/api/canonical/{c2['id']}").json()
        assert c2_restored["status"] == "active"
        assert "p2" in c2_restored["sourceProductIds"]

        c1_restored = client.get(f"/api/canonical/{c1['id']}").json()
        assert "p2" not in c1_restored["sourceProductIds"]


# ===========================================================================
# TASK 6 — Source Listing Management
# ===========================================================================

class TestSourceListingManagement:
    def test_attach_and_detach_source_listing(self):
        p1 = _make_prod("p100", "Pixel 8 Pro", brand="Google")
        _seed(products=[p1])

        c1 = client.post("/api/canonical", json={"title": "Google Pixel 8 Pro", "brand": "Google"}).json()

        # Attach p100
        attach_r = client.post(f"/api/canonical/{c1['id']}/sources/attach", json={
            "sourceProductId": "p100",
            "reviewer": "curator_a"
        })
        assert attach_r.status_code == 200
        assert attach_r.json()["attached"] is True

        # Verify in sources list
        sources_r = client.get(f"/api/canonical/{c1['id']}/sources")
        assert len(sources_r.json()) == 1
        assert sources_r.json()[0]["id"] == "p100"

        # Detach p100
        detach_r = client.post(f"/api/canonical/{c1['id']}/sources/detach", json={
            "sourceProductId": "p100",
            "reviewer": "curator_a"
        })
        assert detach_r.status_code == 200
        assert detach_r.json()["detached"] is True

        # Verify detached
        sources_after = client.get(f"/api/canonical/{c1['id']}/sources").json()
        assert len(sources_after) == 0

    def test_attach_reassigns_from_previous_canonical(self):
        p1 = _make_prod("p200", "Kindle Paperwhite", brand="Amazon")
        _seed(products=[p1])

        c1 = client.post("/api/canonical", json={"title": "Kindle 1", "sourceProductIds": ["p200"]}).json()
        c2 = client.post("/api/canonical", json={"title": "Kindle 2"}).json()

        # Attach p200 to c2 -> safely reassigns from c1
        res = client.post(f"/api/canonical/{c2['id']}/sources/attach", json={"sourceProductId": "p200"})
        assert res.status_code == 200
        assert res.json()["reassignedFrom"] == c1["id"]

        # c1 should no longer have p200
        c1_sources = client.get(f"/api/canonical/{c1['id']}/sources").json()
        assert len(c1_sources) == 0

        # c2 should have p200
        c2_sources = client.get(f"/api/canonical/{c2['id']}/sources").json()
        assert len(c2_sources) == 1
        assert c2_sources[0]["id"] == "p200"


# ===========================================================================
# TASK 7 — Unified Audit History
# ===========================================================================

class TestUnifiedAuditHistory:
    def test_audit_logs_recorded_for_canonical_lifecycle(self):
        # Create canonical
        c = client.post("/api/canonical", json={"title": "Log Test Product", "reviewer": "audit_tester"}).json()
        can_id = c["id"]

        # Update canonical
        client.put(f"/api/canonical/{can_id}", json={"price": 500, "reviewer": "audit_tester"})

        # Query audit endpoint for this entity
        r = client.get(f"/api/audit?entity_id={can_id}")
        assert r.status_code == 200
        logs = r.json()["items"]
        assert len(logs) >= 2
        actions = [log["action"] for log in logs]
        assert "Canonical Product Created" in actions
        assert "Canonical Product Updated" in actions
        assert all(log["user"] == "audit_tester" for log in logs)

    def test_audit_filter_by_action_type(self):
        c = client.post("/api/canonical", json={"title": "Action Filter Test"}).json()
        client.delete(f"/api/canonical/{c['id']}")

        r_archive = client.get("/api/audit?action_type=archive")
        assert r_archive.status_code == 200
        items = r_archive.json()["items"]
        assert len(items) >= 1
        assert items[0]["type"] == "archive"


# ===========================================================================
# TASK 8 — Storage Integrity & Crash Recovery
# ===========================================================================

class TestStorageIntegrityAndRecovery:
    def test_crash_recovery_from_journal_backup(self):
        # Seed initial state
        initial_state = {
            "products": [_make_prod("orig1", "Initial Product")],
            "canonicalProducts": [],
            "_revision": 1
        }
        main.save_state(initial_state)

        # Simulate an interrupted transaction by writing a pre-mutation backup
        # and an 'in_progress' journal entry
        storage_mgr = get_storage_manager()
        tx_id = "tx-crashed-test"
        backup_path = storage_mgr.create_backup_snapshot(initial_state, tx_id)

        # Corrupt/mutate state directly to simulate partial crash
        corrupted_state = {"products": [_make_prod("corrupt1", "Partial Data")]}
        main.save_state(corrupted_state)

        # Record in_progress journal entry pointing to initial backup
        storage_mgr.record_journal({
            "txId": tx_id,
            "operation": "canonical_merge",
            "timestamp": "2026-10-11T00:00:00Z",
            "status": "in_progress",
            "backupFile": str(backup_path)
        })

        # Run recovery
        storage_mgr.recover_interrupted_transactions()

        # State should be cleanly rolled back to initial_state!
        restored = main.load_state()
        assert len(restored["products"]) == 1
        assert restored["products"][0]["id"] == "orig1"

    def test_concurrent_mutations_protected_by_lock(self):
        # Spawn multiple threads updating canonicals
        c = client.post("/api/canonical", json={"title": "Concurrency Base", "price": 100}).json()
        can_id = c["id"]

        errors = []

        def update_worker(val):
            try:
                r = client.put(f"/api/canonical/{can_id}", json={"price": val})
                if r.status_code not in (200, 409):
                    errors.append(f"Unexpected status: {r.status_code}")
            except Exception as e:
                errors.append(str(e))

        threads = [threading.Thread(target=update_worker, args=(100 + i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        final = client.get(f"/api/canonical/{can_id}").json()
        assert final["status"] == "active"
        assert final["version"] > 1
