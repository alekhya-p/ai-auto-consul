"""Firebase ID token verification for AG-UI and REST routes.

Chat and paid tools require a signed-in user. The client sends the Firebase ID
token as Authorization Bearer on every /v2/agent run and REST call.
"""
from __future__ import annotations

import firebase_admin
from firebase_admin import auth as fb_auth, credentials
from ag_ui.core import RunAgentInput
from fastapi import HTTPException, Request

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


def _verify_bearer(request: Request) -> str:
    """Validate Bearer token and return uid. Raises 401 on failure."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = header.removeprefix("Bearer ").strip()
    try:
        decoded = fb_auth.verify_id_token(token)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except fb_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid ID token")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Auth error: {exc}")
    return decoded["uid"]


async def extract_user_id(content: RunAgentInput, request: Request) -> str:
    """User id extractor for the AG-UI SSE service (async required by middleware)."""
    return _verify_bearer(request)


def require_uid(request: Request) -> str:
    """FastAPI dependency for /v2/analysis and other REST endpoints."""
    return _verify_bearer(request)


async def history_user_id(request: Request) -> str:
    """User id extractor for history routes (single request arg)."""
    return _verify_bearer(request)
