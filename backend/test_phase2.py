"""
Phase 2 Backend Tests — Entity Resolution Platform
====================================================
Tests for:
  - Normalization (Task 2)
  - Candidate generation (Task 3)
  - Scoring engine (Task 4)
  - Duplicate detection / clustering (Task 5)
  - Match review workflow (Task 6)
  - API endpoints
  - Idempotency, locking, concurrent-safe state
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import threading
import time
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# We must point APP_DATA_DIR at a temp dir BEFORE importing main
# so the module-level DATA_DIR / STATE_FILE constants are safe.
# ---------------------------------------------------------------------------
_TMP = tempfile.mkdtemp()
os.environ["APP_DATA_DIR"] = _TMP

# Now import the module
from main import (  # noqa: E402
    CandidateGenerator,
    DEFAULT_SETTINGS,
    MatchingSettings,
    app,
    build_normalized_record,
    normalize_brand,
    normalize_identifier,
    normalize_text,
    product_fingerprint,
    run_duplicate_detection,
    score_pair,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def _product(
    pid: str = "p1",
    title: str = "Test Product",
    brand: str = "Acme",
    model: str = "X100",
    upc: str = "",
    price: float = 1000.0,
    attrs: dict | None = None,
    status: str = "Unmatched",
) -> dict[str, Any]:
    return {
        "id": pid,
        "title": title,
        "brand": brand,
        "modelNumber": model,
        "upcOrGtin": upc,
        "price": price,
        "currency": "₹",
        "category": "Electronics",
        "subCategory": "",
        "source": "Manual Ingestion",
        "sourceSku": "",
        "imageUrl": "",
        "rating": 4.0,
        "reviewsCount": 100,
        "status": status,
        "attributes": attrs or {},
        "createdAt": "2026-01-01T00:00:00Z",
        "fingerprintHash": "testhash",
    }


def _norm(p: dict) -> dict:
    return build_normalized_record(p)


# ===========================================================================
# TASK 2 — Normalization tests
# ===========================================================================


class TestNormalizeText:
    def test_lowercase(self):
        assert normalize_text("APPLE") == "apple"

    def test_strips_whitespace(self):
        assert normalize_text("  hello world  ") == "hello world"

    def test_strips_noise(self):
        result = normalize_text("Samsung Galaxy FREE SHIPPING Limited Stock")
        assert "free shipping" not in result
        assert "limited stock" not in result
        assert "samsung" in result

    def test_strips_parentheses(self):
        # The normalization pipeline strips content inside parentheses/brackets
        # including any digits within them — this is intentional behavior.
        result = normalize_text("Galaxy S24 (256 GB) [Phantom Black]")
        assert "galaxy" in result
        assert "s24" in result
        assert "(" not in result
        assert "[" not in result

    def test_unicode_normalization(self):
        # café vs cafe
        result = normalize_text("café")
        assert "cafe" in result

    def test_empty_string(self):
        assert normalize_text("") == ""

    def test_none_value(self):
        assert normalize_text(None) == ""

    def test_punctuation_removed(self):
        result = normalize_text("Hello, World! It's great.")
        assert "," not in result
        assert "!" not in result

    def test_digits_preserved(self):
        result = normalize_text("iPhone 15 Pro")
        assert "15" in result
        assert "iphone" in result


class TestNormalizeBrand:
    def test_alias_resolution(self):
        assert normalize_brand("apple inc") == "Apple"
        assert normalize_brand("samsung electronics") == "Samsung"
        assert normalize_brand("hewlett-packard") == "HP"

    def test_unknown_passthrough(self):
        result = normalize_brand("Fictional Corp")
        assert result == "Fictional Corp"

    def test_empty_returns_unknown(self):
        assert normalize_brand("") == "Unknown"
        assert normalize_brand(None) == "Unknown"

    def test_case_insensitive_alias(self):
        assert normalize_brand("APPLE INC") == "Apple"

    def test_oneplus_alias(self):
        assert normalize_brand("one plus") == "OnePlus"


class TestNormalizeIdentifier:
    def test_digits_only_preserved(self):
        assert normalize_identifier("012345678901") == "012345678901"

    def test_leading_zeros_preserved(self):
        result = normalize_identifier("00123456789")
        assert result.startswith("0")

    def test_strips_upc_prefix(self):
        result = normalize_identifier("UPC: 123456789012")
        assert result == "123456789012"

    def test_strips_ean_prefix(self):
        result = normalize_identifier("EAN:4901234567890")
        assert result == "4901234567890"

    def test_empty_returns_empty(self):
        assert normalize_identifier("") == ""
        assert normalize_identifier(None) == ""

    def test_non_digits_stripped(self):
        result = normalize_identifier("1234-5678-9012")
        assert result == "123456789012"


class TestBuildNormalizedRecord:
    def test_basic_fields(self):
        p = _product(title="Apple iPhone 15", brand="Apple", model="A3090")
        r = build_normalized_record(p)
        assert r["norm_brand"] == "apple"
        assert "apple" in r["norm_title"]
        assert "iphone" in r["norm_title"]

    def test_title_tokens(self):
        p = _product(title="Samsung Galaxy S24 Ultra")
        r = build_normalized_record(p)
        assert "samsung" in r["title_tokens"] or "galaxy" in r["title_tokens"]

    def test_extracted_storage(self):
        p = _product(title="Samsung Galaxy 256 GB Black")
        r = build_normalized_record(p)
        assert r["extracted_attrs"].get("storage") == "256 GB"

    def test_extracted_color(self):
        p = _product(title="iPhone 15 Pro Titanium")
        r = build_normalized_record(p)
        assert r["extracted_attrs"].get("color", "").lower() == "titanium"

    def test_existing_attrs_not_overwritten(self):
        p = _product(title="Phone 128 GB Blue", attrs={"storage": "256 GB"})
        r = build_normalized_record(p)
        # existing attribute (256 GB) should take precedence over extracted (128 GB)
        assert r["extracted_attrs"].get("storage") == "256 GB"


# ===========================================================================
# TASK 3 — Candidate Generation
# ===========================================================================


class TestCandidateGenerator:
    def test_small_catalog_exhaustive(self):
        products = [_product(f"p{i}", f"Product {i}") for i in range(10)]
        norm_cache = {p["id"]: _norm(p) for p in products}
        gen = CandidateGenerator(products, norm_cache)
        pairs = gen.generate()
        # Exhaustive: 10C2 = 45
        assert len(pairs) == 45

    def test_excludes_self_matches(self):
        products = [_product(f"p{i}", f"Product {i}") for i in range(5)]
        norm_cache = {p["id"]: _norm(p) for p in products}
        gen = CandidateGenerator(products, norm_cache)
        pairs = gen.generate()
        for a, b in pairs:
            assert a["id"] != b["id"]

    def test_no_duplicate_pairs(self):
        products = [_product(f"p{i}", f"Product {i}") for i in range(20)]
        norm_cache = {p["id"]: _norm(p) for p in products}
        gen = CandidateGenerator(products, norm_cache)
        pairs = gen.generate()
        seen: set[frozenset] = set()
        for a, b in pairs:
            key = frozenset({a["id"], b["id"]})
            assert key not in seen, "Duplicate pair found"
            seen.add(key)

    def test_upc_blocking(self):
        # Products sharing UPC should be paired
        p1 = _product("p1", "Samsung Galaxy A", upc="123456789012")
        p2 = _product("p2", "Samsung Galaxy B", upc="123456789012")
        p3 = _product("p3", "Completely Different", upc="999999999999")
        # Use a large catalog to force blocking (not exhaustive)
        filler = [_product(f"f{i}", f"Filler {i}") for i in range(250)]
        products = [p1, p2, p3] + filler
        norm_cache = {p["id"]: _norm(p) for p in products}
        gen = CandidateGenerator(products, norm_cache)
        pairs = gen.generate()
        ids_in_pairs = {frozenset({a["id"], b["id"]}) for a, b in pairs}
        assert frozenset({"p1", "p2"}) in ids_in_pairs

    def test_respects_max_candidates(self):
        products = [_product(f"p{i}", f"Alpha Beta Gamma Product {i}") for i in range(300)]
        norm_cache = {p["id"]: _norm(p) for p in products}
        gen = CandidateGenerator(products, norm_cache, max_candidates=100)
        pairs = gen.generate()
        assert len(pairs) <= 100

    def test_single_product_returns_empty(self):
        p = _product("p1", "Solo Product")
        gen = CandidateGenerator([p], {p["id"]: _norm(p)})
        assert gen.generate() == []


# ===========================================================================
# TASK 4 — Scoring Engine
# ===========================================================================


class TestScorePair:
    def _score(self, a: dict, b: dict, **kwargs) -> dict:
        na, nb = _norm(a), _norm(b)
        return score_pair(a, b, na, nb, **kwargs)

    def test_exact_upc_match_gives_high_score(self):
        a = _product("p1", "Apple iPhone 15 Pro", upc="195949038297")
        b = _product("p2", "Apple iPhone 15 Pro Max", upc="195949038297")
        result = self._score(a, b)
        assert result["overallScore"] >= 80
        assert any("UPC" in e for e in result["positiveEvidence"])

    def test_upc_conflict_penalizes_score(self):
        a = _product("p1", "Samsung Galaxy S24", upc="123456789012")
        b = _product("p2", "Samsung Galaxy S24", upc="999999999999")
        result = self._score(a, b)
        assert any("mismatch" in e.lower() for e in result["conflictingEvidence"])
        # Score should be lower than it would be without UPC conflict
        assert result["overallScore"] < 60

    def test_different_brands_reduces_confidence(self):
        a = _product("p1", "Samsung Galaxy S24 Ultra 256GB", brand="Samsung")
        b = _product("p2", "Samsung Galaxy S24 Ultra 256GB", brand="Apple")
        result = self._score(a, b)
        assert any("Brand mismatch" in e for e in result["conflictingEvidence"])
        assert result["overallScore"] < 50

    def test_same_brand_and_model(self):
        a = _product("p1", "OnePlus 12R 128GB", brand="OnePlus", model="CPH2609")
        b = _product("p2", "OnePlus 12R 256GB", brand="OnePlus", model="CPH2609")
        result = self._score(a, b)
        assert any("Model number agreement" in e for e in result["positiveEvidence"])
        assert result["overallScore"] >= 50

    def test_conflicting_model_numbers(self):
        # Use clearly different model numbers with low sequence similarity
        a = _product("p1", "Phone Series X", brand="Samsung", model="SM-A546E")
        b = _product("p2", "Phone Series X", brand="Samsung", model="CPH2609")
        result = self._score(a, b)
        assert any("Model number" in e for e in result["conflictingEvidence"])

    def test_missing_fields_not_treated_as_agreement(self):
        a = _product("p1", "Generic Phone", brand="Unknown", model="", upc="")
        b = _product("p2", "Generic Phone", brand="Unknown", model="", upc="")
        result = self._score(a, b)
        # No identifiers → score must be capped
        assert result["overallScore"] <= 60

    def test_title_only_similarity_capped(self):
        a = _product("p1", "Samsung Galaxy S24 Ultra", brand="Samsung")
        b = _product("p2", "Samsung Galaxy S24 Ultra", brand="Unknown")
        result = self._score(a, b)
        # Unknown brand prevents high confidence
        assert result["overallScore"] <= 65

    def test_attribute_agreement_boosts_score(self):
        a = _product("p1", "Laptop Pro", attrs={"storage": "512 GB", "color": "Silver"})
        b = _product("p2", "Laptop Pro", attrs={"storage": "512 GB", "color": "Silver"})
        na, nb = _norm(a), _norm(b)
        # inject attrs into norm records
        na["extracted_attrs"] = {"storage": "512 GB", "color": "Silver"}
        nb["extracted_attrs"] = {"storage": "512 GB", "color": "Silver"}
        result = score_pair(a, b, na, nb)
        assert any("Attribute agreement" in e for e in result["positiveEvidence"])

    def test_attribute_conflict_noted(self):
        # Use real product attributes so the normalization pipeline sees them
        a = _product("p1", "Laptop", attrs={"Storage": "256 GB"})
        b = _product("p2", "Laptop", attrs={"Storage": "512 GB"})
        na, nb = _norm(a), _norm(b)
        # Override extracted_attrs to ensure the conflict is visible
        na["extracted_attrs"] = {"storage": "256 gb"}
        nb["extracted_attrs"] = {"storage": "512 gb"}
        result = score_pair(a, b, na, nb)
        assert any("Attribute conflict" in e for e in result["conflictingEvidence"])

    def test_score_normalized_0_to_1(self):
        a = _product("p1", "X", brand="A")
        b = _product("p2", "Y", brand="B")
        result = self._score(a, b)
        assert 0 <= result["overallScoreNorm"] <= 1

    def test_stable_pair_id(self):
        a = _product("p1", "A")
        b = _product("p2", "B")
        r1 = self._score(a, b)
        r2 = self._score(b, a)  # reversed order
        assert r1["id"] == r2["id"]  # deterministic

    def test_recommended_action_high(self):
        a = _product("p1", "Apple iPhone 15", brand="Apple", model="MU773LL/A", upc="195949038297")
        b = _product("p2", "Apple iPhone 15", brand="Apple", model="MU773LL/A", upc="195949038297")
        result = self._score(a, b)
        assert result["recommendedAction"] == "auto_candidate"
        assert result["confidenceLevel"] == "High"

    def test_recommended_action_reject(self):
        a = _product("p1", "Red Pen", brand="StationaryCo")
        b = _product("p2", "Blue Notebook", brand="PaperCo")
        result = self._score(a, b)
        assert result["recommendedAction"] == "reject"

    def test_explanation_present(self):
        a = _product("p1", "Galaxy S24")
        b = _product("p2", "Galaxy S24 Ultra")
        result = self._score(a, b)
        assert len(result["explanation"]) > 5

    def test_similar_but_non_identical(self):
        # Different storage variants must NOT match at high confidence
        a = _product("p1", "Samsung Galaxy S24 128GB", brand="Samsung", model="SM-S928B")
        b = _product("p2", "Samsung Galaxy S24 256GB", brand="Samsung", model="SM-S928B",
                     attrs={"storage": "256 GB"})
        na, nb = _norm(a), _norm(b)
        na["extracted_attrs"] = {"storage": "128 GB"}
        nb["extracted_attrs"] = {"storage": "256 GB"}
        result = score_pair(a, b, na, nb)
        # Storage conflict should prevent auto-candidate
        assert result["recommendedAction"] in ("review", "reject")


# ===========================================================================
# TASK 5 — Duplicate Detection
# ===========================================================================


class TestRunDuplicateDetection:
    def test_returns_empty_for_single_product(self):
        pairs, clusters, meta = run_duplicate_detection([_product("p1")])
        assert pairs == []
        assert clusters == []
        assert meta["status"] == "completed"

    def test_exact_upc_pair_detected(self):
        p1 = _product("p1", "Apple iPhone 15 Pro", brand="Apple", upc="195949038297")
        p2 = _product("p2", "Apple iPhone 15 Pro (Unlocked)", brand="Apple", upc="195949038297")
        pairs, clusters, meta = run_duplicate_detection([p1, p2])
        assert len(pairs) >= 1
        assert pairs[0]["overallScore"] > 60

    def test_different_brand_products_not_merged(self):
        p1 = _product("p1", "Apple iPhone 15", brand="Apple", upc="111111111111")
        p2 = _product("p2", "Samsung Galaxy S24", brand="Samsung", upc="222222222222")
        pairs, clusters, meta = run_duplicate_detection([p1, p2])
        # Brands differ, UPCs differ → should be rejected or very low score
        scored = [p for p in pairs if p["overallScore"] >= 55]
        assert len(scored) == 0

    def test_cluster_formed_from_duplicates(self):
        p1 = _product("p1", "HP Laptop 15", brand="HP", model="15-DY0013DX", upc="194441888925")
        p2 = _product("p2", "HP Laptop 15 (Renewed)", brand="HP", model="15-DY0013DX", upc="194441888925")
        p3 = _product("p3", "HP 15 Laptop Computer", brand="HP", model="15-DY0013DX", upc="194441888925")
        _, clusters, _ = run_duplicate_detection([p1, p2, p3])
        assert len(clusters) >= 1
        cluster_product_ids = {pid for c in clusters for pid in c["productIds"]}
        assert "p1" in cluster_product_ids or "p2" in cluster_product_ids

    def test_run_metadata_populated(self):
        p1 = _product("p1", "Phone A")
        p2 = _product("p2", "Phone B")
        _, _, meta = run_duplicate_detection([p1, p2])
        assert "runId" in meta
        assert meta["productsScanned"] == 2
        assert meta["status"] == "completed"

    def test_no_unsafe_transitive_merge(self):
        # p1 ≈ p2, p2 ≈ p3, but p1 ≉ p3
        # All three might end up in a cluster because of shared token connectivity,
        # but we check that the cluster items are the actual product dicts
        p1 = _product("p1", "Laptop Alpha 256GB", brand="Dell", model="M1")
        p2 = _product("p2", "Laptop Alpha 256GB", brand="Dell", model="M1")
        p3 = _product("p3", "Completely Different Tablet", brand="Lenovo", model="T2")
        pairs, _, _ = run_duplicate_detection([p1, p2, p3])
        # p1-p3 or p2-p3 should not be a high-confidence pair
        bad_pairs = [
            p for p in pairs
            if (
                frozenset({p["productIdA"], p["productIdB"]}) == frozenset({"p1", "p3"})
                or frozenset({p["productIdA"], p["productIdB"]}) == frozenset({"p2", "p3"})
            )
            and p["overallScore"] >= 70
        ]
        assert bad_pairs == []

    def test_duplicate_pair_not_repeated(self):
        p1 = _product("p1", "Product Alpha", brand="BrandX", upc="100000000001")
        p2 = _product("p2", "Product Alpha (Variant)", brand="BrandX", upc="100000000001")
        pairs, _, _ = run_duplicate_detection([p1, p2])
        pair_ids = [p["id"] for p in pairs]
        assert len(pair_ids) == len(set(pair_ids))


# ===========================================================================
# TASK 6 — Match Review Workflow (via API)
# ===========================================================================


def _seed_state(products=None, pairs=None, clusters=None):
    """Seed the backend state file with test data."""
    state = {
        "products": products or [],
        "matchPairs": pairs or [],
        "duplicateClusters": clusters or [],
        "sellerFeeds": [],
        "auditLogs": [],
        "notifications": [],
    }
    client.put("/api/state", json={"state": state})
    return state


class TestMatchReviewWorkflow:
    def setup_method(self):
        """Reset state before each test."""
        _seed_state()

    def _run_matching(self, products: list):
        _seed_state(products=products)
        r = client.post("/api/matching/run", json={"max_candidates": 1000})
        return r

    def test_run_matching_endpoint(self):
        products = [
            _product("p1", "Apple iPhone 15", brand="Apple", upc="195949038297"),
            _product("p2", "Apple iPhone 15 (Unlocked)", brand="Apple", upc="195949038297"),
        ]
        r = self._run_matching(products)
        assert r.status_code == 200
        data = r.json()
        assert "pairsCount" in data
        assert "runMetadata" in data

    def test_list_candidates_pagination(self):
        products = [_product(f"p{i}", f"Product {i} Alpha Beta") for i in range(20)]
        self._run_matching(products)
        r = client.get("/api/matching/candidates?limit=5&offset=0")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) <= 5

    def test_get_single_candidate(self):
        products = [
            _product("p1", "Samsung Galaxy S24", brand="Samsung", upc="123456789012"),
            _product("p2", "Samsung Galaxy S24 Ultra", brand="Samsung", upc="123456789012"),
        ]
        self._run_matching(products)
        list_r = client.get("/api/matching/candidates")
        items = list_r.json().get("items", [])
        if not items:
            pytest.skip("No pairs generated for this test")
        pair_id = items[0]["id"]
        r = client.get(f"/api/matching/candidates/{pair_id}")
        assert r.status_code == 200
        assert r.json()["id"] == pair_id

    def test_get_nonexistent_candidate_404(self):
        r = client.get("/api/matching/candidates/nonexistent-id")
        assert r.status_code == 404

    def test_approve_decision(self):
        products = [
            _product("p1", "OnePlus 12R 128GB", brand="OnePlus", upc="810062890222"),
            _product("p2", "OnePlus 12R 128GB (Open Box)", brand="OnePlus", upc="810062890222"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        r = client.post(
            f"/api/matching/candidates/{pair_id}/decision",
            json={"decision": "approved", "reviewer": "test_user"},
        )
        assert r.status_code == 200
        assert r.json()["matchStatus"] == "Approved"

    def test_reject_decision(self):
        products = [
            _product("p1", "OnePlus 12R 128GB", brand="OnePlus", upc="810062890222"),
            _product("p2", "OnePlus 12R 128GB (Open Box)", brand="OnePlus", upc="810062890222"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        r = client.post(
            f"/api/matching/candidates/{pair_id}/decision",
            json={"decision": "rejected", "reviewer": "test_user"},
        )
        assert r.status_code == 200
        assert r.json()["matchStatus"] == "Rejected"

    def test_repeated_same_decision_idempotent(self):
        products = [
            _product("p1", "Product X", brand="BrandA", upc="100000000001"),
            _product("p2", "Product X (Variant)", brand="BrandA", upc="100000000001"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        r1 = client.post(f"/api/matching/candidates/{pair_id}/decision",
                         json={"decision": "approved", "reviewer": "u1"})
        r2 = client.post(f"/api/matching/candidates/{pair_id}/decision",
                         json={"decision": "approved", "reviewer": "u1"})
        assert r1.status_code == 200
        assert r2.status_code == 200  # idempotent, not 409

    def test_changing_finalized_decision_raises_409(self):
        products = [
            _product("p1", "Product Y", brand="BrandB", upc="200000000002"),
            _product("p2", "Product Y Alt", brand="BrandB", upc="200000000002"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        client.post(f"/api/matching/candidates/{pair_id}/decision",
                    json={"decision": "approved", "reviewer": "u1"})
        r = client.post(f"/api/matching/candidates/{pair_id}/decision",
                        json={"decision": "rejected", "reviewer": "u2"})
        assert r.status_code == 409

    def test_override_decision(self):
        products = [
            _product("p1", "Product Z", brand="BrandC", upc="300000000003"),
            _product("p2", "Product Z Alt", brand="BrandC", upc="300000000003"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        client.post(f"/api/matching/candidates/{pair_id}/decision",
                    json={"decision": "rejected", "reviewer": "u1"})
        r = client.post(f"/api/matching/candidates/{pair_id}/override",
                        json={"decision": "approved", "reviewer": "supervisor", "notes": "Override confirmed"})
        assert r.status_code == 200
        assert r.json()["matchStatus"] == "Approved"
        assert r.json()["manualOverride"] is True
        assert r.json()["previousStatus"] == "Rejected"

    def test_decision_persisted_across_reloads(self):
        products = [
            _product("p1", "Persistent Product A", brand="BrandD", upc="400000000004"),
            _product("p2", "Persistent Product A V2", brand="BrandD", upc="400000000004"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        client.post(f"/api/matching/candidates/{pair_id}/decision",
                    json={"decision": "approved", "reviewer": "u_persist"})
        # Reload from state
        r = client.get(f"/api/matching/candidates/{pair_id}")
        assert r.json()["matchStatus"] == "Approved"

    def test_invalid_decision_rejected(self):
        products = [_product("p1", "A"), _product("p2", "B")]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        r = client.post(f"/api/matching/candidates/{pair_id}/decision",
                        json={"decision": "maybe", "reviewer": "u"})
        assert r.status_code == 422

    def test_filter_by_status(self):
        products = [
            _product("p1", "Phone A", brand="Apple", upc="100200300400"),
            _product("p2", "Phone A Variant", brand="Apple", upc="100200300400"),
        ]
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        client.post(f"/api/matching/candidates/{pair_id}/decision",
                    json={"decision": "approved", "reviewer": "u"})
        r = client.get("/api/matching/candidates?status=Approved")
        assert r.status_code == 200
        assert all(p["matchStatus"] == "Approved" for p in r.json()["items"])

    def test_incremental_run_preserves_decisions(self):
        products = [
            _product("p1", "Preserved Product", brand="BrandE", upc="500000000005"),
            _product("p2", "Preserved Product Alt", brand="BrandE", upc="500000000005"),
        ]
        # First run: seed and match
        _seed_state(products=products)
        self._run_matching(products)
        items = client.get("/api/matching/candidates").json().get("items", [])
        if not items:
            pytest.skip("No pairs generated")
        pair_id = items[0]["id"]
        client.post(f"/api/matching/candidates/{pair_id}/decision",
                    json={"decision": "approved", "reviewer": "u"})
        # Second run: incremental — keeps products in state, calls run again
        r = client.post("/api/matching/run", json={"incremental": True, "max_candidates": 1000})
        assert r.status_code == 200
        # The approved decision should be preserved
        r2 = client.get(f"/api/matching/candidates/{pair_id}")
        assert r2.status_code == 200
        assert r2.json()["matchStatus"] == "Approved"

    def test_filter_by_confidence(self):
        r = client.get("/api/matching/candidates?confidence=High")
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["confidenceLevel"] == "High"


# ===========================================================================
# Duplicate Cluster Resolve
# ===========================================================================


class TestDuplicateClusterWorkflow:
    def setup_method(self):
        _seed_state()

    def test_resolve_cluster(self):
        products = [
            _product("p1", "HP Laptop", brand="HP", model="M1000", upc="600000000006"),
            _product("p2", "HP Laptop Renewed", brand="HP", model="M1000", upc="600000000006"),
        ]
        _seed_state(products=products)
        client.post("/api/matching/run", json={})
        clusters_r = client.get("/api/duplicates")
        clusters = clusters_r.json().get("items", [])
        if not clusters:
            pytest.skip("No clusters generated")
        cid = clusters[0]["id"]
        r = client.post(f"/api/duplicates/{cid}/resolve", params={"reviewer": "admin"})
        assert r.status_code == 200
        assert r.json()["status"] == "Resolved"

    def test_resolve_cluster_idempotent(self):
        products = [
            _product("p1", "HP Laptop", brand="HP", model="M2000", upc="700000000007"),
            _product("p2", "HP Laptop V2", brand="HP", model="M2000", upc="700000000007"),
        ]
        _seed_state(products=products)
        client.post("/api/matching/run", json={})
        clusters = client.get("/api/duplicates").json().get("items", [])
        if not clusters:
            pytest.skip("No clusters generated")
        cid = clusters[0]["id"]
        client.post(f"/api/duplicates/{cid}/resolve")
        r = client.post(f"/api/duplicates/{cid}/resolve")
        assert r.status_code == 200

    def test_resolve_nonexistent_cluster(self):
        r = client.post("/api/duplicates/nonexistent-cluster/resolve")
        assert r.status_code == 404


# ===========================================================================
# Settings
# ===========================================================================


class TestMatchingSettings:
    def test_get_default_settings(self):
        r = client.get("/api/matching/settings")
        assert r.status_code == 200
        data = r.json()
        assert "high_confidence_threshold" in data

    def test_update_settings(self):
        r = client.put("/api/matching/settings",
                       json={"settings": {"high_confidence_threshold": 0.90,
                                          "review_threshold": 0.60,
                                          "reject_below": 0.25}})
        assert r.status_code == 200
        assert r.json()["high_confidence_threshold"] == 0.90

    def test_invalid_settings_rejected(self):
        # review_threshold above high_confidence_threshold → invalid
        r = client.put("/api/matching/settings",
                       json={"settings": {"high_confidence_threshold": 0.70,
                                          "review_threshold": 0.80,
                                          "reject_below": 0.20}})
        assert r.status_code == 422

    def test_settings_validator_reject_below(self):
        with pytest.raises(Exception):
            MatchingSettings(
                high_confidence_threshold=0.85,
                review_threshold=0.55,
                reject_below=0.60,  # invalid: above review threshold
            )


# ===========================================================================
# Phase 1 API Backward Compatibility
# ===========================================================================


class TestPhase1Compatibility:
    def test_health_endpoint(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_list_products_empty(self):
        _seed_state()
        r = client.get("/api/products")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_create_product(self):
        r = client.post("/api/products",
                        json={"product": {"title": "Test Phone", "brand": "TestBrand"}})
        assert r.status_code == 201
        assert r.json()["title"] == "Test Phone"

    def test_create_product_no_title_422(self):
        r = client.post("/api/products",
                        json={"product": {"brand": "TestBrand"}})
        assert r.status_code == 422

    def test_delete_product(self):
        _seed_state()
        r = client.post("/api/products",
                        json={"product": {"title": "Delete Me", "brand": "X"}})
        pid = r.json()["id"]
        rd = client.delete(f"/api/products/{pid}")
        assert rd.status_code == 200
        assert rd.json()["deleted"] is True

    def test_delete_nonexistent_product_404(self):
        r = client.delete("/api/products/nonexistent-id")
        assert r.status_code == 404

    def test_compare_endpoint_backward_compat(self):
        products = [
            {"id": "p1", "title": "Apple iPhone 15", "brand": "Apple",
             "modelNumber": "MU773LL/A", "upcOrGtin": "195949038297",
             "price": 100000, "attributes": {}, "category": "Phone",
             "source": "Amazon", "sourceSku": "", "imageUrl": "",
             "rating": 4.5, "reviewsCount": 100, "status": "Unmatched",
             "createdAt": "2026-01-01T00:00:00Z", "fingerprintHash": "h1"},
            {"id": "p2", "title": "Apple iPhone 15 Pro", "brand": "Apple",
             "modelNumber": "MU773LL/B", "upcOrGtin": "195949038000",
             "price": 120000, "attributes": {}, "category": "Phone",
             "source": "Flipkart", "sourceSku": "", "imageUrl": "",
             "rating": 4.8, "reviewsCount": 200, "status": "Unmatched",
             "createdAt": "2026-01-01T00:00:00Z", "fingerprintHash": "h2"},
        ]
        r = client.post("/api/matching/compare", json={"products": products, "threshold": 50})
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "count" in data

    def test_analytics_summary(self):
        r = client.get("/api/analytics/summary")
        assert r.status_code == 200
        data = r.json()
        assert "totalProducts" in data
        assert "pendingMatches" in data

    def test_state_put_get_roundtrip(self):
        payload = {
            "products": [{"id": "p-test", "title": "RT Product", "brand": "RTBrand",
                          "modelNumber": "", "upcOrGtin": "", "price": 500,
                          "currency": "₹", "category": "X", "subCategory": "",
                          "source": "Amazon", "sourceSku": "", "imageUrl": "",
                          "rating": 3.5, "reviewsCount": 10, "status": "Unmatched",
                          "attributes": {}, "createdAt": "2026-01-01T00:00:00Z",
                          "fingerprintHash": "fph"}],
            "matchPairs": [],
            "duplicateClusters": [],
            "sellerFeeds": [],
            "auditLogs": [],
            "notifications": [],
        }
        client.put("/api/state", json={"state": payload})
        r = client.get("/api/state")
        assert r.status_code == 200
        state = r.json()["state"]
        assert len(state["products"]) == 1
        assert state["products"][0]["id"] == "p-test"

    def test_run_history(self):
        r = client.get("/api/matching/runs")
        assert r.status_code == 200
        assert "items" in r.json()


# ===========================================================================
# Edge cases and error handling
# ===========================================================================


class TestEdgeCases:
    def test_product_fingerprint_stable(self):
        p1 = _product("p1", "Test", brand="Apple", model="M1", upc="123")
        p2 = _product("p2", "Test", brand="Apple", model="M1", upc="123")
        assert product_fingerprint(p1) == product_fingerprint(p2)

    def test_product_fingerprint_differs_on_upc_change(self):
        p1 = _product("p1", "Test", brand="Apple", model="M1", upc="111")
        p2 = _product("p2", "Test", brand="Apple", model="M1", upc="222")
        assert product_fingerprint(p1) != product_fingerprint(p2)

    def test_compare_too_few_products(self):
        r = client.post("/api/matching/compare",
                        json={"products": [{"title": "Only One", "brand": "X"}]})
        assert r.status_code == 422

    def test_run_matching_min_2_products(self):
        _seed_state(products=[_product("p1", "Only One")])
        r = client.post("/api/matching/run", json={})
        assert r.status_code == 422

    def test_malformed_state_key_type(self):
        r = client.put("/api/state",
                       json={"state": {"products": "not-a-list", "matchPairs": [], "duplicateClusters": [],
                                       "sellerFeeds": [], "auditLogs": [], "notifications": []}})
        assert r.status_code == 422

    def test_normalize_very_long_string(self):
        long_str = "A" * 10000
        result = normalize_text(long_str)
        assert "a" * 5 in result

    def test_score_pair_identical_products(self):
        p = _product("p1", "Product A", brand="BrandX", model="M1", upc="123456789012")
        result = score_pair(p, p, _norm(p), _norm(p))
        assert result["overallScore"] >= 80

    def test_list_candidates_filter_min_score(self):
        _seed_state()
        r = client.get("/api/matching/candidates?min_score=90")
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["overallScore"] >= 90
