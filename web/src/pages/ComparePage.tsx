import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { NlPlate } from "../components/NlPlate";
import { WelcomeOnboardingSheet } from "../components/WelcomeOnboardingSheet";
import { CompareMobileTabs } from "../features/compare/CompareMobileTabs";
import { ComparePaywallSheet } from "../features/compare/ComparePaywallSheet";
import { ComparePreviewBanner } from "../features/compare/ComparePreviewBanner";
import { useAuth } from "../lib/auth";
import type { Tier } from "../lib/auth";
import { getAiAnalysisV2, getMonthlyCosts, getVoertuig, LookupError } from "../lib/api";
import type { AiAnalysisV2 } from "../lib/api";
import { brandFor } from "../lib/brandTheme";
import type { BrandTheme } from "../lib/brandTheme";
import { track } from "../lib/analytics";
import { useI18n, useT } from "../lib/i18n";
import { normalise } from "../lib/voertuigCache";
import type { MonthlyCosts, MonthlyCostsRange, RdwVehicleDetail } from "../lib/types";

/**
 * /compare?plates=A,B,C - side-by-side comparison of up to 3 vehicles.
 *
 * Cap is 3 (not 4+) because:
 *   - Pricing tier "pro" already covers 3; supporting 4 would force
 *     us to reason about multi-pack tier transitions in the cell-level
 *     gating logic.
 *   - The mobile horizontal scroll past 3 columns gets unusable.
 *
 * Layout: one row per RDW/AI/cost metric. Rows where ALL cars share
 * the same value are auto-collapsed into a "12 fields match" tile to
 * reduce visual noise; the user can expand it on demand.
 *
 * Tier matrix:
 *   free → blocked, paywall card
 *   pass → up to 1 plate with AI; others render RDW only
 *   pro  → up to 3 plates with AI
 *   power → up to 3 plates with AI (same cap as pro for this page)
 */
const MAX_PLATES = 3;

export function ComparePage() {
  const t = useT();
  const { lang } = useI18n();
  const auth = useAuth();
  const [params] = useSearchParams();

  const requested = useMemo(() => parsePlates(params.get("plates")), [params]);

  // Engagement: a comparison was opened (fires per distinct plate set).
  const requestedKey = requested.join(",");
  useEffect(() => {
    if (requested.length >= 2) track("compare_started", { n_plates: requested.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedKey]);

  const isGuest = auth.ready && !auth.user;
  const isFreeSignedIn = auth.ready && Boolean(auth.user) && auth.tier === "free";
  const rdwPreview = isGuest || isFreeSignedIn;

  const displayPlates = useMemo(
    () => (isGuest ? requested.slice(0, 2) : requested),
    [requested, isGuest],
  );

  const limit = rdwPreview ? 0 : aiPlateLimitForTier(auth.tier);
  const aiSlots = displayPlates.slice(0, limit);
  const rdwOnly = displayPlates.slice(limit);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [welcomeTrigger, setWelcomeTrigger] = useState(false);
  const [mobileTab, setMobileTab] = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem("ac_just_signed_up") === "1") {
      sessionStorage.removeItem("ac_just_signed_up");
      setWelcomeTrigger(true);
    }
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const compareNext = params.get("plates")
    ? `/compare?plates=${encodeURIComponent(params.get("plates")!)}`
    : "/compare";

  if (requested.length === 0) {
    return (
      <article className="compare">
        <header className="compare-hero">
          <p className="eyebrow">{t("compare.eyebrow")}</p>
          <h1>{t("compare.title")}</h1>
        </header>
        <div className="compare-empty">
          <div className="compare-empty-illustration" aria-hidden="true">
            <CompareCarIcon />
            <span className="compare-empty-vs">vs</span>
            <CompareCarIcon />
          </div>
          <p className="compare-empty-headline">{t("compare.empty.headline")}</p>
          <p className="compare-empty-body">{t("compare.empty.body")}</p>
          <div className="compare-empty-actions">
            <Link to="/dashboard" className="primary">{t("compare.empty.cta")}</Link>
            <Link to="/" className="ghost">{t("compare.empty.lookup")}</Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="compare">
      <WelcomeOnboardingSheet trigger={welcomeTrigger} />
      <header className="compare-hero">
        <p className="eyebrow">{t("compare.eyebrow")}</p>
        <h1>{t("compare.title")}</h1>
        <p className="compare-sub">{t("compare.subtitle", { n: displayPlates.length })}</p>
        {rdwPreview && (
          <ComparePreviewBanner
            variant={isGuest ? "guest" : "free"}
            signUpNext={compareNext}
          />
        )}
        {!rdwPreview && rdwOnly.length > 0 && (
          <div className="compare-gate" role="status">
            {t("compare.tierLimit", { aiCount: aiSlots.length, total: displayPlates.length, tier: auth.tier })}{" "}
            <Link to="/prijzen">{t("compare.upgradeLink")}</Link>
          </div>
        )}
        {rdwPreview && displayPlates.length > 0 && (
          <button
            type="button"
            className="ghost compare-unlock-ai"
            onClick={() => setPaywallOpen(true)}
          >
            {t("compare.paywall.trigger")}
          </button>
        )}
      </header>

      {displayPlates.length > 1 && (
        <CompareMobileTabs
          plates={displayPlates}
          activeIndex={mobileTab}
          onSelect={setMobileTab}
          scrollRef={scrollRef}
        />
      )}

      <div className="compare-table-scroll" ref={scrollRef}>
        <CompareTable
          plates={displayPlates}
          aiSlots={aiSlots}
          lang={lang}
          t={t}
          onAiLocked={rdwPreview ? () => setPaywallOpen(true) : undefined}
        />
      </div>

      {paywallOpen && <ComparePaywallSheet onClose={() => setPaywallOpen(false)} />}
    </article>
  );
}

// ─── Table ────────────────────────────────────────────────────────

interface PlateState {
  rdw:  { kind: "loading" } | { kind: "ok"; data: RdwVehicleDetail } | { kind: "error"; message: string };
  ai:   { kind: "skipped" } | { kind: "loading" } | { kind: "ok"; data: AiAnalysisV2; deepLoading?: boolean } | { kind: "error"; message: string };
  cost: { kind: "loading" } | { kind: "ok"; data: MonthlyCosts | null } | { kind: "error"; message: string };
}

type Extract = (s: PlateState) => string | null | undefined;

interface RowDef {
  label: string;
  extract: Extract;
  group: string;
  ai?: boolean;
  wide?: boolean;
}

function CompareTable({
  plates,
  aiSlots,
  lang,
  t,
  onAiLocked,
}: {
  plates: string[];
  aiSlots: string[];
  lang: "nl" | "en";
  t: (key: string, vars?: Record<string, string | number>) => string;
  onAiLocked?: () => void;
}) {
  const [states, setStates] = useState<Record<string, PlateState>>(() =>
    Object.fromEntries(plates.map((p) => [p, {
      rdw:  { kind: "loading" as const },
      // AI: aiSlots get a free "lite" analysis on load; the rest are RDW-only.
      // The paid "deep" analysis is fetched on demand per car (1 credit).
      ai:   (aiSlots.includes(p) ? { kind: "loading" as const } : { kind: "skipped" as const }),
      cost: { kind: "loading" as const },
    }])),
  );
  const [showMatches, setShowMatches] = useState(false);

  useEffect(() => {
    let cancelled = false;
    plates.forEach((plate) => {
      getVoertuig(plate).then((data) => {
        if (cancelled) return;
        setStates((s) => ({ ...s, [plate]: { ...s[plate], rdw: { kind: "ok", data } } }));
      }).catch((err) => {
        if (cancelled) return;
        const msg = err instanceof LookupError ? err.message : "load_failed";
        setStates((s) => ({ ...s, [plate]: { ...s[plate], rdw: { kind: "error", message: msg } } }));
      });

      // getMonthlyCosts wants a province override; null = let server pick.
      getMonthlyCosts(plate, null).then((data) => {
        if (cancelled) return;
        setStates((s) => ({ ...s, [plate]: { ...s[plate], cost: { kind: "ok", data } } }));
      }).catch(() => {
        if (cancelled) return;
        setStates((s) => ({ ...s, [plate]: { ...s[plate], cost: { kind: "error", message: "cost_failed" } } }));
      });

      // Free "lite" analysis on load for the AI slots (0 credits).
      if (aiSlots.includes(plate)) {
        getAiAnalysisV2(plate, lang, false).then((data) => {
          if (cancelled) return;
          setStates((s) => ({ ...s, [plate]: { ...s[plate], ai: { kind: "ok", data } } }));
        }).catch((err) => {
          if (cancelled) return;
          const msg = err instanceof LookupError ? err.message : "ai_failed";
          setStates((s) => ({ ...s, [plate]: { ...s[plate], ai: { kind: "error", message: msg } } }));
        });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plates.join(","), aiSlots.join(","), lang]);

  // On-demand paid "deep" analysis for one car. Charges 1 credit on success
  // (the server gates + debits); a credit-less user gets tier="needs_upgrade".
  const requestDeep = (plate: string) => {
    setStates((s) => {
      const cur = s[plate];
      if (cur?.ai.kind !== "ok") return s;
      return { ...s, [plate]: { ...cur, ai: { ...cur.ai, deepLoading: true } } };
    });
    getAiAnalysisV2(plate, lang, true)
      .then((data) => {
        setStates((s) => ({ ...s, [plate]: { ...s[plate], ai: { kind: "ok", data } } }));
      })
      .catch(() => {
        setStates((s) => {
          const cur = s[plate];
          if (cur?.ai.kind === "ok") {
            return { ...s, [plate]: { ...cur, ai: { ...cur.ai, deepLoading: false } } };
          }
          return s;
        });
      });
  };

  const rows: RowDef[] = useMemo(() => buildRows(t, lang), [t, lang]);

  // Decide per-row whether all cars share the same value (collapsible).
  const allLoaded = plates.every((p) => states[p]?.rdw.kind !== "loading");
  const partitioned = useMemo(() => {
    const same: RowDef[] = [];
    const diff: RowDef[] = [];
    for (const r of rows) {
      const values = plates.map((p) => normalise(extractSafe(states[p], r.extract) ?? ""));
      // Skip rows where the value is missing for ALL cars (don't clutter).
      if (values.every((v) => v === "")) continue;
      const uniq = new Set(values).size;
      // Only collapse when the row has data for every car AND values match.
      const isSame =
        allLoaded && plates.length > 1 && uniq === 1 && values.every((v) => v !== "");
      (isSame ? same : diff).push(r);
    }
    return { same, diff };
  }, [rows, plates, states, allLoaded]);

  let lastGroup: string | null = null;
  return (
    <table className="compare-table">
      <thead>
        <tr>
          <th scope="col" className="compare-col-label">{t("compare.col.metric")}</th>
          {plates.map((p) => (
            <th scope="col" key={p}>
              <PlateHeader
                plate={p}
                state={states[p]}
                lang={lang}
                onRequestDeep={() => requestDeep(p)}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {partitioned.diff.map((r) => {
          const groupChanged = r.group !== lastGroup;
          lastGroup = r.group;
          return (
            <>
              {groupChanged && (
                <tr key={`g-${r.group}`} className="compare-row-group">
                  <th scope="rowgroup" colSpan={1 + plates.length}>{r.group}</th>
                </tr>
              )}
              <Row
                key={r.label}
                {...r}
                plates={plates}
                states={states}
                t={t}
                onAiLocked={r.ai ? onAiLocked : undefined}
              />
            </>
          );
        })}

        {partitioned.same.length > 0 && (
          <>
            <tr className="compare-row-same-summary">
              <th scope="row">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowMatches((v) => !v)}
                  aria-expanded={showMatches}
                >
                  {showMatches
                    ? t("compare.collapse.hide", { n: partitioned.same.length })
                    : t("compare.collapse.show", { n: partitioned.same.length })}
                </button>
              </th>
              <td colSpan={plates.length}>
                <span className="compare-cell-empty">
                  {t("compare.collapse.hint")}
                </span>
              </td>
            </tr>
            {showMatches && partitioned.same.map((r) => (
              <Row
                key={r.label}
                {...r}
                plates={plates}
                states={states}
                t={t}
                muted
                onAiLocked={r.ai ? onAiLocked : undefined}
              />
            ))}
          </>
        )}
      </tbody>
    </table>
  );
}

function PlateHeader({
  plate,
  state,
  lang,
  onRequestDeep,
}: {
  plate: string;
  state: PlateState | undefined;
  lang: "nl" | "en";
  onRequestDeep: () => void;
}) {
  const merk = state?.rdw.kind === "ok" ? state.rdw.data.algemeen?.merk : null;
  const theme: BrandTheme | null = merk ? brandFor(merk) : null;
  return (
    <div className="compare-plate-head">
      <div
        className="compare-brand"
        style={theme ? { background: theme.accent, color: theme.ink } : undefined}
      >
        {theme ? <BrandLogo theme={theme} size={20} /> : <CompareCarIcon size={20} />}
      </div>
      <NlPlate value={plate} size="sm" />
      <DeepControl state={state} lang={lang} onRequestDeep={onRequestDeep} />
    </div>
  );
}

/**
 * Per-car control for the paid "deep" analysis. Shows after the free lite
 * analysis has loaded: a button to unlock the full analysis (1 credit), a
 * loading state, a done badge, or an upgrade link when the user has no credits.
 */
function DeepControl({
  state,
  lang,
  onRequestDeep,
}: {
  state: PlateState | undefined;
  lang: "nl" | "en";
  onRequestDeep: () => void;
}) {
  if (!state || state.ai.kind !== "ok") return null;
  const { data, deepLoading } = state.ai;
  const en = lang === "en";

  if (deepLoading) {
    return <span className="compare-deep-status">{en ? "Analysing…" : "Analyseren…"}</span>;
  }
  if (data.tier === "deep") {
    return <span className="compare-deep-status compare-deep-done">{en ? "✓ Full analysis" : "✓ Volledige analyse"}</span>;
  }
  if (data.tier === "needs_upgrade") {
    return (
      <Link to={data.upgradeUrl ?? "/prijzen"} className="compare-deep-upgrade">
        {en ? "Buy credits" : "Credits kopen"}
      </Link>
    );
  }
  // tier === "lite" → offer the paid upgrade.
  return (
    <button type="button" className="compare-deep-btn" onClick={onRequestDeep}>
      {en ? "Full analysis (1 credit)" : "Volledige analyse (1 credit)"}
    </button>
  );
}

function Row({
  label,
  extract,
  states,
  plates,
  ai,
  wide,
  muted,
  onAiLocked,
  t,
}: {
  label: string;
  extract: Extract;
  states: Record<string, PlateState>;
  plates: string[];
  ai?: boolean;
  wide?: boolean;
  muted?: boolean;
  onAiLocked?: () => void;
  t: (key: string) => string;
} & Pick<RowDef, "group">) {
  return (
    <tr className={`${ai ? "compare-row-ai" : ""} ${wide ? "compare-row-wide" : ""} ${muted ? "compare-row-muted" : ""}`}>
      <th scope="row">{label}</th>
      {plates.map((p) => {
        const s = states[p];
        if (ai && onAiLocked && s?.ai.kind === "skipped") {
          return (
            <td key={p}>
              <button type="button" className="compare-ai-lock" onClick={onAiLocked}>
                {t("compare.ai.skipped")}
              </button>
            </td>
          );
        }
        const cell = s ? extract(s) : "-";
        return (
          <td key={p}>
            {cell == null || cell === ""
              ? <span className="compare-cell-empty">-</span>
              : <span>{cell}</span>}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Row catalogue ────────────────────────────────────────────────

function buildRows(
  t: (k: string, v?: Record<string, string | number>) => string,
  lang: "nl" | "en",
): RowDef[] {
  const G = {
    identity: t("compare.group.identity"),
    legal:    t("compare.group.legal"),
    engine:   t("compare.group.engine"),
    body:     t("compare.group.body"),
    cost:     t("compare.group.cost"),
    ai:       t("compare.group.ai"),
  };
  return [
    // Identity
    { group: G.identity, label: t("compare.row.brand"),    extract: (s) => rdw(s)?.algemeen?.merk },
    { group: G.identity, label: t("compare.row.model"),    extract: (s) => rdw(s)?.algemeen?.model },
    { group: G.identity, label: t("compare.row.variant"),  extract: (s) => rdw(s)?.algemeen?.uitvoering },
    { group: G.identity, label: t("compare.row.year"),     extract: (s) => formatYear(rdw(s)?.algemeen?.datumEersteToelating) },
    { group: G.identity, label: t("compare.row.firstNl"),  extract: (s) => formatDate(rdw(s)?.algemeen?.datumEersteNlRegistratie, lang) },
    { group: G.identity, label: t("compare.row.colour"),   extract: (s) => rdw(s)?.algemeen?.eersteKleur },
    { group: G.identity, label: t("compare.row.imported"), extract: (s) => boolish(rdw(s)?.algemeen?.importauto, t) },
    // Legal / status
    { group: G.legal, label: t("compare.row.apk"),         extract: (s) => formatDate(rdw(s)?.status?.apkGeldigTot, lang) },
    { group: G.legal, label: t("compare.row.insured"),     extract: (s) => boolish(rdw(s)?.status?.wamVerzekerd, t) },
    { group: G.legal, label: t("compare.row.recall"),      extract: (s) => boolish(rdw(s)?.status?.openstaandeTerugroepactie, t) },
    { group: G.legal, label: t("compare.row.taxi"),        extract: (s) => boolish(rdw(s)?.status?.taxi, t) },
    { group: G.legal, label: t("compare.row.exported"),    extract: (s) => boolish(rdw(s)?.status?.exported, t) },
    // Engine + environment
    { group: G.engine, label: t("compare.row.fuel"),       extract: (s) => rdw(s)?.motorMilieu?.brandstof },
    { group: G.engine, label: t("compare.row.power"),      extract: (s) => num(rdw(s)?.motorMilieu?.vermogenPk, "pk") },
    { group: G.engine, label: t("compare.row.displacement"), extract: (s) => num(rdw(s)?.motorMilieu?.cilinderinhoudCc, "cc") },
    { group: G.engine, label: t("compare.row.co2"),        extract: (s) => num(rdw(s)?.motorMilieu?.co2GecombineerdGperKm, "g/km") },
    { group: G.engine, label: t("compare.row.consumption"),extract: (s) => num(rdw(s)?.motorMilieu?.verbruikGecombineerd, "l/100km") },
    { group: G.engine, label: t("compare.row.emissionClass"), extract: (s) => rdw(s)?.motorMilieu?.uitlaatemissieniveau },
    { group: G.engine, label: t("compare.row.energyLabel"),extract: (s) => rdw(s)?.motorMilieu?.zuinigheidslabel },
    // Body / dimensions
    { group: G.body, label: t("compare.row.bodyType"),     extract: (s) => rdw(s)?.algemeen?.inrichting },
    { group: G.body, label: t("compare.row.seats"),        extract: (s) => num(rdw(s)?.algemeen?.aantalZitplaatsen, "") },
    { group: G.body, label: t("compare.row.doors"),        extract: (s) => num(rdw(s)?.algemeen?.aantalDeuren, "") },
    { group: G.body, label: t("compare.row.kerbWeight"),   extract: (s) => num(rdw(s)?.carrosserie?.massaLedigKg, "kg") },
    { group: G.body, label: t("compare.row.maxTowBraked"), extract: (s) => num(rdw(s)?.carrosserie?.maxTrekkenGeremdKg, "kg") },
    // Monthly cost
    { group: G.cost, label: t("compare.row.costTotal"),    extract: (s) => costRange(cost(s)?.total) },
    { group: G.cost, label: t("compare.row.costMrb"),      extract: (s) => mrb(cost(s)) },
    { group: G.cost, label: t("compare.row.costFuel"),     extract: (s) => costRange(cost(s)?.fuel) },
    { group: G.cost, label: t("compare.row.costInsurance"),extract: (s) => costRange(cost(s)?.insurance) },
    { group: G.cost, label: t("compare.row.costMaintenance"), extract: (s) => costRange(cost(s)?.maintenance) },
    { group: G.cost, label: t("compare.row.costApk"),      extract: (s) => costRange(cost(s)?.apkReservering) },
    // AI
    { group: G.ai, label: t("compare.row.value"),    extract: (s) => s.ai.kind === "ok" ? s.ai.data.marketValue?.estimateRangeEur ?? "-" : aiSlotLabel(s, t), ai: true },
    { group: G.ai, label: t("compare.row.summary"),  extract: (s) => s.ai.kind === "ok" ? s.ai.data.summary ?? "-" : aiSlotLabel(s, t), ai: true, wide: true },
  ];
}

function rdw(s: PlateState): RdwVehicleDetail | undefined {
  return s.rdw.kind === "ok" ? s.rdw.data : undefined;
}
function cost(s: PlateState): MonthlyCosts | undefined {
  return s.cost.kind === "ok" && s.cost.data ? s.cost.data : undefined;
}
function costRange(r: MonthlyCostsRange | null | undefined): string | undefined {
  if (!r || r.lowEur == null || r.highEur == null) return undefined;
  return `€ ${r.lowEur} - € ${r.highEur}/mnd`;
}
function mrb(c: MonthlyCosts | undefined): string | undefined {
  if (!c?.mrb || c.mrb.totalQuarterEur == null) return undefined;
  // MRB is billed per quarter - surface monthly equivalent for compare parity.
  const monthly = Math.round((c.mrb.totalQuarterEur as number) / 3);
  return `€ ${monthly}/mnd (${c.province ?? "-"})`;
}
function num(v: number | null | undefined, unit: string): string | undefined {
  if (v == null) return undefined;
  return unit ? `${v} ${unit}` : String(v);
}
function boolish(v: boolean | null | undefined, t: (k: string) => string): string | undefined {
  if (v == null) return undefined;
  return v ? t("compare.value.yes") : t("compare.value.no");
}
function extractSafe(state: PlateState | undefined, extract: Extract): string | null | undefined {
  if (!state) return undefined;
  try { return extract(state); } catch { return undefined; }
}

// ─── Helpers ──────────────────────────────────────────────────────

function parsePlates(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => normalise(p))
    .filter((p) => p.length >= 4 && p.length <= 8)
    .slice(0, MAX_PLATES);
}

function aiPlateLimitForTier(tier: Tier): number {
  switch (tier) {
    case "free":  return 0;
    case "pass":  return 1;
    case "pro":   return 3;
    case "power": return 3;  // page caps at 3 regardless
  }
}

function formatYear(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  return iso.slice(0, 4);
}

function formatDate(iso: string | null | undefined, lang: "nl" | "en"): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "nl-NL", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function aiSlotLabel(
  s: PlateState,
  t: (k: string) => string,
): string | undefined {
  if (s.ai.kind === "loading") return t("compare.ai.loading");
  if (s.ai.kind === "skipped") return t("compare.ai.skipped");
  if (s.ai.kind === "error")   return t("compare.ai.error");
  return undefined;
}

function CompareCarIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 11l2-5h10l2 5" />
      <rect x="2" y="11" width="20" height="7" rx="2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M2 15h20" />
    </svg>
  );
}
