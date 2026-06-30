"""RDW Open Data lookup for the rdw_fetch tool.

Calls opendata.rdw.nl (Socrata). Results are stored in Firestore vehicleCache
for 24 hours, using the shared Firestore vehicleCache collection.
"""
from __future__ import annotations

import logging
from datetime import date

import httpx

from cache.vehicle_cache import get_cached_rdw, put_cached_rdw

log = logging.getLogger("auto-consul.rdw")

SOCRATA_URL = "https://opendata.rdw.nl/resource/m9d7-ebf2.json"


def _normalize_plate(plate: str) -> str:
    return plate.upper().replace("-", "").replace(" ", "")


def _ja(val: str | None) -> bool:
    return (val or "").strip().upper() in ("JA", "YES", "TRUE", "1")


def parse_rdw_date(val: str | None) -> str | None:
    """Convert RDW date strings to ISO yyyy-mm-dd."""
    if not val:
        return None
    val = val.strip()
    if "T" in val or (len(val) >= 5 and val[4] == "-"):
        return val[:10]
    if len(val) >= 8 and val[:8].isdigit():
        return f"{val[:4]}-{val[4:6]}-{val[6:8]}"
    return None


def _map_row(raw: dict, normalized: str) -> dict:
    first_reg = parse_rdw_date(
        raw.get("datum_eerste_toelating") or raw.get("datum_eerste_toelating_dt")
    )
    first_nl = parse_rdw_date(
        raw.get("datum_eerste_afgifte_nl") or raw.get("datum_eerste_afgifte_nl_dt")
    )
    apk_until = parse_rdw_date(raw.get("vervaldatum_apk_dt") or raw.get("vervaldatum_apk"))

    apk_valid: bool | None = None
    if apk_until:
        try:
            apk_valid = date.fromisoformat(apk_until) >= date.today()
        except ValueError:
            apk_valid = None

    imported = False
    if first_reg and first_nl:
        try:
            delta = date.fromisoformat(first_nl) - date.fromisoformat(first_reg)
            imported = delta.days > 30
        except ValueError:
            imported = False

    return {
        "found": True,
        "source": "rdw",
        "kenteken": normalized,
        "make": raw.get("merk", ""),
        "model": raw.get("handelsbenaming", "") or raw.get("type", ""),
        "firstRegistration": first_reg,
        "firstNlRegistration": first_nl,
        "apkValidUntil": apk_until,
        "apkValid": apk_valid,
        "imported": imported,
        "energyLabel": raw.get("zuinigheidslabel", ""),
        "exported": _ja(raw.get("exportindicator")),
        "taxi": _ja(raw.get("taxi_indicator")),
        "openRecall": _ja(raw.get("openstaande_terugroepactie_indicator")),
        "liabilityInsured": _ja(raw.get("wam_verzekerd")),
    }


async def _fetch_upstream(normalized: str) -> dict:
    params = {"$where": f"kenteken='{normalized}'", "$limit": "1"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(SOCRATA_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        if not data:
            return {
                "found": False,
                "plate": normalized,
                "error": "Plate not found in RDW registry",
            }
        return _map_row(data[0], normalized)
    except httpx.HTTPStatusError as e:
        return {
            "found": False,
            "plate": normalized,
            "error": f"RDW HTTP error: {e.response.status_code}",
        }
    except Exception as e:
        return {"found": False, "plate": normalized, "error": str(e)}


async def _log_free_rdw(uid: str | None, plate: str) -> None:
    if not uid:
        return
    try:
        from billing import ledger
        from google.cloud import firestore

        await ledger.log_free(
            firestore.AsyncClient(),
            uid=uid,
            tool_name="rdw_fetch",
            plate=plate,
        )
    except Exception as exc:  # pragma: no cover
        log.warning("rdw_fetch free log failed uid=%s: %s", uid, exc)


async def rdw_fetch(plate: str, tool_context=None) -> dict:
    """Look up a Dutch vehicle by plate. Returns structured fields for VehicleDataCard.

    Uses vehicleCache when fresh; otherwise calls RDW and writes cache. Logs a
    free credit_events row when uid is present.
    """
    normalized = _normalize_plate(plate)
    uid = getattr(tool_context, "user_id", None) if tool_context else None

    cached = await get_cached_rdw(normalized)
    if cached is not None:
        await _log_free_rdw(uid, normalized)
        return cached

    result = await _fetch_upstream(normalized)
    if result.get("found"):
        await put_cached_rdw(normalized, result)

    await _log_free_rdw(uid, normalized)
    return result
