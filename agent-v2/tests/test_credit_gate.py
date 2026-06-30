"""Pre-turn gate: auth is enforced before any quota work; free users may chat.

The quota/chatBudget enforcement itself (Firestore-backed) is covered against
the emulator in ``test_quota.py``. Here we keep the gate's *ordering* contract
unit-testable by stubbing ``enforce_turn_limits``.
"""
from __future__ import annotations

import types

import pytest
from fastapi import HTTPException

from billing import handlers
from billing.handlers import CreditCheckHandler

pytestmark = pytest.mark.asyncio


def _info(uid):
    return types.SimpleNamespace(user_id=uid, session_id="s1", app_name="auto-consul")


@pytest.fixture(autouse=True)
def _stub_enforcement(monkeypatch):
    """Record enforcement calls without touching Firestore."""
    calls = []

    async def _fake(uid):
        calls.append(uid)

    monkeypatch.setattr(handlers, "enforce_turn_limits", _fake)
    return calls


async def test_guest_is_rejected(_stub_enforcement):
    handler = CreditCheckHandler()
    with pytest.raises(HTTPException) as exc:
        await handler.input_record(_info("guest"))
    assert exc.value.status_code == 401
    assert _stub_enforcement == []  # rejected before quota work


async def test_missing_uid_is_rejected(_stub_enforcement):
    handler = CreditCheckHandler()
    with pytest.raises(HTTPException) as exc:
        await handler.input_record(_info(None))
    assert exc.value.status_code == 401
    assert _stub_enforcement == []


async def test_signed_in_user_passes_auth_then_enforces(_stub_enforcement):
    """A signed-in user clears auth and reaches the quota guard exactly once."""
    handler = CreditCheckHandler()
    await handler.input_record(_info("free-user-123"))
    assert _stub_enforcement == ["free-user-123"]
