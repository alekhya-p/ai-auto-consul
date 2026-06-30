"""Tier-routing tests for ai_analysis_fetch.

These mock the genai client and rdw_fetch so they run without network or an
emulator - except the two that assert a real debit, which use firestore_db.
"""
from __future__ import annotations

import json

import pytest

from tools import analysis
from tests.conftest import FakeGenAIClient, FakeToolContext, grant_pass

pytestmark = pytest.mark.asyncio

RDW_OK = {
    "found": True,
    "kenteken": "AB123C",
    "make": "Volkswagen",
    "model": "Golf",
    "firstRegistration": "2019-03-21",
}

LITE_JSON = json.dumps({"summary": "ok", "pros": ["a"], "cons": ["b"]})
DEEP_JSON = json.dumps({"summary": "deep ok", "redFlags": ["x"], "confidence": "high"})


@pytest.fixture(autouse=True)
def _patch_rdw(monkeypatch):
    async def fake_rdw(plate, tool_context=None):
        return dict(RDW_OK, plate=plate)

    monkeypatch.setattr(analysis, "rdw_fetch", fake_rdw)


@pytest.fixture(autouse=True)
def _bypass_analysis_cache(monkeypatch):
    async def _miss(*_a, **_kw):
        return None

    async def _noop(*_a, **_kw):
        return None

    monkeypatch.setattr(analysis, "get_cached_analysis", _miss)
    monkeypatch.setattr(analysis, "put_cached_analysis", _noop)


def _patch_genai(monkeypatch, text):
    client = FakeGenAIClient(text)
    monkeypatch.setattr(analysis, "_genai_client", lambda: client)
    return client


async def test_unknown_plate_returns_not_found(monkeypatch):
    async def missing(plate):
        return {"found": False, "error": "Plate not found", "plate": plate}

    monkeypatch.setattr(analysis, "rdw_fetch", missing)
    _patch_genai(monkeypatch, LITE_JSON)
    res = await analysis.ai_analysis_fetch("ZZ000Z")
    assert res["found"] is False


async def test_lite_is_default_and_uses_lite_model(monkeypatch):
    client = _patch_genai(monkeypatch, LITE_JSON)
    res = await analysis.ai_analysis_fetch("AB123C", lang="nl")  # no tool_context
    assert res["tier"] == "lite"
    assert res["creditsCharged"] == 0
    assert client.calls[0]["model"] == analysis.LITE_MODEL


async def test_deep_request_unauthenticated_falls_back_to_lite(monkeypatch):
    _patch_genai(monkeypatch, LITE_JSON)
    # deep=True but no tool_context (no uid) → cannot charge → needs_upgrade
    res = await analysis.ai_analysis_fetch("AB123C", deep=True)
    assert res["tier"] == "needs_upgrade"
    assert res["upgradeUrl"] == "/prijzen"
    assert res["creditsCharged"] == 0


async def test_deep_generation_failure_does_not_charge(monkeypatch, firestore_db):
    await grant_pass(firestore_db, "payer", "p1", remaining=3)
    monkeypatch.setattr(analysis, "_firestore", lambda: firestore_db)

    class Boom(FakeGenAIClient):
        def __init__(self):
            super().__init__("")

        async def _raise(self, **kw):
            raise RuntimeError("model exploded")

    boom = Boom()
    boom.aio.models.generate_content = boom._raise
    monkeypatch.setattr(analysis, "_genai_client", lambda: boom)

    ctx = FakeToolContext(user_id="payer")
    res = await analysis.ai_analysis_fetch("AB123C", deep=True, tool_context=ctx)
    assert res["tier"] == "deep"
    assert res["creditsCharged"] == 0
    # Balance untouched because generation failed before the debit.
    from billing import ledger

    found = await ledger.find_active_pass(firestore_db, "payer")
    assert found.remaining == 3


async def test_deep_paid_uses_pro_model_and_debits_one(monkeypatch, firestore_db):
    await grant_pass(firestore_db, "payer2", "p1", remaining=2)
    monkeypatch.setattr(analysis, "_firestore", lambda: firestore_db)
    client = _patch_genai(monkeypatch, DEEP_JSON)

    ctx = FakeToolContext(user_id="payer2")
    res = await analysis.ai_analysis_fetch("AB123C", deep=True, tool_context=ctx)

    assert res["tier"] == "deep"
    assert res["creditsCharged"] == 1
    assert res["balanceAfter"] == 1
    assert client.calls[0]["model"] == analysis.DEEP_MODEL

    from billing import ledger

    found = await ledger.find_active_pass(firestore_db, "payer2")
    assert found.remaining == 1


async def test_deep_paid_exhausted_returns_needs_upgrade(monkeypatch, firestore_db):
    await grant_pass(firestore_db, "broke", "p1", remaining=0)
    monkeypatch.setattr(analysis, "_firestore", lambda: firestore_db)
    _patch_genai(monkeypatch, LITE_JSON)

    ctx = FakeToolContext(user_id="broke")
    res = await analysis.ai_analysis_fetch("AB123C", deep=True, tool_context=ctx)
    assert res["tier"] == "needs_upgrade"
    assert res["creditsCharged"] == 0


# ── run_analysis: the shared core used by the /v2/analysis REST endpoint ──────


async def test_run_analysis_lite_with_uid_directly(monkeypatch):
    """The REST path passes uid directly (no tool_context)."""
    _patch_genai(monkeypatch, LITE_JSON)
    res = await analysis.run_analysis("AB123C", lang="nl", deep=False, uid="rest-user")
    assert res["tier"] == "lite"
    assert res["creditsCharged"] == 0


async def test_run_analysis_deep_charges_via_uid(monkeypatch, firestore_db):
    await grant_pass(firestore_db, "rest-payer", "p1", remaining=2)
    monkeypatch.setattr(analysis, "_firestore", lambda: firestore_db)
    client = _patch_genai(monkeypatch, DEEP_JSON)

    res = await analysis.run_analysis("AB123C", lang="nl", deep=True, uid="rest-payer")
    assert res["tier"] == "deep"
    assert res["creditsCharged"] == 1
    assert res["balanceAfter"] == 1
    assert client.calls[0]["model"] == analysis.DEEP_MODEL


async def test_run_analysis_anonymous_lite(monkeypatch):
    """uid=None (anonymous) still yields a free lite analysis."""
    _patch_genai(monkeypatch, LITE_JSON)
    res = await analysis.run_analysis("AB123C", lang="en", deep=False, uid=None)
    assert res["tier"] == "lite"


async def test_deep_peek_hit_returns_cached_free(monkeypatch):
    """A deep peek surfaces an already-run analysis without generating/charging."""
    cached = {"summary": "deep ok", "tier": "deep", "redFlags": ["x"]}

    async def _hit(plate, *, lang, tier, uid):
        return dict(cached) if tier == "deep" else None

    monkeypatch.setattr(analysis, "get_cached_analysis", _hit)
    client = _patch_genai(monkeypatch, DEEP_JSON)

    res = await analysis.run_analysis(
        "AB123C", lang="nl", deep=True, uid="peeker", peek=True
    )
    assert res["deepAvailable"] is True
    assert res["fromCache"] is True
    assert res["creditsCharged"] == 0
    assert res["summary"] == "deep ok"
    assert client.calls == []  # never generated


async def test_deep_peek_miss_no_charge(monkeypatch):
    """A deep peek miss returns deepAvailable=False without generating/charging."""
    client = _patch_genai(monkeypatch, DEEP_JSON)  # cache bypassed → miss by default
    res = await analysis.run_analysis(
        "AB123C", lang="nl", deep=True, uid="peeker", peek=True
    )
    assert res["deepAvailable"] is False
    assert "creditsCharged" not in res or res["creditsCharged"] == 0
    assert client.calls == []  # never generated
