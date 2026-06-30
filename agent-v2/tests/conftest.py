"""Shared pytest fixtures for the agent-v2 test suite.

Unit tests run anywhere (they mock Firestore / genai).  Integration tests that
need real Firestore transactions use the ``firestore_db`` fixture, which is
skipped unless ``FIRESTORE_EMULATOR_HOST`` points at a running emulator:

    gcloud emulators firestore start --host-port=127.0.0.1:8085 &
    export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
    python -m pytest
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

# Make the agent-v2 package importable as top-level modules (billing, tools…).
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

PROJECT_ID = "auto-consul-test"


@pytest.fixture
async def firestore_db():
    """Async Firestore client bound to the local emulator.

    Skips the test if no emulator is configured so the unit suite still runs in
    environments without one.  Wipes the collections this suite touches before
    each test for isolation.
    """
    if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
        pytest.skip("FIRESTORE_EMULATOR_HOST not set - skipping Firestore integration test")

    from google.cloud import firestore

    db = firestore.AsyncClient(project=PROJECT_ID)
    await _wipe(db)
    yield db
    await _wipe(db)
    db.close()


async def _wipe(db) -> None:
    """Delete all docs the suite creates so tests don't bleed into each other."""
    async for doc in db.collection("credit_events").stream():
        await doc.reference.delete()
    async for doc in db.collection("vehicleCache").stream():
        await doc.reference.delete()
    async for doc in db.collection("analysis_cache").stream():
        await doc.reference.delete()
    async for doc in db.collection("sessions").stream():
        await doc.reference.delete()
    async for doc in db.collection("adk_sessions").stream():
        async for ev in doc.reference.collection("events").stream():
            await ev.reference.delete()
        await doc.reference.delete()
    async for user in db.collection("users").stream():
        for sub in ("passes", "dailyCounters"):
            async for d in user.reference.collection(sub).stream():
                await d.reference.delete()
        await user.reference.delete()


async def grant_pass(
    db,
    uid: str,
    pass_id: str,
    remaining: int,
    status: str = "ACTIVE",
    chat_turns: int | None = None,
    *,
    expires_in_days: int = 30,
) -> None:
    """Test helper: create a pass with a credit balance, like a Stripe grant.

    ``chat_turns`` seeds ``chatBudget.remaining`` (defaults to ``remaining``).
    ``expires_in_days`` sets ``expiresAt`` for FIFO ordering tests."""
    turns = remaining if chat_turns is None else chat_turns
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    await (
        db.collection("users")
        .document(uid)
        .collection("passes")
        .document(pass_id)
        .set(
            {
                "status": status,
                "credits": {"remaining": remaining, "total": remaining},
                "chatBudget": {"remaining": turns, "initial": turns},
                "expiresAt": expires_at,
                "purchasedAt": datetime.now(timezone.utc),
            }
        )
    )


class FakeGenAIResponse:
    """Mimics the genai SDK response object - only ``.text`` is used."""

    def __init__(self, text: str) -> None:
        self.text = text


class FakeGenAIModels:
    def __init__(self, recorder: list, text: str) -> None:
        self._recorder = recorder
        self._text = text

    async def generate_content(self, *, model, contents, config=None):
        self._recorder.append({"model": model, "contents": contents})
        return FakeGenAIResponse(self._text)


class FakeGenAIClient:
    """Stand-in for ``google.genai.Client`` that records which model was used."""

    def __init__(self, text: str) -> None:
        self.calls: list = []
        self.aio = type("aio", (), {"models": FakeGenAIModels(self.calls, text)})()


class FakeToolContext:
    """Minimal ADK ToolContext stand-in exposing ``user_id`` and ``state``."""

    def __init__(self, user_id: str, state: dict | None = None) -> None:
        self.user_id = user_id
        self.state = state or {}
