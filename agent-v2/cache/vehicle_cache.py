"""24-hour cache for RDW tool responses in Firestore vehicleCache.

Document id: rdw:{plate}. TTL field: ttlExpiresAt (24 hours).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from google.cloud import firestore

log = logging.getLogger("auto-consul.cache.rdw")

COLLECTION = "vehicleCache"
CACHE_TTL_HOURS = 24
SCHEMA_VERSION = 1


def _db() -> firestore.AsyncClient:
    return firestore.AsyncClient()


def _doc_id(plate: str) -> str:
    return f"rdw:{plate.upper().replace('-', '').replace(' ', '')}"


def _expires_at_ms(data: dict[str, Any]) -> int | None:
    exp = data.get("ttlExpiresAt")
    if exp is None:
        return None
    if hasattr(exp, "timestamp"):
        return int(exp.timestamp() * 1000)
    if hasattr(exp, "seconds"):
        return int(exp.seconds) * 1000
    return None


async def get_cached_rdw(plate: str) -> dict[str, Any] | None:
    """Return cached RDW payload if still within TTL, else None."""
    normalized = plate.upper().replace("-", "").replace(" ", "")
    try:
        snap = await _db().collection(COLLECTION).document(_doc_id(normalized)).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        exp_ms = _expires_at_ms(data)
        if exp_ms is not None and exp_ms <= int(datetime.now(timezone.utc).timestamp() * 1000):
            return None
        payload = data.get("payload")
        if not isinstance(payload, dict):
            return None
        fetched = data.get("fetchedAt")
        cached_at = None
        if hasattr(fetched, "timestamp"):
            cached_at = datetime.fromtimestamp(fetched.timestamp(), tz=timezone.utc).isoformat()
        out = dict(payload)
        if cached_at:
            out["cachedAt"] = cached_at
        return out
    except Exception as exc:  # pragma: no cover
        log.warning("vehicleCache read failed plate=%s: %s", plate, exc)
        return None


async def put_cached_rdw(plate: str, payload: dict[str, Any]) -> None:
    """Store a successful RDW lookup with 24h TTL."""
    if not payload.get("found"):
        return
    normalized = plate.upper().replace("-", "").replace(" ", "")
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=CACHE_TTL_HOURS)
    clean = {k: v for k, v in payload.items() if k != "cachedAt"}
    doc = {
        "key": normalized,
        "kind": "plate",
        "source": "rdw",
        "schemaVersion": SCHEMA_VERSION,
        "fetchedAt": now,
        "ttlExpiresAt": expires,
        "payload": clean,
    }
    try:
        await _db().collection(COLLECTION).document(_doc_id(normalized)).set(doc, merge=True)
    except Exception as exc:  # pragma: no cover
        log.warning("vehicleCache write failed plate=%s: %s", plate, exc)
