"""In-process lock so one session cannot run two agent turns at once."""

from __future__ import annotations

import asyncio
from adk_agui_middleware.base_abc.handler import SessionLockHandler
from adk_agui_middleware.data_model.common import InputInfo, SessionLockConfig
from ag_ui.core import RunErrorEvent


class InMemorySessionLock(SessionLockHandler):
    _locks: dict[str, asyncio.Lock] = {}

    def __init__(self, lock_config: SessionLockConfig) -> None:
        self.lock_timeout = lock_config.lock_timeout
        self.retry_interval = lock_config.lock_retry_interval
        self.retry_count = lock_config.lock_retry_times

    @staticmethod
    def _key(info: InputInfo) -> str:
        return f"{info.app_name}:{info.user_id}:{info.session_id}"

    async def lock(self, input_info: InputInfo) -> bool:
        key = self._key(input_info)
        lock = self._locks.setdefault(key, asyncio.Lock())
        for _ in range(self.retry_count + 1):
            if not lock.locked():
                await lock.acquire()
                return True
            await asyncio.sleep(self.retry_interval)
        return False

    async def unlock(self, input_info: InputInfo) -> None:
        key = self._key(input_info)
        lock = self._locks.get(key)
        if lock and lock.locked():
            lock.release()

    async def get_locked_message(self, input_info: InputInfo) -> RunErrorEvent:
        return RunErrorEvent(
            id="session-locked",
            message=f"Session {self._key(input_info)} is locked by another request.",
        )
