"""Tests for the web_search tool - mock the genai client (no network)."""
from __future__ import annotations

import pytest

import importlib

# tools/__init__ re-exports the web_search *function*, shadowing the submodule
# attribute, so grab the real module from sys.modules to monkeypatch its client.
ws = importlib.import_module("tools.web_search")

pytestmark = pytest.mark.asyncio


class _Web:
    def __init__(self, uri, title):
        self.uri = uri
        self.title = title


class _Chunk:
    def __init__(self, uri, title):
        self.web = _Web(uri, title)


class _Meta:
    def __init__(self, chunks):
        self.grounding_chunks = chunks


class _Candidate:
    def __init__(self, chunks):
        self.grounding_metadata = _Meta(chunks)


class _Response:
    def __init__(self, text, chunks=None):
        self.text = text
        self.candidates = [_Candidate(chunks or [])]


class _FakeModels:
    def __init__(self, response):
        self._response = response

    async def generate_content(self, *, model, contents, config=None):
        self._tools = getattr(config, "tools", None)
        return self._response


class _FakeClient:
    def __init__(self, response):
        self.aio = type("aio", (), {"models": _FakeModels(response)})()


def _patch(monkeypatch, response):
    monkeypatch.setattr(ws, "_genai_client", lambda: _FakeClient(response))


async def test_returns_answer_and_dedup_sources(monkeypatch):
    chunks = [
        _Chunk("https://a.nl", "A"),
        _Chunk("https://b.nl", "B"),
        _Chunk("https://a.nl", "A-dup"),  # same uri → deduped
    ]
    _patch(monkeypatch, _Response("Marktprijs is €10.000", chunks))
    res = await ws.web_search("VW Golf 2019 prijs", lang="nl")
    assert res["source"] == "web"
    assert res["answer"] == "Marktprijs is €10.000"
    assert res["sources"] == [
        {"title": "A", "uri": "https://a.nl"},
        {"title": "B", "uri": "https://b.nl"},
    ]


async def test_no_grounding_is_empty_sources(monkeypatch):
    _patch(monkeypatch, _Response("geen bronnen", chunks=[]))
    res = await ws.web_search("iets", lang="nl")
    assert res["sources"] == []
    assert res["answer"] == "geen bronnen"


async def test_failure_is_caught(monkeypatch):
    class _Boom:
        def __init__(self):
            self.aio = type("aio", (), {"models": self})()

        async def generate_content(self, *, model, contents, config=None):
            raise RuntimeError("vertex down")

    monkeypatch.setattr(ws, "_genai_client", lambda: _Boom())
    res = await ws.web_search("x")
    assert res["source"] == "web"
    assert res["sources"] == []
    assert "error" in res
