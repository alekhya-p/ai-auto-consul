"""Firestore emulator: ADK sessions project into curated ``sessions/`` for Java API."""
from __future__ import annotations

import os

import pytest

from sessions.firestore_session_service import AdkFirestoreSessionService

from tests.conftest import PROJECT_ID

pytestmark = pytest.mark.asyncio


@pytest.fixture
def _emulator_project(firestore_db, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", PROJECT_ID)
    return firestore_db


async def test_create_session_writes_curated_projection(_emulator_project):
    db = _emulator_project
    svc = AdkFirestoreSessionService(project=PROJECT_ID)
    session_id = "verify-proj-001"
    await svc.create_session(
        app_name="auto-consul",
        user_id="uid-proj",
        state={"lang": "en", "title": "My BMW chat"},
        session_id=session_id,
    )

    snap = await db.collection("sessions").document(session_id).get()
    assert snap.exists
    data = snap.to_dict() or {}
    assert data["uid"] == "uid-proj"
    assert data["sessionId"] == session_id
    assert data["title"] == "My BMW chat"
    assert data["language"] == "en"
    assert "lastTurnAt" in data


async def test_delete_session_removes_curated_projection(_emulator_project):
    db = _emulator_project
    svc = AdkFirestoreSessionService(project=PROJECT_ID)
    session_id = "verify-proj-del"
    await svc.create_session(
        app_name="auto-consul",
        user_id="uid-proj",
        session_id=session_id,
    )
    await svc.delete_session(
        app_name="auto-consul",
        user_id="uid-proj",
        session_id=session_id,
    )
    snap = await db.collection("sessions").document(session_id).get()
    assert not snap.exists


async def test_upsert_keeps_first_title_on_later_turns(_emulator_project):
    db = _emulator_project
    from sessions.session_projection import upsert_curated_session

    session_id = "title-stick"
    await upsert_curated_session(
        db,
        uid="uid-title",
        session_id=session_id,
        title="First question about APK",
        language="nl",
    )
    await upsert_curated_session(
        db,
        uid="uid-title",
        session_id=session_id,
        title="Second unrelated question",
        language="nl",
    )
    snap = await db.collection("sessions").document(session_id).get()
    assert (snap.to_dict() or {}).get("title") == "First question about APK"


async def test_list_sessions_by_uid_order(_emulator_project):
    """Java ``GET /v1/sessions`` uses the same ``sessions`` collection."""
    db = _emulator_project
    from sessions.session_projection import upsert_curated_session
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    await upsert_curated_session(
        db,
        uid="uid-list",
        session_id="older",
        title="Older",
        language="nl",
        last_turn_at=now - timedelta(hours=2),
    )
    await upsert_curated_session(
        db,
        uid="uid-list",
        session_id="newer",
        title="Newer",
        language="nl",
        last_turn_at=now,
    )

    rows = []
    async for doc in db.collection("sessions").where("uid", "==", "uid-list").stream():
        data = doc.to_dict() or {}
        rows.append((data.get("sessionId"), data.get("lastTurnAt")))
    rows.sort(key=lambda r: r[1] or "", reverse=True)
    ids = [r[0] for r in rows]
    assert ids[0] == "newer"
    assert "older" in ids
