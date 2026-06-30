"""Follow-up question chips rendered by FollowUpSuggestions in the web app."""

from __future__ import annotations


def suggest_followups(questions: list[str]) -> dict:
    """Return up to four follow-up questions for the chat UI chips.

    The agent calls this at the end of a turn. Questions should match the
    conversation language.
    """
    return {
        "type": "followup_suggestions",
        "questions": questions[:4],
    }
