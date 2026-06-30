"""ADK tools registered on consul_agent."""

from .rdw import rdw_fetch
from .analysis import ai_analysis_fetch
from .compare import suggest_compare
from .followup import suggest_followups
from .web_search import web_search

__all__ = [
    "rdw_fetch",
    "ai_analysis_fetch",
    "suggest_compare",
    "suggest_followups",
    "web_search",
]
