"""FIFO pass consumption - oldest ``expiresAt`` debited first."""
from __future__ import annotations

import pytest

from billing import ledger, quota
from tests.conftest import grant_pass

pytestmark = pytest.mark.asyncio


async def test_debit_uses_oldest_expiring_pass_first(firestore_db):
    await grant_pass(firestore_db, "fifo-u1", "newer", remaining=1, expires_in_days=30)
    await grant_pass(firestore_db, "fifo-u1", "older", remaining=1, expires_in_days=2)

    result = await ledger.debit(
        firestore_db,
        uid="fifo-u1",
        tool_name="ai_analysis_deep",
        cost=1,
        plate="AB123C",
    )
    assert result.charged is True
    assert result.pass_id == "older"

    older_snap = await (
        firestore_db.collection("users")
        .document("fifo-u1")
        .collection("passes")
        .document("older")
        .get()
    )
    newer_snap = await (
        firestore_db.collection("users")
        .document("fifo-u1")
        .collection("passes")
        .document("newer")
        .get()
    )
    assert (older_snap.to_dict() or {})["credits"]["remaining"] == 0
    assert (newer_snap.to_dict() or {})["credits"]["remaining"] == 1


async def test_chat_turn_uses_oldest_expiring_pass_first(firestore_db):
    await grant_pass(
        firestore_db, "fifo-u2", "newer", remaining=0, chat_turns=5, expires_in_days=30
    )
    await grant_pass(
        firestore_db, "fifo-u2", "older", remaining=0, chat_turns=3, expires_in_days=2
    )

    turn = await quota.consume_chat_turn(firestore_db, "fifo-u2")
    assert turn.status == "consumed"
    assert turn.remaining == 2

    older = (
        await firestore_db.collection("users")
        .document("fifo-u2")
        .collection("passes")
        .document("older")
        .get()
    )
    newer = (
        await firestore_db.collection("users")
        .document("fifo-u2")
        .collection("passes")
        .document("newer")
        .get()
    )
    assert (older.to_dict() or {})["chatBudget"]["remaining"] == 2
    assert (newer.to_dict() or {})["chatBudget"]["remaining"] == 5
