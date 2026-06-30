"""Credit ledger tests - run against the Firestore emulator.

These exercise real transactions, so they are skipped unless
FIRESTORE_EMULATOR_HOST is set (see conftest.firestore_db).
"""
from __future__ import annotations

import pytest

from billing import ledger
from tests.conftest import grant_pass

pytestmark = pytest.mark.asyncio


async def test_find_active_pass_returns_pass_with_credits(firestore_db):
    await grant_pass(firestore_db, "u1", "p1", remaining=3)
    found = await ledger.find_active_pass(firestore_db, "u1")
    assert found is not None
    assert found.pass_id == "p1"
    assert found.remaining == 3


async def test_find_active_pass_ignores_exhausted_and_inactive(firestore_db):
    await grant_pass(firestore_db, "u2", "empty", remaining=0)
    await grant_pass(firestore_db, "u2", "expired", remaining=5, status="EXPIRED")
    assert await ledger.find_active_pass(firestore_db, "u2") is None


async def test_find_active_pass_none_for_unknown_user(firestore_db):
    assert await ledger.find_active_pass(firestore_db, "ghost") is None


async def test_debit_charges_and_decrements(firestore_db):
    await grant_pass(firestore_db, "u3", "p1", remaining=2)

    r1 = await ledger.debit(firestore_db, uid="u3", tool_name="ai_analysis_deep", cost=1, plate="AB123C")
    assert r1.charged is True
    assert r1.balance_after == 1
    assert r1.pass_id == "p1"

    r2 = await ledger.debit(firestore_db, uid="u3", tool_name="ai_analysis_deep", cost=1, plate="AB123C")
    assert r2.charged is True
    assert r2.balance_after == 0


async def test_debit_refuses_when_no_credits(firestore_db):
    await grant_pass(firestore_db, "u4", "p1", remaining=0)
    r = await ledger.debit(firestore_db, uid="u4", tool_name="ai_analysis_deep", cost=1, plate="X")
    assert r.charged is False
    assert r.reason == "no_credits"


async def test_debit_writes_one_event_per_charge(firestore_db):
    await grant_pass(firestore_db, "u5", "p1", remaining=2)
    await ledger.debit(firestore_db, uid="u5", tool_name="ai_analysis_deep", cost=1, plate="P1")
    await ledger.debit(firestore_db, uid="u5", tool_name="ai_analysis_deep", cost=1, plate="P1")

    events = [d.to_dict() async for d in firestore_db.collection("credit_events").stream()]
    charged = [e for e in events if e["uid"] == "u5"]
    assert len(charged) == 2
    assert all(e["cost"] == 1 for e in charged)
    assert all(e["toolName"] == "ai_analysis_deep" for e in charged)
    assert {e["balanceAfter"] for e in charged} == {1, 0}


async def test_log_free_writes_zero_cost_event(firestore_db):
    await ledger.log_free(firestore_db, uid="u6", tool_name="ai_analysis_lite", plate="ZZ999Z")
    events = [d.to_dict() async for d in firestore_db.collection("credit_events").stream()]
    free = [e for e in events if e["uid"] == "u6"]
    assert len(free) == 1
    assert free[0]["cost"] == 0
    assert free[0]["toolName"] == "ai_analysis_lite"


async def test_debit_balance_never_goes_negative(firestore_db):
    """Charging more than the balance must refuse, not overdraw."""
    await grant_pass(firestore_db, "u7", "p1", remaining=1)
    r = await ledger.debit(firestore_db, uid="u7", tool_name="ai_analysis_deep", cost=2, plate="P")
    assert r.charged is False
    found = await ledger.find_active_pass(firestore_db, "u7")
    assert found.remaining == 1  # untouched
