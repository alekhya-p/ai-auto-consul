"""AI vehicle analysis for the ai_analysis_fetch tool.

Two tiers:
  lite (deep=false) - free, LITE_MODEL, shared cache per plate+lang
  deep (deep=true) - DEEP_MODEL, 1 credit via ledger.debit on the
    soonest-expiring pass

Returns JSON shaped for AnalysisCard in the web app.
"""
from __future__ import annotations

import json
import logging

from google import genai
from google.genai import types

from cache.analysis_cache import get_cached_analysis, put_cached_analysis
from config.settings import LITE_MODEL, DEEP_MODEL, AI_ANALYSIS_DEEP_COST
from .rdw import rdw_fetch

log = logging.getLogger("auto-consul.analysis")

_client: genai.Client | None = None


def _genai_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def _firestore():
    from google.cloud import firestore

    return firestore.AsyncClient()


def _lang_label(lang: str) -> str:
    return "Dutch" if lang == "nl" else "English"


def _search_hint(make: str, model: str, year: str) -> str:
    return f"""
When searching Google for market information, use SPECIFIC queries like:
  "{make} {model} {year} occasion prijs Nederland"
  "{make} {model} {year} problemen ervaringen"
  "{make} {model} {year} review"
NOT generic queries like "{make} {model}" which return current model info.
"""


def _lite_prompt(plate: str, rdw: dict, lang: str) -> str:
    label = _lang_label(lang)
    return f"""You are Auto-Consul, a Dutch vehicle-buying expert.

Given the following RDW registry data for plate {plate}:
{rdw}

Return ONLY valid JSON (no markdown) with exactly these keys:
{{
  "summary": "<2-3 sentence overview in {label}>",
  "marketValue": {{
    "estimateRangeEur": "<e.g. €8.000 - €11.500>",
    "explanation": "<brief market context in {label}>"
  }},
  "pros": ["<pro1>", "<pro2>", ...],
  "cons": ["<con1>", "<con2>", ...],
  "thingsToCheckBeforeBuying": ["<check1>", "<check2>", ...],
  "dutchTaxNotes": "<BPM, MRB, bijtelling notes in {label}>",
  "emissionZonesAndBans": "<emission zone / future ban info in {label}>",
  "comparisonWithCurrentModels": "<how it compares to current equivalents in {label}>",
  "competitorBrands": ["<brand1>", "<brand2>", ...]
}}

All text values must be in {label}. Be concrete and cite numbers where possible."""


def _deep_prompt(plate: str, rdw: dict, lang: str, hint: str) -> str:
    label = _lang_label(lang)
    return f"""You are Auto-Consul, a meticulous Dutch vehicle-buying expert producing a
PREMIUM, exhaustive dossier the buyer has paid for. Be thorough, concrete, and
quantitative. Cite € amounts, years, and model codes wherever possible.

Given the following RDW registry data for plate {plate}:
{rdw}

Return ONLY valid JSON (no markdown) with exactly these keys:
{{
  "summary": "<3-4 sentence expert overview in {label}>",
  "marketValue": {{
    "estimateRangeEur": "<e.g. €8.000 - €11.500>",
    "fairPriceEur": "<single best-estimate fair price>",
    "explanation": "<detailed market context, demand, supply in {label}>",
    "depreciationOutlook": "<expected value trend over 1-3 years in {label}>"
  }},
  "pros": ["<pro1>", "<pro2>", ...],
  "cons": ["<con1>", "<con2>", ...],
  "redFlags": ["<serious risks specific to this car/age/mileage in {label}>"],
  "thingsToCheckBeforeBuying": ["<concrete inspection point>", ...],
  "reliabilityNotes": "<known issues for THIS engine/gearbox/generation in {label}>",
  "recallSummary": "<recall / TerugroepActie history and open items in {label}>",
  "runningCostsPerYearEur": {{
    "fuelOrEnergy": "<estimate>",
    "insuranceBand": "<estimate>",
    "maintenance": "<estimate>",
    "roadTaxMrb": "<MRB estimate for an average province>"
  }},
  "dutchTaxNotes": "<BPM rest-value, MRB, bijtelling specifics in {label}>",
  "emissionZonesAndBans": "<milieuzone access today + announced future bans in {label}>",
  "negotiationLeverage": ["<concrete argument to lower the price>", ...],
  "bestAlternatives": [
    {{"model": "<make model generation>", "whyBetter": "<reason in {label}>"}}
  ],
  "comparisonWithCurrentModels": "<how it compares to current equivalents in {label}>",
  "competitorBrands": ["<brand1>", "<brand2>", ...],
  "confidence": "<low|medium|high - your confidence given the available data>"
}}

All text values must be in {label}. Prefer specific numbers over vague ranges.
{hint}"""


def _sources_attribution() -> dict[str, str]:
    return {
        "vehicleData": "RDW Open Data",
        "marketAnalysis": "Gemini AI estimate",
        "taxInfo": "Gemini AI",
    }


async def _generate(model: str, prompt: str) -> dict:
    response = await _genai_client().aio.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    return json.loads(response.text)


async def ai_analysis_fetch(
    plate: str, lang: str = "nl", deep: bool = False, tool_context=None
) -> dict:
    """ADK tool entry point - delegates to run_analysis."""
    uid = getattr(tool_context, "user_id", None) if tool_context else None
    return await run_analysis(plate, lang=lang, deep=deep, uid=uid)


async def run_analysis(
    plate: str, *, lang: str = "nl", deep: bool = False, uid: str | None, peek: bool = False
) -> dict:
    """Run lite or deep analysis. Used by the chat tool and GET /v2/analysis.

    peek=true reads deep cache only (no generate, no charge). Without credits,
    deep returns lite payload with tier needs_upgrade.
    """
    rdw = await rdw_fetch(plate)
    if not rdw.get("found", False):
        return {"error": rdw.get("error", "Vehicle not found"), "plate": plate, "found": False}

    # Cache-only peek: surface a deep analysis this user already paid for
    # (run here or in chat) without generating or charging. A miss returns a
    # no-charge sentinel so callers can fall back to the lite view + the
    # explicit "run full analysis" trigger. Never debits a credit.
    if deep and peek:
        cached = await get_cached_analysis(plate, lang=lang, tier="deep", uid=uid)
        if cached is not None:
            cached["creditsCharged"] = 0
            cached["fromCache"] = True
            cached["deepAvailable"] = True
            return cached
        return {"plate": plate, "found": True, "tier": "none", "deepAvailable": False}

    if not deep:
        return await _run_lite(plate, rdw, lang, uid)

    active_pass = None
    if uid:
        try:
            from billing import ledger

            active_pass = await ledger.find_active_pass(_firestore(), uid)
        except Exception as exc:  # pragma: no cover
            log.warning("entitlement check failed uid=%s: %s", uid, exc)

    if active_pass is None:
        lite = await _run_lite(plate, rdw, lang, uid)
        lite["tier"] = "needs_upgrade"
        lite["upgradeUrl"] = "/prijzen"
        return lite

    return await _run_deep(plate, rdw, lang, uid)


async def _run_lite(plate: str, rdw: dict, lang: str, uid: str | None) -> dict:
    cached = await get_cached_analysis(plate, lang=lang, tier="lite", uid=None)
    if cached is not None:
        if uid:
            try:
                from billing import ledger

                await ledger.log_free(
                    _firestore(), uid=uid, tool_name="ai_analysis_lite", plate=plate
                )
            except Exception as exc:  # pragma: no cover
                log.warning("lite cache log failed uid=%s: %s", uid, exc)
        return cached

    try:
        result = await _generate(LITE_MODEL, _lite_prompt(plate, rdw, lang))
    except Exception as exc:
        log.warning("lite analysis failed plate=%s: %s", plate, exc)
        return {"error": str(exc), "plate": plate, "tier": "lite"}

    result.update(
        plate=plate,
        tier="lite",
        source="ai",
        creditsCharged=0,
        sources=_sources_attribution(),
    )
    await put_cached_analysis(plate, lang=lang, tier="lite", uid=None, payload=result)
    if uid:
        try:
            from billing import ledger

            await ledger.log_free(
                _firestore(), uid=uid, tool_name="ai_analysis_lite", plate=plate
            )
        except Exception as exc:  # pragma: no cover
            log.warning("free log failed uid=%s: %s", uid, exc)
    return result


async def _run_deep(plate: str, rdw: dict, lang: str, uid: str) -> dict:
    cached = await get_cached_analysis(plate, lang=lang, tier="deep", uid=uid)
    if cached is not None:
        cached["creditsCharged"] = 0
        cached["fromCache"] = True
        return cached

    year = (rdw.get("firstRegistration") or "")[:4]
    hint = _search_hint(rdw.get("make", ""), rdw.get("model", ""), year)
    try:
        result = await _generate(DEEP_MODEL, _deep_prompt(plate, rdw, lang, hint))
    except Exception as exc:
        log.warning("deep analysis failed plate=%s uid=%s: %s", plate, uid, exc)
        return {"error": str(exc), "plate": plate, "tier": "deep", "creditsCharged": 0}

    from billing import ledger

    debit_res = await ledger.debit(
        _firestore(),
        uid=uid,
        tool_name="ai_analysis_deep",
        cost=AI_ANALYSIS_DEEP_COST,
        plate=plate,
    )

    result.update(
        plate=plate,
        tier="deep",
        source="ai",
        creditsCharged=AI_ANALYSIS_DEEP_COST if debit_res.charged else 0,
        balanceAfter=debit_res.balance_after,
        sources={
            "vehicleData": "RDW Open Data",
            "marketAnalysis": "Gemini 2.5 Pro estimate",
            "taxInfo": "Gemini AI",
        },
    )
    if debit_res.charged:
        await put_cached_analysis(plate, lang=lang, tier="deep", uid=uid, payload=result)
    return result
