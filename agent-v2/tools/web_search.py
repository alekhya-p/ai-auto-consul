"""Live web search for the web_search tool.

Uses an isolated Gemini call with google_search grounding (not the ADK built-in
search tool) because Vertex does not allow mixing built-in search with function
tools on the same agent.

Returns {answer, sources, source:"web"} for SourcesCard.
"""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from config.settings import LITE_MODEL

log = logging.getLogger("auto-consul.web_search")

_client: genai.Client | None = None


def _genai_client() -> genai.Client:
    """Lazy genai client (ADC via the agent runtime SA; no API key).

    Separate accessor so unit tests can monkeypatch ``web_search._client``.
    """
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def _extract_sources(response) -> list[dict[str, str]]:
    """Pull {title, uri} citations out of Gemini grounding metadata.

    Dedupes by uri and tolerates the metadata being absent (no grounding hit).
    """
    sources: list[dict[str, str]] = []
    seen: set[str] = set()
    try:
        candidates = getattr(response, "candidates", None) or []
        for cand in candidates:
            meta = getattr(cand, "grounding_metadata", None)
            chunks = getattr(meta, "grounding_chunks", None) or []
            for chunk in chunks:
                web = getattr(chunk, "web", None)
                if not web:
                    continue
                uri = getattr(web, "uri", "") or ""
                title = getattr(web, "title", "") or uri
                if uri and uri not in seen:
                    seen.add(uri)
                    sources.append({"title": title, "uri": uri})
    except Exception as exc:  # pragma: no cover - defensive: never fail the turn on metadata
        log.warning("grounding metadata parse failed: %s", exc)
    return sources


async def _log_free_search(uid: str | None, query: str) -> None:
    if not uid:
        return
    try:
        from billing import ledger
        from google.cloud import firestore

        await ledger.log_free(
            firestore.AsyncClient(),
            uid=uid,
            tool_name="web_search",
            plate=query[:32],
        )
    except Exception as exc:  # pragma: no cover
        log.warning("web_search free log failed uid=%s: %s", uid, exc)


async def web_search(query: str, lang: str = "nl", tool_context=None) -> dict:
    """Search the web and return a cited summary for the given query.

    Include make, model, and year in the query for useful market results.
    lang controls the answer language (nl or en).
    """
    uid = getattr(tool_context, "user_id", None) if tool_context else None
    label = "Dutch" if lang != "en" else "English"
    prompt = (
        f"Search the web and answer concisely in {label}. "
        f"Cite concrete numbers, dates and model details where possible.\n\n"
        f"Query: {query}"
    )
    try:
        response = await _genai_client().aio.models.generate_content(
            model=LITE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
    except Exception as exc:
        log.warning("web_search failed query=%r: %s", query, exc)
        return {"query": query, "answer": "", "sources": [], "source": "web", "error": str(exc)}

    result = {
        "query": query,
        "answer": (response.text or "").strip(),
        "sources": _extract_sources(response),
        "source": "web",
    }
    await _log_free_search(uid, query)
    return result
