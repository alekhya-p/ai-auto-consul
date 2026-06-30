"""AG-UI pipeline hooks around each chat turn.

ConsulIORecorder runs billing before the agent. ConsulStateHandler cleans state
sent back to the client. Session locking lives in lock.py.
"""
from __future__ import annotations

import logging
from typing import Any

from ag_ui.core import BaseEvent
from adk_agui_middleware.base_abc.handler import BaseAGUIStateSnapshotHandler
from adk_agui_middleware.data_model.common import InputInfo

from billing import CreditCheckHandler

log = logging.getLogger("auto-consul")


class ConsulIORecorder(CreditCheckHandler):
    """Pre-turn auth and quota, then log turn start."""

    async def input_record(self, input_info: InputInfo) -> None:
        await super().input_record(input_info)
        log.info("turn_start user=%s session=%s", input_info.user_id, input_info.session_id)

    async def output_record(self, agui_event: BaseEvent) -> None:
        pass

    async def output_catch_and_change(self, agui_event: BaseEvent) -> BaseEvent:
        return agui_event


class ConsulStateHandler(BaseAGUIStateSnapshotHandler):
    """Remove internal keys (underscore prefix) from AG-UI state snapshots."""

    def __init__(self, input_info: InputInfo | None) -> None:
        self.info = input_info

    async def process(self, state_snapshot: dict[str, Any]) -> dict[str, Any] | None:
        return {k: v for k, v in state_snapshot.items() if not k.startswith("_")}
