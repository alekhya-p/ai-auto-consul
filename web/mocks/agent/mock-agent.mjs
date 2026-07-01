/**
 * Mock AG-UI agent for `npm run dev:mock`.
 * Streams scripted SSE to /v2/agent - same path CopilotKit uses in production.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEMO_THREAD_ID = "marketing-demo";
const DEMO_ONBOARDING_THREAD_ID = "marketing-onboarding";

const DEMO_THREADS = {
  [DEMO_THREAD_ID]: "demo-thread.json",
  [DEMO_ONBOARDING_THREAD_ID]: "demo-onboarding-thread.json",
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function normalizePlate(plate) {
  return String(plate ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

function formatPlate(raw) {
  const s = normalizePlate(raw);
  if (s.length === 6) return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4)}`;
  if (s.length === 7) return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`;
  return s;
}

function formatDate(iso, lang) {
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function detailToRdw(detail, plate) {
  const algemeen = detail.algemeen ?? {};
  const status = detail.status ?? {};
  const motor = detail.motorMilieu ?? {};
  return {
    found: detail.found !== false,
    source: "rdw",
    kenteken: detail.kenteken ?? normalizePlate(plate),
    make: algemeen.merk ?? "",
    model: algemeen.model ?? "",
    firstRegistration: algemeen.datumEersteToelating ?? null,
    firstNlRegistration: algemeen.datumEersteNlRegistratie ?? null,
    apkValidUntil: status.apkGeldigTot ?? null,
    apkValid: status.apkGeldig ?? true,
    imported: algemeen.importauto ?? false,
    energyLabel: motor.zuinigheidslabel ?? "",
    exported: status.exported ?? false,
    taxi: status.taxi ?? false,
    openRecall: status.openstaandeTerugroepactie ?? false,
    liabilityInsured: status.wamVerzekerd ?? true,
  };
}

function loadRdwFixture(mocksRoot, plate) {
  const key = normalizePlate(plate);
  const specific = resolve(mocksRoot, "voertuig", `${key}.json`);
  const detail = existsSync(specific)
    ? readJson(specific)
    : readJson(resolve(mocksRoot, "voertuig", "A898CD.json"));
  if (!detail) {
    return {
      found: true,
      source: "rdw",
      kenteken: key,
      make: "BMW",
      model: "3-SERIE",
      apkValid: true,
      apkValidUntil: "2026-09-15",
      openRecall: false,
      liabilityInsured: true,
      imported: false,
      energyLabel: "C",
    };
  }
  return detailToRdw(detail, key);
}

function extractPlate(context, userText, messages) {
  for (const c of context ?? []) {
    const v = c?.value ?? "";
    if (/^[A-Z0-9-]{4,10}$/i.test(v.replace(/\s/g, "")) && c.description?.toLowerCase().includes("plate")) {
      return normalizePlate(v);
    }
  }
  const plateInText = String(userText ?? "").match(/\b([A-Z0-9]{2}-?[A-Z0-9]{2,3}-?[A-Z0-9]{1,2})\b/i);
  if (plateInText) return normalizePlate(plateInText[1]);
  for (const m of [...(messages ?? [])].reverse()) {
    if (m.role !== "user") continue;
    const hit = String(m.content ?? "").match(/\b([A-Z0-9]{2}-?[A-Z0-9]{2,3}-?[A-Z0-9]{1,2})\b/i);
    if (hit) return normalizePlate(hit[1]);
  }
  return "A898CD";
}

function extractLang(context) {
  const langCtx = (context ?? []).find((c) => /language/i.test(c.description ?? ""));
  return langCtx?.value === "en" ? "en" : "nl";
}

/** Realistic buyer questions → lead + tail copy with tool card in between. */
function pickScenario(userText, plate, lang, rdw) {
  const pretty = formatPlate(plate);
  const t = String(userText).toLowerCase();

  if (/^(hi|hello|hey|hoi|hallo)\b/.test(t.trim())) {
    return {
      textOnly: true,
      lead:
        "Hello! I'm Auto-Consul, your expert in Dutch vehicle buying. How can I help you today?",
      followups:
        lang === "en"
          ? ["What can you tell me about a plate?", "How does import work?", "Compare two cars for me"]
          : [
              "Wat is de waarde van mijn auto?",
              "Hoe werkt importeren?",
              "Wat zijn de voordelen van elektrisch rijden?",
            ],
    };
  }

  if (/what you can do|what can you do|capabilities|help me with|wat kun je/.test(t)) {
    return {
      textOnly: true,
      lead:
        "I can help you with all sorts of information about Dutch vehicles! I can look up official RDW registry data like make, model, APK (MOT), recalls, and import/export status. I can also provide an AI-powered analysis that includes market value, depreciation, tax implications (BPM, MRB, bijtelling), emission zone compatibility, pros and cons, and things to check.\n\nIf you're interested in real-time prices, common problems, or recent news about a specific car, I can search the web for that too. Just give me a license plate or ask a question!",
      followups: [
        "Can you explain RDW data?",
        "What kind of AI analysis do you provide?",
        "How do I ask you about a specific car?",
      ],
    };
  }

  if (/apk|keuring|mot\b|inspection/.test(t)) {
    return {
      lead:
        lang === "en"
          ? `I'll pull the current RDW inspection status for ${pretty}.`
          : `Ik haal de actuele APK-status op voor ${pretty}.`,
      tail:
        lang === "en"
          ? rdw.apkValid
            ? `The MOT is valid until ${formatDate(rdw.apkValidUntil, lang)}. Ask the seller for invoices from the last service - minor advisories often show up on the most recent inspection.`
            : `Heads up: RDW shows no valid MOT. Budget for an inspection before you buy, or negotiate the price down.`
          : rdw.apkValid
            ? `De APK is geldig tot ${formatDate(rdw.apkValidUntil, lang)}. Vraag de verkoper om facturen van het laatste onderhoud - lichte adviseringen komen vaak voor op de meest recente keuring.`
            : `Let op: volgens RDW is er geen geldige APK. Reken op keuringskosten vóór aankoop, of onderhandel flink op de prijs.`,
    };
  }

  if (/recall|terugroep|wok/.test(t)) {
    return {
      lead:
        lang === "en"
          ? `Checking recalls and WOK flags at RDW for ${pretty}.`
          : `Ik check recalls en WOK-status bij RDW voor ${pretty}.`,
      tail:
        lang === "en"
          ? rdw.openRecall
            ? `There is an open recall on record. Have a main dealer confirm it was completed before you pay.`
            : `No open recalls and no WOK flag - reassuring. Still worth reading the full APK history for advisories.`
          : rdw.openRecall
            ? `Er staat een open terugroepactie geregistreerd. Laat bij een merkdealer bevestigen dat die is uitgevoerd vóór je betaalt.`
            : `Geen open recalls en geen WOK-melding - geruststellend. Bekijk wel de volledige APK-historie op adviseringen.`,
    };
  }

  if (/verzek|wam|insur/.test(t)) {
    return {
      lead:
        lang === "en"
          ? `Looking up liability insurance (WAM) status for ${pretty}.`
          : `Ik controleer de WAM-verzekeringsstatus voor ${pretty}.`,
      tail:
        lang === "en"
          ? rdw.liabilityInsured
            ? `WAM liability insurance is active - you can register the car. Always verify the seller can hand over the registration parts.`
            : `RDW shows no active WAM insurance. Do not drive or transfer until that's resolved.`
          : rdw.liabilityInsured
            ? `WAM-verzekering staat actief - je kunt het voertuig overschrijven. Controleer wel of de verkoper alle registratiepapieren heeft.`
            : `RDW toont geen actieve WAM-verzekering. Niet rijden of overschrijven tot dat geregeld is.`,
    };
  }

  if (/prijs|markt|fair|waarde|kost|tax|mrb|wegenbelasting/.test(t)) {
    return {
      lead:
        lang === "en"
          ? `Here's the RDW baseline for ${pretty} - useful before we talk market price or running costs.`
          : `Dit is het RDW-basisdossier voor ${pretty} - handig vóór we het over marktprijs of kosten hebben.`,
      tail:
        lang === "en"
          ? `${rdw.make} ${rdw.model}: energy label ${rdw.energyLabel || "unknown"}. Ask me for a market band or monthly tax estimate if you share the asking price.`
          : `${rdw.make} ${rdw.model}: energielabel ${rdw.energyLabel || "onbekend"}. Deel de vraagprijs als je een marktband of wegenbelasting-inschatting wilt.`,
    };
  }

  if (/samenvat|summary|dossier|overzicht|vertel/.test(t)) {
    return {
      lead:
        lang === "en"
          ? `Summarising the RDW dossier for ${pretty}:`
          : `Samenvatting van het RDW-dossier voor ${pretty}:`,
      tail:
        lang === "en"
          ? `${rdw.make} ${rdw.model}. MOT ${rdw.apkValid ? "valid" : "expired"}, ${rdw.openRecall ? "open recall" : "no recalls"}, WAM ${rdw.liabilityInsured ? "insured" : "not insured"}. What should we dig into next?`
          : `${rdw.make} ${rdw.model}. APK ${rdw.apkValid ? "geldig" : "verlopen"}, ${rdw.openRecall ? "open recall" : "geen recalls"}, WAM ${rdw.liabilityInsured ? "verzekerd" : "onverzekerd"}. Waar wil je verder op in?`,
    };
  }

  return {
    lead:
      lang === "en"
        ? `I'll fetch the official RDW record for ${pretty}.`
        : `Ik haal het officiële RDW-dossier op voor ${pretty}.`,
    tail:
      lang === "en"
        ? `${rdw.make} ${rdw.model} - MOT until ${formatDate(rdw.apkValidUntil, lang)}, label ${rdw.energyLabel || "?"}. Ask about APK history, recalls, or whether the asking price is fair.`
        : `${rdw.make} ${rdw.model} - APK t/m ${formatDate(rdw.apkValidUntil, lang)}, label ${rdw.energyLabel || "?"}. Vraag gerust door over APK-historie, recalls of of de vraagprijs klopt.`,
  };
}

function sseEvent(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function streamText(res, messageId, text, chunkMs = 28) {
  sseEvent(res, { type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
  const words = text.split(/(\s+)/);
  let buf = "";
  for (const w of words) {
    buf += w;
    if (buf.length >= 12 || w.endsWith(".") || w.endsWith("?")) {
      sseEvent(res, { type: "TEXT_MESSAGE_CONTENT", messageId, delta: buf });
      buf = "";
      await sleep(chunkMs);
    }
  }
  if (buf) sseEvent(res, { type: "TEXT_MESSAGE_CONTENT", messageId, delta: buf });
  sseEvent(res, { type: "TEXT_MESSAGE_END", messageId });
}

async function streamFollowups(res, parentMessageId, questions) {
  const toolCallId = randomUUID();
  const toolArgs = JSON.stringify({ questions });
  sseEvent(res, {
    type: "TOOL_CALL_START",
    toolCallId,
    toolCallName: "suggest_followups",
    parentMessageId,
  });
  sseEvent(res, { type: "TOOL_CALL_ARGS", toolCallId, delta: toolArgs });
  sseEvent(res, { type: "TOOL_CALL_END", toolCallId });
  sseEvent(res, {
    type: "TOOL_CALL_RESULT",
    messageId: randomUUID(),
    toolCallId,
    content: toolArgs,
    role: "tool",
  });
}

async function streamMockRun(res, input, mocksRoot) {
  const { threadId, runId, messages, context } = input;
  const lastUser = [...(messages ?? [])].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  const plate = extractPlate(context, userText, messages);
  const lang = extractLang(context);
  const rdw = loadRdwFixture(mocksRoot, plate);
  const script = pickScenario(userText, plate, lang, rdw);

  const typingMs = Number(process.env.VITE_MOCK_AGENT_TYPING_MS ?? 500);
  const toolMs = Number(process.env.VITE_MOCK_AGENT_TOOL_MS ?? 900);

  sseEvent(res, { type: "RUN_STARTED", threadId, runId });
  await sleep(typingMs);

  if (script.textOnly) {
    const leadId = randomUUID();
    await streamText(res, leadId, script.lead);
    if (script.followups?.length) {
      await sleep(120);
      await streamFollowups(res, leadId, script.followups);
    }
    sseEvent(res, { type: "RUN_FINISHED", threadId, runId });
    res.end();
    return;
  }

  const leadId = randomUUID();
  await streamText(res, leadId, script.lead);

  const toolCallId = randomUUID();
  const toolArgs = JSON.stringify({ plate: normalizePlate(plate) });
  sseEvent(res, {
    type: "TOOL_CALL_START",
    toolCallId,
    toolCallName: "rdw_fetch",
    parentMessageId: leadId,
  });
  sseEvent(res, { type: "TOOL_CALL_ARGS", toolCallId, delta: toolArgs });
  sseEvent(res, { type: "TOOL_CALL_END", toolCallId });
  await sleep(toolMs);

  sseEvent(res, {
    type: "TOOL_CALL_RESULT",
    messageId: randomUUID(),
    toolCallId,
    content: JSON.stringify(rdw),
    role: "tool",
  });

  const tailId = randomUUID();
  await streamText(res, tailId, script.tail);

  sseEvent(res, { type: "RUN_FINISHED", threadId, runId });
  res.end();
}

function jsonReply(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function mapAnalyseFixture(raw, { deep, peek }) {
  if (!raw) {
    return { found: true, tier: deep ? "deep" : "lite", summary: "Mock analysis." };
  }
  const summary = raw.summary ?? raw.samenvatting ?? "";
  const mv = raw.marketValue ?? raw.marktwaarde;
  const mapped = {
    found: true,
    tier: deep ? "deep" : "lite",
    summary,
    marketValue: mv
      ? {
          estimateRangeEur: mv.estimateRangeEur ?? mv.schattingEur,
          fairPriceEur: mv.fairPriceEur,
          explanation: mv.explanation ?? mv.toelichting,
          depreciationOutlook: mv.depreciationOutlook,
        }
      : undefined,
    redFlags: raw.redFlags ?? raw.aandachtspuntenBijAankoop,
    pros: raw.pros ?? raw.voordelen,
    cons: raw.cons ?? raw.nadelen,
    thingsToCheckBeforeBuying: raw.thingsToCheckBeforeBuying ?? raw.aandachtspuntenBijAankoop,
    reliabilityNotes: raw.reliabilityNotes,
    recallSummary: raw.recallSummary,
    dutchTaxNotes: raw.dutchTaxNotes ?? raw.nederlandseBelastingvoordelen,
    emissionZonesAndBans: raw.emissionZonesAndBans ?? raw.milieuzonesEnBans,
    negotiationLeverage: raw.negotiationLeverage,
    bestAlternatives: raw.bestAlternatives,
    comparisonWithCurrentModels: raw.comparisonWithCurrentModels ?? raw.vergelijkingHuidigeModellen,
    competitorBrands: raw.competitorBrands ?? raw.concurrentenOemBrands,
    confidence: raw.confidence,
    creditsCharged: 0,
  };
  if (deep && peek) {
    return {
      ...mapped,
      tier: "deep",
      deepAvailable: Boolean(summary),
      fromCache: true,
      creditsCharged: 0,
    };
  }
  if (deep) {
    return { ...mapped, tier: "deep", creditsCharged: 1, balanceAfter: 9 };
  }
  return mapped;
}

function loadAnalyseFixture(mocksRoot, plate, deep) {
  const key = normalizePlate(plate);
  if (deep) {
    const deepFile = resolve(mocksRoot, "analyse", `${key}-deep.json`);
    if (existsSync(deepFile)) return readJson(deepFile);
  }
  const specific = resolve(mocksRoot, "analyse", `${key}.json`);
  const fallback = resolve(mocksRoot, "analyse", "_default.json");
  return existsSync(specific) ? readJson(specific) : readJson(fallback);
}

/**
 * Handle /v2/agent* in mock mode. Returns true when the request was handled.
 */
export async function handleMockAgentRoutes(req, res, url, mocksRoot) {
  const path = url.split("?")[0];

  if (path === "/v2/agent/info" && req.method === "GET") {
    jsonReply(res, { version: "1.0", agents: {}, mode: "sse-mock" });
    return true;
  }

  if (path === "/v2/agent/thread/list" && req.method === "GET") {
    jsonReply(res, Object.keys(DEMO_THREADS).map((threadId) => ({ threadId })));
    return true;
  }

  const snapMatch = path.match(/^\/v2\/agent\/message_snapshot\/([^/]+)$/);
  if (snapMatch && req.method === "GET") {
    const threadId = decodeURIComponent(snapMatch[1]);
    const file = DEMO_THREADS[threadId];
    if (file) {
      const snap = readJson(resolve(mocksRoot, "agent", file));
      jsonReply(res, snap ?? { messages: [] });
      return true;
    }
    jsonReply(res, { messages: [] });
    return true;
  }

  const delMatch = path.match(/^\/v2\/agent\/thread\/([^/]+)$/);
  if (delMatch && req.method === "DELETE") {
    jsonReply(res, { ok: true });
    return true;
  }

  if (path === "/v2/agent" && req.method === "POST") {
    let input;
    try {
      input = JSON.parse(await readBody(req));
    } catch {
      jsonReply(res, { error: "invalid_json" }, 400);
      return true;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      await streamMockRun(res, input, mocksRoot);
    } catch (err) {
      console.error("[mock-agent]", err);
      if (!res.writableEnded) res.end();
    }
    return true;
  }

  if (path === "/v2/analysis" && req.method === "GET") {
    const plateMatch = url.match(/[?&]plate=([A-Z0-9]+)/i);
    const plate = plateMatch ? plateMatch[1].toUpperCase() : "A898CD";
    const deep = /[?&]deep=true/.test(url);
    const peek = /[?&]peek=true/.test(url);
    const raw = loadAnalyseFixture(mocksRoot, plate, deep);
    const body = mapAnalyseFixture(raw, { deep, peek });
    const latencyMs = Number(process.env.VITE_MOCK_AI_LATENCY_MS ?? 400);
    await sleep(deep && !peek ? latencyMs : 120);
    jsonReply(res, body);
    return true;
  }

  return false;
}

export { DEMO_THREAD_ID, DEMO_ONBOARDING_THREAD_ID };
