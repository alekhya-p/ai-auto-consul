"""Pass selection for billing.

Credits and chat turns consume from the ACTIVE pass with the soonest expiresAt.
Shorter-lived passes (e.g. welcome) are used before longer paid packs when both
are active.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# Passes without expiresAt sort last (legacy or test documents).
_MAX_SORT_MS = 2**62 - 1


@dataclass(frozen=True)
class PassCandidate:
    """One ACTIVE pass document eligible for consumption."""

    ref: firestore.AsyncDocumentReference
    pass_id: str
    data: dict[str, Any]


def expires_at_sort_key(data: dict[str, Any]) -> int:
    """Sort key for FIFO ordering - lower expiresAt is consumed first."""
    exp = data.get("expiresAt")
    if exp is None:
        return _MAX_SORT_MS
    if hasattr(exp, "timestamp"):
        return int(exp.timestamp() * 1000)
    if hasattr(exp, "seconds"):
        return int(exp.seconds) * 1000
    return _MAX_SORT_MS


async def list_active_passes_fifo(
    db: firestore.AsyncClient,
    uid: str,
    *,
    limit: int = 10,
    transaction: firestore.AsyncTransaction | None = None,
) -> list[PassCandidate]:
    """List ACTIVE passes for uid, oldest expiresAt first."""
    passes = db.collection("users").document(uid).collection("passes")
    query = (
        passes.where(filter=FieldFilter("status", "==", "ACTIVE"))
        .order_by("expiresAt")
        .limit(limit)
    )
    candidates: list[PassCandidate] = []
    async for doc in query.stream(transaction=transaction):
        candidates.append(
            PassCandidate(ref=doc.reference, pass_id=doc.id, data=doc.to_dict() or {})
        )
    candidates.sort(key=lambda c: expires_at_sort_key(c.data))
    return candidates


def credits_remaining(data: dict[str, Any]) -> int:
    """Remaining credits on a pass document."""
    credits = data.get("credits") or {}
    try:
        return int(credits.get("remaining", 0) or 0)
    except (TypeError, ValueError):
        return 0


def chat_turns_remaining(data: dict[str, Any]) -> int:
    """Remaining chat turns on a pass document."""
    budget = data.get("chatBudget") or {}
    try:
        return int(budget.get("remaining", 0) or 0)
    except (TypeError, ValueError):
        return 0
