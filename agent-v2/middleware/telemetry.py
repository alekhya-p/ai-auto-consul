"""LLM call telemetry via ADK before/after_model hooks.

Each model invocation writes a credit_events row (tool_name=model_call) with
token counts and latency. cost is always 0; chat turns are billed separately.

Telemetry failures are logged and ignored.
"""
from __future__ import annotations

import logging
import time
from contextvars import ContextVar
from typing import Any

from billing import ledger
from config.settings import MODEL_NAME

log = logging.getLogger("auto-consul.telemetry")

_db: Any = None
_call_start_ms: ContextVar[float | None] = ContextVar("_call_start_ms", default=None)


def _telemetry_db():
    global _db
    if _db is None:
        from google.cloud import firestore

        _db = firestore.AsyncClient()
    return _db


def extract_usage(llm_response: Any) -> tuple[int | None, int | None]:
    """Input and output token counts from the model response, if present."""
    usage = getattr(llm_response, "usage_metadata", None)
    if usage is None:
        return None, None
    return (
        getattr(usage, "prompt_token_count", None),
        getattr(usage, "candidates_token_count", None),
    )


def _uid_from(callback_context: Any) -> str | None:
    inv = getattr(callback_context, "_invocation_context", None)
    session = getattr(inv, "session", None)
    return getattr(session, "user_id", None)


async def log_model_call(
    db,
    *,
    uid: str,
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
    latency_ms: int | None,
    plate: str | None = None,
) -> None:
    """Write a model_call row to credit_events."""
    await ledger.log_event(
        db,
        uid=uid,
        pass_id=None,
        tool_name="model_call",
        cost=0,
        balance_after=0,
        plate=plate,
        source="model",
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
    )


async def before_model(callback_context: Any, llm_request: Any):  # noqa: ARG001
    """ADK hook: record start time before each LLM call."""
    _call_start_ms.set(time.monotonic() * 1000.0)
    return None


async def after_model(callback_context: Any, llm_response: Any):
    """ADK hook: log tokens and latency after each LLM response."""
    try:
        start = _call_start_ms.get()
        latency_ms = int(time.monotonic() * 1000.0 - start) if start is not None else None
        uid = _uid_from(callback_context)
        if not uid:
            return None
        in_tok, out_tok = extract_usage(llm_response)
        await log_model_call(
            _telemetry_db(),
            uid=uid,
            model=MODEL_NAME,
            input_tokens=in_tok,
            output_tokens=out_tok,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        log.warning("model_call telemetry failed: %s", exc)
    return None
