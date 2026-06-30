"""HTTP service for the v2 chat agent.

Exposes the ADK agent over AG-UI (SSE) on /v2/agent, plus history routes and
GET /v2/analysis for the dossier and compare pages. Production Hosting rewrites
/v2/* to this service; thread_id from the client is the ADK session id.
"""
from __future__ import annotations

import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from adk_agui_middleware import SSEService
from adk_agui_middleware.endpoint import register_agui_endpoint, register_agui_history_endpoint
from adk_agui_middleware.data_model.config import PathConfig, HistoryConfig, HistoryPathConfig
from adk_agui_middleware.service.history_service import HistoryService

from fastapi import Depends, Query

from agent import consul_agent
from auth import require_uid, history_user_id
from config import PORT, make_config_context, make_handler_context, make_runner_config
from config import history_session_id, get_session_service
from tools.analysis import run_analysis

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Auto-Consul v2 Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sse_service = SSEService(
    agent=consul_agent,
    config_context=make_config_context(),
    handler_context=make_handler_context(),
    runner_config=make_runner_config(),
)

history_service = HistoryService(
    HistoryConfig(
        app_name="auto-consul",
        # History config extractors take a single ``request`` arg (not the
        # ``(content, request)`` pair the SSE service uses), so use the
        # single-arg variants - the two-arg ones would TypeError here.
        user_id=history_user_id,
        session_id=history_session_id,
        # MUST be the same instance the SSE runner uses, or history can't see
        # the sessions the chat created.
        session_service=get_session_service(),
    )
)

# Mounted under /v2/agent to match Firebase Hosting rewrites.
# The web client posts RunAgentInput here via AG-UI HttpAgent (ConsulCopilotChat).
register_agui_endpoint(
    app=app,
    sse_service=sse_service,
    path_config=PathConfig(agui_main_path="/v2/agent"),
)

register_agui_history_endpoint(
    app,
    history_service,
    path_config=HistoryPathConfig(
        agui_main_path="/v2/agent",
        agui_message_snapshot_path="/v2/agent/message_snapshot/{thread_id}",
        agui_thread_list_path="/v2/agent/thread/list",
        agui_thread_delete_path="/v2/agent/thread/{thread_id}",
    ),
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/v2/agent/info")
async def agent_runtime_info() -> dict:
    """Stub response for CopilotKit's GET /info probe.

    We run a self-hosted HttpAgent, not CopilotKit Cloud. Returning 200 here
    avoids the client falling back to POST probes the ADK middleware rejects.
    No auth - the payload is empty and non-sensitive.
    """
    return {"version": "1.0", "agents": {}, "mode": "sse"}


@app.get("/v2/analysis")
@app.get("/analysis")
async def analysis_endpoint(
    plate: str = Query(..., min_length=4, max_length=12),
    lang: str = Query("nl"),
    deep: bool = Query(False),
    peek: bool = Query(False),
    uid: str = Depends(require_uid),
) -> dict:
    """Run structured vehicle analysis outside the chat thread.

    Same logic as ai_analysis_fetch. Lite (deep=false) is free. Deep costs one
    credit via ledger.debit on the soonest-expiring pass. peek=true returns
    cached deep output without generating or charging.
    """
    normalised_lang = "en" if lang == "en" else "nl"
    return await run_analysis(plate, lang=normalised_lang, deep=deep, uid=uid, peek=peek)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
