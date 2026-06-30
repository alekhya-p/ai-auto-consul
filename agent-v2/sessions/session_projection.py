"""Mirror ADK sessions into the curated sessions/ collection for the REST API."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from google.adk.events.event import Event
from google.cloud import firestore

log = logging.getLogger("auto-consul.sessions.projection")

CURATED = "sessions"
DEFAULT_TITLE = "Untitled chat"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def user_snippet_from_event(event: Event) -> Optional[str]:
    """First user text in an ADK event, for session title."""
    try:
        raw = event.model_dump(mode="json")
    except Exception:
        return None
    author = str(raw.get("author") or raw.get("role") or "").lower()
    if author and author not in ("user", "human"):
        return None
    content = raw.get("content")
    if not isinstance(content, dict):
        return None
    parts = content.get("parts")
    if not isinstance(parts, list):
        return None
    for part in parts:
        if not isinstance(part, dict):
            continue
        text = part.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()[:50]
    return None


async def upsert_curated_session(
    db: firestore.AsyncClient,
    *,
    uid: str,
    session_id: str,
    title: Optional[str] = None,
    language: str = "nl",
    pass_id: Optional[str] = None,
    last_turn_at: Optional[datetime] = None,
) -> None:
    """Mirror one chat thread into ``sessions/{sessionId}`` (Java SessionsController)."""
    if not uid or not session_id:
        return
    now = last_turn_at or _now()
    ref = db.collection(CURATED).document(session_id)
    try:
        snap = await ref.get()
        existing = snap.to_dict() if snap.exists else {}
        existing_title = existing.get("title")
        if existing_title:
            final_title = str(existing_title).strip()[:80] or DEFAULT_TITLE
        else:
            final_title = (title or DEFAULT_TITLE).strip()[:80] or DEFAULT_TITLE
        doc: dict[str, Any] = {
            "sessionId": session_id,
            "uid": uid,
            "title": final_title or DEFAULT_TITLE,
            "language": language or existing.get("language") or "nl",
            "createdAt": existing.get("createdAt") or now,
            "lastTurnAt": now,
            "schemaVersion": 1,
        }
        pid = pass_id or existing.get("passId")
        if pid:
            doc["passId"] = pid
        await ref.set(doc, merge=True)
    except Exception as exc:
        log.warning("curated session projection failed session=%s: %s", session_id, exc)


async def delete_curated_session(
    db: firestore.AsyncClient, *, session_id: str
) -> None:
    if not session_id:
        return
    try:
        await db.collection(CURATED).document(session_id).delete()
    except Exception as exc:
        log.warning("curated session delete failed session=%s: %s", session_id, exc)


def language_from_state(state: Optional[dict[str, Any]]) -> str:
    if not state:
        return "nl"
    lang = state.get("language") or state.get("lang")
    if isinstance(lang, str) and lang.lower().startswith("en"):
        return "en"
    return "nl"
