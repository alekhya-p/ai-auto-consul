"""Runtime configuration and ADK/AG-UI wiring.

Builds ConfigContext and HandlerContext for the SSE service. Session backend
defaults to Firestore when a GCP project or emulator is configured, otherwise
in-memory for local work.
"""
from __future__ import annotations

import logging
import os

from ag_ui.core import RunAgentInput
from fastapi import Request
from adk_agui_middleware.data_model.config import RunnerConfig
from adk_agui_middleware.data_model.context import ConfigContext, HandlerContext
from auth import extract_user_id
from middleware import (
    InMemorySessionLock,
    ConsulIORecorder,
    ConsulStateHandler,
)

log = logging.getLogger("auto-consul.settings")

MODEL_NAME = os.environ.get("MODEL_NAME", "gemini-2.5-flash")
LITE_MODEL = os.environ.get("LITE_MODEL", MODEL_NAME)
DEEP_MODEL = os.environ.get("DEEP_MODEL", "gemini-2.5-pro")
AI_ANALYSIS_DEEP_COST = int(os.environ.get("AI_ANALYSIS_DEEP_COST", "1"))
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "europe-west4")
PORT = int(os.environ.get("PORT", "8080"))

os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")


async def extract_session_id(content: RunAgentInput, request: Request) -> str:
    """Map AG-UI thread_id to the ADK session id."""
    return getattr(content, "thread_id", None) or request.headers.get("X-Session-Id", "default")


_extract_session_id = extract_session_id


async def history_session_id(request: Request) -> str:
    """Session id from history URL path (e.g. message_snapshot/{thread_id})."""
    return request.path_params.get("thread_id", "")


def make_config_context() -> ConfigContext:
    return ConfigContext(
        app_name="auto-consul",
        user_id=extract_user_id,
        session_id=extract_session_id,
        event_source_response_mode=False,
    )


def make_handler_context() -> HandlerContext:
    return HandlerContext(
        session_lock_handler=InMemorySessionLock,
        in_out_record_handler=ConsulIORecorder,
        agui_state_snapshot_handler=ConsulStateHandler,
    )


_session_service: "object | None" = None


def _use_firestore_sessions() -> bool:
    backend = os.environ.get("SESSION_BACKEND", "auto").lower()
    if backend == "memory":
        return False
    if backend == "firestore":
        return True
    return bool(
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("FIRESTORE_EMULATOR_HOST")
    )


def get_session_service():
    """Shared session store for chat runs and history (singleton)."""
    global _session_service
    if _session_service is None:
        if _use_firestore_sessions():
            try:
                from sessions.firestore_session_service import AdkFirestoreSessionService

                _session_service = AdkFirestoreSessionService()
                log.info("ADK session backend: firestore (adk_sessions)")
            except Exception as exc:
                log.warning(
                    "Firestore session backend unavailable (%s); using in-memory",
                    exc,
                )
                from google.adk.sessions import InMemorySessionService

                _session_service = InMemorySessionService()
        else:
            from google.adk.sessions import InMemorySessionService

            _session_service = InMemorySessionService()
            log.info("ADK session backend: in-memory (dev)")
    return _session_service


def make_runner_config() -> RunnerConfig:
    return RunnerConfig(
        session_service=get_session_service(),
        use_in_memory_services=True,
    )
