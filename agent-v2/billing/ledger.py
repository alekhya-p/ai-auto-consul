"""Credit ledger for paid tool usage.

Balance is stored on users/{uid}/passes/{passId}.credits.remaining. Each debit
appends a row to credit_events. Passes are created by Firebase Functions;
this module reads balances and debits only.

Debits use the soonest-expiring pass that has enough credits remaining.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from google.cloud import firestore

from billing.pass_selector import PassCandidate, credits_remaining, list_active_passes_fifo

log = logging.getLogger("auto-consul.ledger")

CREDIT_EVENTS = "credit_events"


@dataclass(frozen=True)
class ActivePass:
    """Pass with credits remaining, selected for entitlement checks."""

    pass_id: str
    remaining: int


@dataclass(frozen=True)
class DebitResult:
    """Outcome of a debit attempt."""

    charged: bool
    balance_after: int
    pass_id: str | None = None
    reason: str | None = None


async def find_active_pass(db: firestore.AsyncClient, uid: str) -> ActivePass | None:
    """First FIFO pass that still has credits."""
    for candidate in await list_active_passes_fifo(db, uid):
        remaining = credits_remaining(candidate.data)
        if remaining > 0:
            return ActivePass(pass_id=candidate.pass_id, remaining=remaining)
    return None


async def log_event(
    db: firestore.AsyncClient,
    *,
    uid: str,
    pass_id: str | None,
    tool_name: str,
    cost: int,
    balance_after: int,
    plate: str | None,
    source: str | None = None,
    cache_hit: bool | None = None,
    model: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    latency_ms: int | None = None,
) -> None:
    """Append one row to credit_events (audit and admin analytics)."""
    event_id = str(uuid.uuid4())
    data: dict = {
        "uid": uid,
        "toolName": tool_name,
        "cost": cost,
        "balanceAfter": balance_after,
        "timestamp": firestore.SERVER_TIMESTAMP,
    }
    if pass_id is not None:
        data["passId"] = pass_id
    if plate is not None:
        data["plateContext"] = plate
    if source is not None:
        data["source"] = source
    if cache_hit is not None:
        data["cacheHit"] = cache_hit
    if model is not None:
        data["model"] = model
    if input_tokens is not None:
        data["inputTokens"] = input_tokens
    if output_tokens is not None:
        data["outputTokens"] = output_tokens
    if latency_ms is not None:
        data["latencyMs"] = latency_ms
    await db.collection(CREDIT_EVENTS).document(event_id).set(data)


async def log_free(
    db: firestore.AsyncClient,
    *,
    uid: str,
    tool_name: str,
    plate: str | None,
) -> None:
    """Record a zero-cost tool call for usage history."""
    await log_event(
        db,
        uid=uid,
        pass_id=None,
        tool_name=tool_name,
        cost=0,
        balance_after=0,
        plate=plate,
    )


def _pick_pass_for_debit(candidates: list[PassCandidate], cost: int) -> PassCandidate | None:
    for c in candidates:
        if credits_remaining(c.data) >= cost:
            return c
    return None


async def debit(
    db: firestore.AsyncClient,
    *,
    uid: str,
    tool_name: str,
    cost: int,
    plate: str | None,
    source: str | None = None,
    cache_hit: bool | None = None,
) -> DebitResult:
    """Charge cost credits on the soonest-expiring pass, in one transaction."""
    event_ref = db.collection(CREDIT_EVENTS).document(str(uuid.uuid4()))
    transaction = db.transaction()

    @firestore.async_transactional
    async def _txn(txn) -> DebitResult:
        candidates = await list_active_passes_fifo(db, uid, transaction=txn)
        chosen = _pick_pass_for_debit(candidates, cost)
        if chosen is None:
            return DebitResult(charged=False, balance_after=0, reason="no_credits")

        snap = await chosen.ref.get(transaction=txn)
        data = snap.to_dict() or {}
        chosen_remaining = credits_remaining(data)
        if chosen_remaining < cost:
            return DebitResult(charged=False, balance_after=0, reason="no_credits")

        new_remaining = chosen_remaining - cost
        txn.update(chosen.ref, {"credits.remaining": new_remaining})
        event: dict = {
            "uid": uid,
            "passId": chosen.pass_id,
            "toolName": tool_name,
            "cost": cost,
            "balanceAfter": new_remaining,
            "plateContext": plate,
            "timestamp": firestore.SERVER_TIMESTAMP,
        }
        if source is not None:
            event["source"] = source
        if cache_hit is not None:
            event["cacheHit"] = cache_hit
        txn.set(event_ref, event)
        return DebitResult(
            charged=True,
            balance_after=new_remaining,
            pass_id=chosen.pass_id,
        )

    try:
        return await _txn(transaction)
    except Exception as exc:  # pragma: no cover
        log.warning("debit failed uid=%s tool=%s: %s", uid, tool_name, exc)
        return DebitResult(charged=False, balance_after=0, reason="error")
