"""Compare suggestion card linking to /compare in the web app."""

from __future__ import annotations


def suggest_compare(plates: list[str], reason: str = "") -> dict:
    """Return a compare card payload for two or three plates.

    Normalises plates and builds compareUrl for CompareCard.
    """
    normalized = [p.upper().replace("-", "").replace(" ", "") for p in plates[:3]]
    return {
        "type": "compare_card",
        "plates": normalized,
        "reason": reason,
        "compareUrl": f"/compare?plates={','.join(normalized)}",
    }
