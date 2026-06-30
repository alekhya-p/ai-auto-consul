"""Pre-turn gate on every chat message.

Runs once per inbound turn through ConsulIORecorder, before the ADK agent starts.

Checks, in order:
  1. Firebase auth - reject missing or guest uid (401).
  2. Chat budget - decrement chatBudget on the soonest-expiring pass; if no pass,
     apply the free daily turn limit.
  3. Return 429 with upgradeUrl when limits are exceeded.

Deep analysis credits are debited inside the analysis tool, not here.
"""
from __future__ import annotations

import logging
import os

from adk_agui_middleware.base_abc.handler import BaseInOutHandler
from adk_agui_middleware.data_model.common import InputInfo
from ag_ui.core import BaseEvent
from fastapi import HTTPException

from billing import quota
from billing.ledger import log_event

log = logging.getLogger("auto-consul.billing.handlers")

FREE_DAILY_TURN_LIMIT = int(os.environ.get("FREE_DAILY_TURN_LIMIT", "20"))

_db = None


def _quota_db():
    global _db
    if _db is None:
        from google.cloud import firestore

        _db = firestore.AsyncClient()
    return _db


async def enforce_turn_limits(uid: str) -> None:
    """Apply chat-turn or daily-limit rules for one authenticated user.

    Raises HTTP 429 when over limit. Allows the turn on quota read errors.
    """
    db = _quota_db()
    turn = await quota.consume_chat_turn(db, uid)

    if turn.status == "no_pass":
        daily = await quota.check_and_increment_daily(db, uid, FREE_DAILY_TURN_LIMIT)
        if daily.over_limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "reason": "daily_limit",
                    "kind": "ai",
                    "limit": FREE_DAILY_TURN_LIMIT,
                    "upgradeUrl": "/prijzen",
                },
            )
        remaining_daily = max(0, FREE_DAILY_TURN_LIMIT - daily.count)
        try:
            await log_event(
                db,
                uid=uid,
                pass_id=None,
                tool_name="chat_turn",
                cost=0,
                balance_after=remaining_daily,
                plate=None,
            )
        except Exception as exc:
            log.warning("chat_turn log failed uid=%s: %s", uid, exc)
    elif turn.status == "exhausted":
        raise HTTPException(
            status_code=429,
            detail={
                "reason": "chat_turns_exhausted",
                "kind": "ai",
                "upgradeUrl": "/prijzen",
            },
        )
    elif turn.status == "consumed":
        try:
            await log_event(
                db,
                uid=uid,
                pass_id=turn.pass_id,
                tool_name="chat_turn",
                cost=0,
                balance_after=turn.remaining,
                plate=None,
            )
        except Exception as exc:
            log.warning("chat_turn log failed uid=%s: %s", uid, exc)


class CreditCheckHandler(BaseInOutHandler):
    """Auth and per-turn quota before each agent run."""

    async def input_record(self, input_info: InputInfo) -> None:
        uid = input_info.user_id
        if not uid or uid == "guest":
            raise HTTPException(status_code=401, detail="Unauthenticated")
        await enforce_turn_limits(uid)

    async def output_record(self, agui_event: BaseEvent) -> None:
        pass

    async def output_catch_and_change(self, agui_event: BaseEvent) -> BaseEvent:
        return agui_event
