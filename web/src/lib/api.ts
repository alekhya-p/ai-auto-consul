import { fetchAppCheckToken, fetchIdToken } from "./auth";
import type {
  MarktaanbodResponse,
  MonthlyCosts,
  ProvinceCode,
  RdwVehicleDetail,
  RdwVehicleSummary,
} from "./types";

export class LookupError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Thrown when the agent returns 429 with a structured daily-limit
 * payload. Identifies which feature was capped + the limit so the UI
 * can show the right upsell.
 */
export class DailyLimitError extends Error {
  constructor(
    message: string,
    public readonly feature: "rdw_lookup" | "ai_analysis",
    public readonly limit: number,
  ) {
    super(message);
  }
}

export class ChatError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Build a fetch request with the Firebase ID-token + App Check token
 * attached when each is configured. Either is independently optional:
 *   - Dev with neither: works via the agent's dev-stub user.
 *   - App Check only (no auth): hero RDW widget for anonymous visitors.
 *   - Both: authenticated user + bot protection.
 */
/**
 * Auth-attaching fetch with a single transparent retry on 401.
 *
 * Common causes of intermittent 401 on /v1/* calls:
 *   - App Check cached token expired mid-flight (the SDK's silent
 *     refresh races with the request).
 *   - Firebase id token expired (1h TTL, refreshed silently - same race).
 *   - Browser came back from sleep and tokens are stale.
 *
 * On the first 401, we force-refresh BOTH tokens and replay the request
 * exactly once. We don't retry beyond that: persistent 401 likely means
 * App Check is mis-configured / throttled, or the user is genuinely
 * signed-out - both want the caller's error handler to fire.
 */
async function authedFetch(input: string, init: RequestInit): Promise<Response> {
  const send = async (force: boolean): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    const [idToken, appCheckToken] = await Promise.all([
      fetchIdToken(force),
      fetchAppCheckToken(force),
    ]);
    if (idToken) headers.set("Authorization", `Bearer ${idToken}`);
    if (appCheckToken) headers.set("X-Firebase-AppCheck", appCheckToken);
    return fetch(input, { ...init, headers });
  };

  const first = await send(false);
  if (first.status !== 401) return first;

  // Don't retry if the caller already cancelled (AbortController).
  const signal = (init as { signal?: AbortSignal }).signal;
  if (signal?.aborted) return first;

  return send(true);
}

export async function lookupRdw(plate: string, signal?: AbortSignal): Promise<RdwVehicleSummary> {
  const res = await authedFetch("/v1/lookup/rdw", {
    method: "POST",
    body: JSON.stringify({ plate }),
    signal,
  });
  if (res.status === 400) {
    throw new LookupError("That doesn't look like a valid Dutch plate.", 400);
  }
  if (!res.ok) {
    throw new LookupError(`Lookup failed (${res.status})`, res.status);
  }
  return (await res.json()) as RdwVehicleSummary;
}

/**
 * Fetch the RDW dossier for a plate. Backs the /voertuig/:plate route.
 * Free tier - App Check is enforced, no Firebase ID-token required.
 *
 * AI analysis is NOT included here - it lives on the auth-required
 * /v1/voertuig/{plate}/analyse endpoint (added in the v2 signed-up
 * flow). Splitting keeps this call fast (~1-2s) so RDW data paints
 * immediately while the AI section loads in parallel.
 */
export async function getVoertuig(plate: string, signal?: AbortSignal): Promise<RdwVehicleDetail> {
  const normalized = plate.replace(/[\s-]/g, "").toUpperCase();
  const res = await authedFetch(`/v1/voertuig/${encodeURIComponent(normalized)}`, {
    method: "GET",
    signal,
  });
  if (res.status === 400) {
    throw new LookupError("That doesn't look like a valid Dutch plate.", 400);
  }
  if (res.status === 429) {
    const body = await res.json().catch(() => ({})) as { feature?: string; limit?: number };
    if (body.feature === "rdw_lookup") {
      throw new DailyLimitError("daily_limit_rdw", "rdw_lookup", body.limit ?? 5);
    }
  }
  if (!res.ok) {
    throw new LookupError(`Lookup failed (${res.status})`, res.status);
  }
  return (await res.json()) as RdwVehicleDetail;
}

/**
 * Fetch current Dutch market listings comparable to the plate. Free
 * tier endpoint, same auth shape as getVoertuig. When the backend's
 * Google CSE keys aren't configured, the response is
 * {listings: [], fetchedAt: null} and the UI hides the section cleanly.
 */
export async function getMarktaanbod(plate: string, signal?: AbortSignal): Promise<MarktaanbodResponse> {
  const normalized = plate.replace(/[\s-]/g, "").toUpperCase();
  const res = await authedFetch(`/v1/voertuig/${encodeURIComponent(normalized)}/marktaanbod`, {
    method: "GET",
    signal,
  });
  if (!res.ok) {
    // Marktaanbod failure is never user-blocking - degrade silently.
    return { listings: [], fetchedAt: null };
  }
  return (await res.json()) as MarktaanbodResponse;
}

/**
 * AI analysis lives in the v2 agent (agent-v2/). The chat surface streams
 * it via /v2/agent; non-chat callers (the compare page) use this thin REST
 * wrapper over /v2/analysis. Both share the same tier-aware core:
 *   - deep=false → free "lite" analysis (0 credits)
 *   - deep=true  → exhaustive "deep" analysis (debits 1 credit on success), or
 *                  tier="needs_upgrade" when the user has no credits.
 */
export interface AiAnalysisV2 {
  tier?: "lite" | "deep" | "needs_upgrade" | "none";
  upgradeUrl?: string;
  creditsCharged?: number;
  balanceAfter?: number;
  found?: boolean;
  error?: string;
  /** Set by the cache-only deep "peek": whether a paid deep analysis exists. */
  deepAvailable?: boolean;
  /** True when a deep result was served from cache (no credit charged). */
  fromCache?: boolean;
  summary?: string;
  marketValue?: {
    estimateRangeEur?: string;
    fairPriceEur?: string;
    explanation?: string;
    depreciationOutlook?: string;
  };
  pros?: string[];
  cons?: string[];
  redFlags?: string[];
  thingsToCheckBeforeBuying?: string[];
  reliabilityNotes?: string;
  recallSummary?: string;
  dutchTaxNotes?: string;
  emissionZonesAndBans?: string;
  negotiationLeverage?: string[];
  bestAlternatives?: { model?: string; whyBetter?: string }[];
  comparisonWithCurrentModels?: string;
  competitorBrands?: string[];
  confidence?: string;
}

export async function getAiAnalysisV2(
  plate: string,
  lang: "nl" | "en",
  deep: boolean,
  signal?: AbortSignal,
  peek = false,
): Promise<AiAnalysisV2> {
  const normalized = plate.replace(/[\s-]/g, "").toUpperCase();
  const res = await authedFetch(
    `/v2/analysis?plate=${encodeURIComponent(normalized)}&lang=${lang}&deep=${deep}${peek ? "&peek=true" : ""}`,
    { method: "GET", signal },
  );
  if (res.status === 401) {
    throw new LookupError("Sign in to see the AI analysis.", 401);
  }
  if (!res.ok) {
    throw new LookupError(`Analysis failed (${res.status})`, res.status);
  }
  return (await res.json()) as AiAnalysisV2;
}

/**
 * Fetch the monthly cost-of-ownership breakdown. Free + anonymous,
 * pure math on the backend (no LLM). Returns the deterministic MRB
 * plus indicative fuel / insurance / maintenance ranges.
 */
export async function getMonthlyCosts(
  plate: string,
  province: ProvinceCode | null,
  signal?: AbortSignal,
): Promise<MonthlyCosts | null> {
  const normalized = plate.replace(/[\s-]/g, "").toUpperCase();
  const q = province ? `?province=${province}` : "";
  const res = await authedFetch(
    `/v1/voertuig/${encodeURIComponent(normalized)}/kosten${q}`,
    { method: "GET", signal },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new LookupError(`Kosten failed (${res.status})`, res.status);
  return (await res.json()) as MonthlyCosts;
}

/** Curated session list (Java `sessions/` projection). Complements agent-v2 thread list. */
export interface ChatSessionSummary {
  sessionId: string;
  title: string;
  language: string;
  lastTurnAt: string;
}

export async function listChatSessions(limit = 20): Promise<ChatSessionSummary[]> {
  const clamped = Math.max(1, Math.min(100, limit));
  const res = await authedFetch(`/v1/sessions?limit=${clamped}`, { method: "GET" });
  if (res.status === 401) return [];
  if (!res.ok) return [];
  const body = (await res.json()) as { sessions?: ChatSessionSummary[] };
  return body.sessions ?? [];
}

// Legacy Java /v1 chat removed; chat uses agent-v2 via CopilotKit (/v2/agent).

export class CheckoutError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Start a Stripe Checkout session. Returns the hosted-checkout URL the
 * caller should redirect to. The agent forwards to Stripe; we never
 * touch the card directly (PCI SAQ-A scope - hosted Checkout only).
 */
export async function createCheckoutSession(req: {
  pack: "SINGLE" | "COMPARE3" | "POWER10";
  returnTo: string;
  bindToPassId?: string;
  lang?: "nl" | "en";
}): Promise<{ sessionId: string; sessionUrl: string }> {
  const res = await authedFetch("/v1/passes/checkout", {
    method: "POST",
    body: JSON.stringify(req),
  });
  if (res.status === 401) throw new CheckoutError("Please sign in to buy a pack.", 401);
  if (res.status === 502) throw new CheckoutError("Payment provider unavailable - try again.", 502);
  if (!res.ok)            throw new CheckoutError(`Checkout failed (${res.status})`, res.status);
  return (await res.json()) as { sessionId: string; sessionUrl: string };
}

/** Open a Stripe Customer Portal session for the current user. */
export async function createPortalSession(returnTo: string): Promise<{ sessionUrl: string }> {
  const res = await authedFetch("/v1/passes/portal-session", {
    method: "POST",
    body: JSON.stringify({ returnTo }),
  });
  if (res.status === 401) throw new CheckoutError("Please sign in.", 401);
  if (res.status === 404) throw new CheckoutError("No billing history yet - make a purchase first.", 404);
  if (res.status === 502) throw new CheckoutError("Billing portal unavailable - try again.", 502);
  if (!res.ok)            throw new CheckoutError(`Portal failed (${res.status})`, res.status);
  return (await res.json()) as { sessionUrl: string };
}

/** Fetch the current user's active passes. */
export async function listPasses(): Promise<PassView[]> {
  const res = await authedFetch("/v1/passes", { method: "GET" });
  if (res.status === 401) throw new CheckoutError("Please sign in.", 401);
  if (!res.ok)            throw new CheckoutError(`List failed (${res.status})`, res.status);
  const body = (await res.json()) as { passes: PassView[] };
  return body.passes ?? [];
}

export interface PassView {
  passId: string;
  pack: "SINGLE" | "COMPARE3" | "POWER10";
  creditsInitial: number;
  creditsRemaining: number;
  chatTurnsInitial: number;
  chatTurnsRemaining: number;
  purchasedAt: string;
  expiresAt: string;
  status: string;
}

// ─── Admin usage analytics (admin-claim gated; GET /v1/admin/usage) ──
//
// NOTE: these types are a hand-port of the Java `UsageReport` DTOs. They are
// NOT yet in api-types.gen.ts because openapi.json hasn't been regenerated for
// Regenerate types when the private Java agent OpenAPI spec changes.
// `npm run gen:types` to replace these with the generated types.

export interface UsageReport {
  totals: UsageTotals;
  perTool: UsageToolStat[];
  daily: UsageDailyStat[];
  cacheStats: UsageCacheStat[];
  aiStats: UsageAiStat[];
  truncated: boolean;
}
export interface UsageTotals {
  events: number;
  credits: number;
  turns: number;
  uniqueUsers: number;
  avgCreditsPerTurn: number;
  avgToolsPerTurn: number;
}
export interface UsageToolStat {
  toolName: string;
  calls: number;
  totalCost: number;
  avgCost: number;
}
export interface UsageDailyStat {
  date: string;
  calls: number;
  credits: number;
  turns: number;
}
export interface UsageCacheStat {
  source: string;
  hits: number;
  misses: number;
  hitRate: number;
}
export interface UsageAiStat {
  model: string;
  calls: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgLatencyMs: number;
}

/** Admin-only overall usage analytics over the last `days` days. */
export async function getAdminUsage(days: number, signal?: AbortSignal): Promise<UsageReport> {
  const res = await authedFetch(`/v1/admin/usage?days=${days}`, { method: "GET", signal });
  if (!res.ok) throw new Error(`Admin usage failed (${res.status})`);
  return (await res.json()) as UsageReport;
}

// ─── Saved dossiers (server-side recent-list for signed-in users) ──

export interface SavedDossierView {
  plate: string;
  merk: string | null;
  model: string | null;
  year: string | null;
  savedAt: string | null;
  lastViewedAt: string | null;
}

/**
 * Record a dossier view in the user's server-side "recent" list. Called
 * in the background whenever a signed-in user lands on /voertuig/:plate
 * and the RDW lookup returned a real car. Safe to fire-and-forget.
 */
export async function saveDossier(payload: {
  plate: string;
  merk?: string | null;
  model?: string | null;
  year?: string | null;
}): Promise<void> {
  try {
    await authedFetch("/v1/dossiers", {
      method: "POST",
      body: JSON.stringify({
        plate: payload.plate,
        merk: payload.merk || undefined,
        model: payload.model || undefined,
        year: payload.year || undefined,
      }),
    });
  } catch {
    // Background save is best-effort; never surface failures to the UI.
  }
}

/** Read the signed-in user's saved-dossier list. */
export async function listSavedDossiers(): Promise<SavedDossierView[]> {
  const res = await authedFetch("/v1/dossiers", { method: "GET" });
  if (!res.ok) throw new Error(`list_dossiers_failed_${res.status}`);
  const body = (await res.json()) as { dossiers: SavedDossierView[] };
  return body.dossiers ?? [];
}

/** Remove a dossier from the signed-in user's saved list. */
export async function deleteSavedDossier(plate: string): Promise<void> {
  await authedFetch(`/v1/dossiers/${encodeURIComponent(plate)}`, { method: "DELETE" });
}

// ─── Account deletion ────────────────────────────────────────────

export class DeleteAccountError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

/**
 * Permanently delete the current user (GDPR). Triggers server-side
 * UserPurgeService cleanup + Firebase Auth record deletion. After
 * success the caller must sign out + clear any local state.
 */
export async function deleteAccount(): Promise<void> {
  const res = await authedFetch("/v1/users/me", { method: "DELETE" });
  if (res.status === 401) throw new DeleteAccountError("Please sign in.", 401);
  if (res.status === 503) throw new DeleteAccountError("Account deletion isn't available right now.", 503);
  if (!res.ok)            throw new DeleteAccountError(`Delete failed (${res.status})`, res.status);
}

// ─── Credit history ─────────────────────────────────────────────

export interface CreditEventView {
  eventId: string;
  passId: string | null;
  toolName: string;
  cost: number;
  balanceAfter: number;
  plateContext: string | null;
  timestamp: string;
}

/** Read the most recent credit-usage events for the current user. */
export async function listCreditHistory(): Promise<CreditEventView[]> {
  const res = await authedFetch("/v1/credits/history", { method: "GET" });
  if (!res.ok) throw new Error(`credit_history_failed_${res.status}`);
  const body = (await res.json()) as { events: CreditEventView[] };
  return body.events ?? [];
}
