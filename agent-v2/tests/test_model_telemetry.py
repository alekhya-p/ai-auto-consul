"""Unit tests for model-call telemetry (middleware.telemetry).

Mocks Firestore so they run without the emulator; pins the model_call payload
and the usage-metadata extraction.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from middleware import telemetry


def _capturing_db():
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


async def test_log_model_call_writes_telemetry_event():
    db, captured = _capturing_db()
    await telemetry.log_model_call(
        db, uid="u", model="gemini-2.5", input_tokens=120,
        output_tokens=80, latency_ms=1500,
    )
    d = captured["data"]
    assert d["toolName"] == "model_call"
    assert d["source"] == "model"
    assert d["cost"] == 0
    assert d["model"] == "gemini-2.5"
    assert d["inputTokens"] == 120
    assert d["outputTokens"] == 80
    assert d["latencyMs"] == 1500


def test_extract_usage_reads_metadata():
    class Usage:
        prompt_token_count = 120
        candidates_token_count = 80

    class Resp:
        usage_metadata = Usage()

    assert telemetry.extract_usage(Resp()) == (120, 80)


def test_extract_usage_is_none_safe():
    class Resp:
        usage_metadata = None

    assert telemetry.extract_usage(Resp()) == (None, None)
