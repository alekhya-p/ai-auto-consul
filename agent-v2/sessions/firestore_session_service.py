"""Firestore session store for ADK chat history.

Documents live at adk_sessions/{appName__userId__sessionId} with an events
subcollection. Same layout as the Java FirestoreSessionService.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from google.adk.events.event import Event
from google.adk.platform import time as platform_time
from google.adk.sessions.base_session_service import BaseSessionService, GetSessionConfig
from google.adk.sessions.base_session_service import ListSessionsResponse
from google.adk.sessions.session import Session
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from typing_extensions import override

from sessions.session_projection import (
    delete_curated_session,
    language_from_state,
    upsert_curated_session,
    user_snippet_from_event,
)

log = logging.getLogger("auto-consul.sessions")

COLLECTION = "adk_sessions"
EVENTS_SUB = "events"
DEFAULT_PAGE_SIZE = 200
SCHEMA_VERSION = 1


def compound_key(app_name: str, user_id: str, session_id: str) -> str:
    return f"{app_name}__{user_id}__{session_id}"


def _ts_now() -> datetime:
    return datetime.now(timezone.utc)


def _ts_from_doc(value: Any) -> float:
    if value is None:
        return platform_time.get_time()
    if hasattr(value, "timestamp"):
        return float(value.timestamp())
    if hasattr(value, "seconds"):
        return float(value.seconds) + float(getattr(value, "nanos", 0)) / 1e9
    return platform_time.get_time()


class AdkFirestoreSessionService(BaseSessionService):
    """Durable session store for Cloud Run / multi-instance agent-v2."""

    def __init__(
        self,
        *,
        project: str | None = None,
        database: str | None = None,
    ) -> None:
        project = project or os.environ.get("GOOGLE_CLOUD_PROJECT")
        self._db = firestore.AsyncClient(project=project, database=database)

    def _session_ref(self, app_name: str, user_id: str, session_id: str):
        return self._db.collection(COLLECTION).document(
            compound_key(app_name, user_id, session_id)
        )

    @override
    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        sid = (session_id or "").strip() or f"sess_{uuid.uuid4()}"
        now = _ts_now()
        seed = dict(state or {})
        doc = {
            "appName": app_name,
            "userId": user_id,
            "sessionId": sid,
            "state": seed,
            "createdAt": now,
            "lastUpdateTime": now,
            "schemaVersion": SCHEMA_VERSION,
        }
        await self._session_ref(app_name, user_id, sid).set(doc)
        await upsert_curated_session(
            self._db,
            uid=user_id,
            session_id=sid,
            title=(seed.get("title") if isinstance(seed.get("title"), str) else None),
            language=language_from_state(seed),
            last_turn_at=now,
        )
        return Session(
            app_name=app_name,
            user_id=user_id,
            id=sid,
            state=seed,
            events=[],
            last_update_time=now.timestamp(),
        )

    async def _read_events(
        self, app_name: str, user_id: str, session_id: str
    ) -> list[Event]:
        ref = self._session_ref(app_name, user_id, session_id)
        events: list[Event] = []
        try:
            query = ref.collection(EVENTS_SUB).order_by("createdAt")
            async for snap in query.stream():
                data = snap.to_dict() or {}
                raw = data.get("json")
                if not raw:
                    continue
                try:
                    events.append(Event.model_validate_json(raw))
                except Exception as exc:
                    log.warning(
                        "skip malformed event id=%s session=%s: %s",
                        snap.id,
                        session_id,
                        exc,
                    )
        except Exception as exc:
            log.warning("read_events failed session=%s: %s", session_id, exc)
        return events

    @override
    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        snap = await self._session_ref(app_name, user_id, session_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        state = data.get("state") or {}
        events = await self._read_events(app_name, user_id, session_id)
        if config:
            if config.num_recent_events is not None:
                if config.num_recent_events == 0:
                    events = []
                else:
                    events = events[-config.num_recent_events :]
            if config.after_timestamp is not None:
                events = [e for e in events if e.timestamp >= config.after_timestamp]
        return Session(
            app_name=app_name,
            user_id=user_id,
            id=session_id,
            state=dict(state),
            events=events,
            last_update_time=_ts_from_doc(data.get("lastUpdateTime")),
        )

    @override
    async def list_sessions(
        self, *, app_name: str, user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        if user_id is None:
            return ListSessionsResponse(sessions=[])
        query = (
            self._db.collection(COLLECTION)
            .where(filter=FieldFilter("appName", "==", app_name))
            .where(filter=FieldFilter("userId", "==", user_id))
            .order_by("lastUpdateTime", direction=firestore.Query.DESCENDING)
            .limit(DEFAULT_PAGE_SIZE)
        )
        out: list[Session] = []
        async for snap in query.stream():
            data = snap.to_dict() or {}
            sid = data.get("sessionId") or snap.id.split("__")[-1]
            out.append(
                Session(
                    app_name=app_name,
                    user_id=user_id,
                    id=sid,
                    state=dict(data.get("state") or {}),
                    events=[],
                    last_update_time=_ts_from_doc(data.get("lastUpdateTime")),
                )
            )
        return ListSessionsResponse(sessions=out)

    @override
    async def delete_session(
        self, *, app_name: str, user_id: str, session_id: str
    ) -> None:
        ref = self._session_ref(app_name, user_id, session_id)
        while True:
            batch = self._db.batch()
            count = 0
            async for snap in ref.collection(EVENTS_SUB).limit(100).stream():
                batch.delete(snap.reference)
                count += 1
            if count == 0:
                break
            await batch.commit()
        await ref.delete()
        await delete_curated_session(self._db, session_id=session_id)

    @override
    async def append_event(self, session: Session, event: Event) -> Event:
        if event.partial:
            return event
        event = await super().append_event(session=session, event=event)
        app_name = session.app_name
        user_id = session.user_id
        session_id = session.id
        ref = self._session_ref(app_name, user_id, session_id)
        event_id = event.id or Event.new_id()
        if not event.id:
            event.id = event_id
        now = _ts_now()
        await ref.collection(EVENTS_SUB).document(event_id).set(
            {
                "eventId": event_id,
                "json": event.model_dump_json(),
                "createdAt": now,
            }
        )
        await ref.update({"lastUpdateTime": now})
        session.last_update_time = event.timestamp
        snippet = user_snippet_from_event(event)
        await upsert_curated_session(
            self._db,
            uid=user_id,
            session_id=session_id,
            title=snippet,
            language=language_from_state(session.state),
            last_turn_at=now,
        )
        return event
