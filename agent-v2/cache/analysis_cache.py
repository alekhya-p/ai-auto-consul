"""24-hour cache for AI analysis tool output.

Lite results are keyed by plate+lang (shared). Deep results are keyed by
uid+plate+lang so paid output is per user. TTL: 24 hours.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from google.cloud import firestore

log = logging.getLogger("auto-consul.cache.analysis")

COLLECTION = "analysis_cache"
CACHE_TTL_HOURS = 24


def _db() -> firestore.AsyncClient:
    return firestore.AsyncClient()


def _doc_id(*, plate: str, lang: str, tier: str, uid: str | None) -> str:
    normalized = plate.upper().replace("-", "").replace(" ", "")
    lang = "en" if lang == "en" else "nl"
    if tier == "deep" and uid:
        return f"{uid}__{normalized}__{lang}__deep"
    return f"{normalized}__{lang}__lite"


def _expires_at_ms(data: dict[str, Any]) -> int | None:
    exp = data.get("ttlExpiresAt")
    if exp is None:
        return None
    if hasattr(exp, "timestamp"):
        return int(exp.timestamp() * 1000)
    return None


async def get_cached_analysis(
    plate: str, *, lang: str, tier: str, uid: str | None
) -> dict[str, Any] | None:
    try:
        snap = await _db().collection(COLLECTION).document(
            _doc_id(plate=plate, lang=lang, tier=tier, uid=uid)
        ).get()
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
        out = dict(payload)
        if hasattr(fetched, "timestamp"):
            out["cachedAt"] = datetime.fromtimestamp(
                fetched.timestamp(), tz=timezone.utc
            ).isoformat()
        return out
    except Exception as exc:  # pragma: no cover
        log.warning("analysis_cache read failed plate=%s tier=%s: %s", plate, tier, exc)
        return None


async def put_cached_analysis(
    plate: str, *, lang: str, tier: str, uid: str | None, payload: dict[str, Any]
) -> None:
    if payload.get("error") or payload.get("found") is False:
        return
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=CACHE_TTL_HOURS)
    clean = {k: v for k, v in payload.items() if k != "cachedAt"}
    doc = {
        "plate": plate.upper().replace("-", "").replace(" ", ""),
        "lang": lang,
        "tier": tier,
        "uid": uid,
        "fetchedAt": now,
        "ttlExpiresAt": expires,
        "payload": clean,
    }
    try:
        await _db().collection(COLLECTION).document(
            _doc_id(plate=plate, lang=lang, tier=tier, uid=uid)
        ).set(doc, merge=True)
    except Exception as exc:  # pragma: no cover
        log.warning("analysis_cache write failed plate=%s: %s", plate, exc)
