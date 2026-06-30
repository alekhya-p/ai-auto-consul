"""Chat turn quota before each agent run.

Users with an active pass consume chatBudget on the soonest-expiring pass.
Signed-in users without a pass are limited to a daily turn count (Amsterdam
calendar day, default 20).

Firestore errors fail open so a transient outage does not block chat.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from google.cloud import firestore

from billing.pass_selector import chat_turns_remaining, list_active_passes_fifo

log = logging.getLogger("auto-consul.quota")

try:
    from zoneinfo import ZoneInfo

    _AMS = ZoneInfo("Europe/Amsterdam")
except Exception:  # pragma: no cover
    _AMS = timezone.utc


def today_key(now: datetime | None = None) -> str:
    """Calendar date key for daily counters (Amsterdam timezone)."""
    return (now or datetime.now(_AMS)).astimezone(_AMS).strftime("%Y-%m-%d")


@dataclass(frozen=True)
class TurnResult:
    status: str
    remaining: int = 0
    pass_id: str | None = None


@dataclass(frozen=True)
class DailyResult:
    over_limit: bool
    count: int


async def consume_chat_turn(db: firestore.AsyncClient, uid: str) -> TurnResult:
    """Decrement chatBudget on the soonest-expiring pass that still has turns."""
    transaction = db.transaction()

    @firestore.async_transactional
    async def _txn(txn) -> TurnResult:
        candidates = await list_active_passes_fifo(db, uid, transaction=txn)
        has_active = bool(candidates)
        chosen = None
        chosen_remaining = 0
        for c in candidates:
            remaining = chat_turns_remaining(c.data)
            if remaining > 0:
                chosen = c
                chosen_remaining = remaining
                break

        if chosen is None:
            return TurnResult(status="exhausted" if has_active else "no_pass")

        new_remaining = chosen_remaining - 1
        txn.update(chosen.ref, {"chatBudget.remaining": new_remaining})
        return TurnResult(
            status="consumed",
            remaining=new_remaining,
            pass_id=chosen.pass_id,
        )

    try:
        return await _txn(transaction)
    except Exception as exc:  # pragma: no cover
        log.warning("consume_chat_turn failed uid=%s: %s", uid, exc)
        return TurnResult(status="error")


async def check_and_increment_daily(
    db: firestore.AsyncClient, uid: str, limit: int
) -> DailyResult:
    """Increment the user's daily turn counter; report if over the free ceiling."""
    day = today_key()
    doc_ref = (
        db.collection("users").document(uid).collection("dailyCounters").document(day)
    )
    transaction = db.transaction()

    @firestore.async_transactional
    async def _txn(txn) -> DailyResult:
        snap = await doc_ref.get(transaction=txn)
        count = 0
        if snap.exists:
            try:
                count = int((snap.to_dict() or {}).get("turns", 0) or 0)
            except (TypeError, ValueError):
                count = 0
        if count >= limit:
            return DailyResult(over_limit=True, count=count)
        txn.set(
            doc_ref,
            {"turns": count + 1, "date": day, "updatedAt": firestore.SERVER_TIMESTAMP},
            merge=True,
        )
        return DailyResult(over_limit=False, count=count + 1)

    try:
        return await _txn(transaction)
    except Exception as exc:  # pragma: no cover
        log.warning("daily quota check failed uid=%s: %s", uid, exc)
        return DailyResult(over_limit=False, count=0)
