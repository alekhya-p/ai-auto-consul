"""Unit tests for curated sessions projection helpers."""

from sessions.session_projection import (
    DEFAULT_TITLE,
    language_from_state,
    user_snippet_from_event,
)


class _FakePart:
    def __init__(self, text: str):
        self.text = text


class _FakeContent:
    def __init__(self, parts):
        self.parts = parts


class _FakeEvent:
    def __init__(self, author: str, text: str):
        self._author = author
        self._text = text

    def model_dump(self, mode="json"):
        return {
            "author": self._author,
            "content": {"parts": [{"text": self._text}]},
        }


def test_user_snippet_from_event():
    ev = _FakeEvent("user", "  What is the APK status?  ")
    assert user_snippet_from_event(ev) == "What is the APK status?"


def test_user_snippet_ignores_assistant():
    ev = _FakeEvent("model", "Long answer")
    assert user_snippet_from_event(ev) is None


def test_language_from_state():
    assert language_from_state({"lang": "en"}) == "en"
    assert language_from_state({"language": "nl-NL"}) == "nl"
    assert language_from_state(None) == "nl"


def test_default_title_constant():
    assert len(DEFAULT_TITLE) > 0
