"""Unit tests for the analytics dimensions on ledger writes.

Unlike test_ledger.py (which needs the Firestore emulator), these mock the
Firestore client and assert the document payload built by log_event - so they
run anywhere and pin the dimension field names written to credit_events.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from billing import ledger

pytestmark = pytest.mark.asyncio


def _capturing_db():
    """A fake async Firestore client that captures the set() payload."""
    captured: dict = {}
    doc = MagicMock()

    async def _set(data):
        captured["data"] = data

    doc.set = AsyncMock(side_effect=_set)
    coll = MagicMock()
    coll.document = MagicMock(return_value=doc)
    db = MagicMock()
    db.collection = MagicMock(return_value=coll)
    return db, captured


async def test_log_event_persists_dimensions():
    db, captured = _capturing_db()
    await ledger.log_event(
        db, uid="u", pass_id=None, tool_name="ai_analysis_lite",
        cost=0, balance_after=0, plate="AB1",
        source="cache", cache_hit=True,
    )
    data = captured["data"]
    assert data["toolName"] == "ai_analysis_lite"
    assert data["source"] == "cache"
    assert data["cacheHit"] is True


async def test_log_event_persists_model_telemetry():
    db, captured = _capturing_db()
    await ledger.log_event(
        db, uid="u", pass_id=None, tool_name="model_call",
        cost=0, balance_after=0, plate=None,
        source="model", model="gemini-2.5", input_tokens=120,
        output_tokens=80, latency_ms=1500,
    )
    data = captured["data"]
    assert data["model"] == "gemini-2.5"
    assert data["inputTokens"] == 120
    assert data["outputTokens"] == 80
    assert data["latencyMs"] == 1500


async def test_log_event_omits_absent_dimensions():
    db, captured = _capturing_db()
    await ledger.log_event(
        db, uid="u", pass_id=None, tool_name="chat_turn",
        cost=0, balance_after=0, plate=None,
    )
    data = captured["data"]
    for absent in ("source", "cacheHit", "model", "inputTokens", "outputTokens", "latencyMs"):
        assert absent not in data
