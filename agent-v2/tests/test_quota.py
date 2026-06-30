"""Chat-turn + daily-ceiling enforcement (Firestore emulator).

Skipped unless FIRESTORE_EMULATOR_HOST is set (see conftest.firestore_db).
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from billing import handlers, quota
from tests.conftest import grant_pass

pytestmark = pytest.mark.asyncio


# ── consume_chat_turn ──────────────────────────────────────────────────────────

async def test_no_pass_returns_no_pass(firestore_db):
    res = await quota.consume_chat_turn(firestore_db, "free-1")
    assert res.status == "no_pass"


async def test_paid_turn_is_consumed_and_decrements(firestore_db):
    await grant_pass(firestore_db, "p1", "pass", remaining=1, chat_turns=10)
    res = await quota.consume_chat_turn(firestore_db, "p1")
    assert res.status == "consumed"
    assert res.remaining == 9


async def test_active_pass_with_zero_turns_is_exhausted(firestore_db):
    await grant_pass(firestore_db, "p2", "pass", remaining=1, chat_turns=0)
    res = await quota.consume_chat_turn(firestore_db, "p2")
    assert res.status == "exhausted"


# ── daily ceiling ──────────────────────────────────────────────────────────────

async def test_daily_counter_increments_then_blocks(firestore_db):
    r1 = await quota.check_and_increment_daily(firestore_db, "f1", limit=2)
    assert (r1.over_limit, r1.count) == (False, 1)
    r2 = await quota.check_and_increment_daily(firestore_db, "f1", limit=2)
    assert (r2.over_limit, r2.count) == (False, 2)
    r3 = await quota.check_and_increment_daily(firestore_db, "f1", limit=2)
    assert r3.over_limit is True  # third turn blocked, not incremented


# ── enforce_turn_limits (the gate's guard) ──────────────────────────────────────

@pytest.fixture
def _use_emulator_db(firestore_db, monkeypatch):
    monkeypatch.setattr(handlers, "_quota_db", lambda: firestore_db)
    return firestore_db


async def test_free_user_blocked_after_daily_limit(_use_emulator_db, monkeypatch):
    monkeypatch.setattr(handlers, "FREE_DAILY_TURN_LIMIT", 1)
    await handlers.enforce_turn_limits("free-blocked")  # 1st turn ok
    with pytest.raises(HTTPException) as exc:
        await handlers.enforce_turn_limits("free-blocked")  # 2nd turn blocked
    assert exc.value.status_code == 429
    assert exc.value.detail["reason"] == "daily_limit"


async def test_paid_user_blocked_when_chat_turns_exhausted(_use_emulator_db):
    await grant_pass(_use_emulator_db, "paid-x", "pass", remaining=1, chat_turns=1)
    await handlers.enforce_turn_limits("paid-x")  # consumes the one turn
    with pytest.raises(HTTPException) as exc:
        await handlers.enforce_turn_limits("paid-x")  # now exhausted
    assert exc.value.status_code == 429
    assert exc.value.detail["reason"] == "chat_turns_exhausted"


async def test_chat_turn_logs_credit_event(_use_emulator_db):
    await grant_pass(_use_emulator_db, "log-u", "pass", remaining=5, chat_turns=3)
    await handlers.enforce_turn_limits("log-u")
    events = [
        d.to_dict()
        async for d in _use_emulator_db.collection("credit_events").stream()
    ]
    chat = [e for e in events if e.get("toolName") == "chat_turn"]
    assert len(chat) == 1
    assert chat[0]["uid"] == "log-u"
    assert chat[0]["cost"] == 0
    assert chat[0]["balanceAfter"] == 2
    assert chat[0]["passId"] == "pass"


async def test_free_daily_chat_turn_logs_credit_event(_use_emulator_db, monkeypatch):
    monkeypatch.setattr(handlers, "FREE_DAILY_TURN_LIMIT", 5)
    await handlers.enforce_turn_limits("free-log")
    events = [
        d.to_dict()
        async for d in _use_emulator_db.collection("credit_events").stream()
    ]
    chat = [e for e in events if e.get("toolName") == "chat_turn"]
    assert len(chat) == 1
    assert chat[0]["balanceAfter"] == 4  # 5 - 1 turn used


async def test_log_event_failure_still_allows_turn(_use_emulator_db, monkeypatch):
    """Turn is consumed before ledger log; logging must not fail-open the gate."""
    monkeypatch.setattr(handlers, "FREE_DAILY_TURN_LIMIT", 5)

    async def boom(*_a, **_kw):
        raise RuntimeError("firestore down")

    monkeypatch.setattr(handlers, "log_event", boom)
    await handlers.enforce_turn_limits("free-log-fail")  # must not raise
