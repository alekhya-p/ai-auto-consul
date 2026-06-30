import { CacheStamp } from "./CacheStamp";
import { SourceBadge } from "./SourceBadge";
import "./chat-v2.css";

export interface AnalysisCardProps {
  plate?: string;
  lang?: "nl" | "en";
  loading?: boolean;
  error?: string;
  /** Called when the user clicks "Volledige analyse" on a free (lite) card. */
  onRequestDeep?: () => void;
  data?: {
    /** "lite" (free), "deep" (paid), or "needs_upgrade" (no credits). */
    tier?: "lite" | "deep" | "needs_upgrade";
    upgradeUrl?: string;
    creditsCharged?: number;
    balanceAfter?: number;
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
    runningCostsPerYearEur?: {
      fuelOrEnergy?: string;
      insuranceBand?: string;
      maintenance?: string;
      roadTaxMrb?: string;
    };
    dutchTaxNotes?: string;
    emissionZonesAndBans?: string;
    negotiationLeverage?: string[];
    bestAlternatives?: { model?: string; whyBetter?: string }[];
    comparisonWithCurrentModels?: string;
    competitorBrands?: string[];
    confidence?: string;
    cachedAt?: string;
    fromCache?: boolean;
    sources?: {
      vehicleData?: string;
      marketAnalysis?: string;
      taxInfo?: string;
    };
  };
}

/**
 * Generative UI card for AI vehicle analysis.
 * Rendered inline in the CopilotKit chat thread when the AI calls aiAnalysisFetch.
 * Adapts to the tier: a free "lite" card shows a "Volledige analyse" upsell;
 * a paid "deep" card shows the full premium dossier; "needs_upgrade" shows the
 * lite findings with an upgrade CTA to /prijzen.
 */
const A = {
  computing: { nl: "Analyse berekenen…", en: "Computing analysis…" },
  deepBadge: { nl: "Volledige AI Analyse", en: "Full AI analysis" },
  liteBadge: { nl: "AI Analyse", en: "AI analysis" },
  marketValue: { nl: "Marktwaarde", en: "Market value" },
  fairPrice: { nl: "Reële prijs", en: "Fair price" },
  risks: { nl: "Belangrijke risico's", en: "Key risks" },
  pros: { nl: "Voordelen", en: "Pros" },
  cons: { nl: "Nadelen", en: "Cons" },
  checkBeforeBuying: { nl: "Controleer voor aankoop", en: "Check before buying" },
  reliability: { nl: "Betrouwbaarheid & bekende problemen", en: "Reliability & known issues" },
  recalls: { nl: "Terugroepacties", en: "Recalls" },
  yearlyCosts: { nl: "Jaarlijkse kosten", en: "Yearly costs" },
  fuel: { nl: "Brandstof/energie", en: "Fuel/energy" },
  insurance: { nl: "Verzekering", en: "Insurance" },
  maintenance: { nl: "Onderhoud", en: "Maintenance" },
  roadTax: { nl: "Wegenbelasting (MRB)", en: "Road tax (MRB)" },
  taxInfo: { nl: "Belastinginfo", en: "Tax info" },
  emissionZones: { nl: "Milieuzones", en: "Emission zones" },
  negotiation: { nl: "Onderhandelingsargumenten", en: "Negotiation points" },
  alternatives: { nl: "Beste alternatieven", en: "Best alternatives" },
  comparison: { nl: "Vergelijking met huidige modellen", en: "Comparison with current models" },
  competitors: { nl: "Alternatieven", en: "Alternatives" },
  upgradeBody: {
    nl: "Dit is de gratis analyse. De volledige analyse (risico's, betrouwbaarheid, jaarlijkse kosten, onderhandeling) kost 1 credit.",
    en: "This is the free analysis. The full analysis (risks, reliability, yearly costs, negotiation) costs 1 credit.",
  },
  buyCredits: { nl: "Credits kopen", en: "Buy credits" },
  fullAnalysisCta: { nl: "Volledige analyse (1 credit)", en: "Full analysis (1 credit)" },
  creditUsed: { nl: "credit gebruikt", en: "credit used" },
  remaining: { nl: "resterend", en: "remaining" },
  disclaimer: {
    nl: "AI-analyse is indicatief. Controleer altijd zelf voor aankoop.",
    en: "AI analysis is indicative. Always verify yourself before buying.",
  },
  confidence: { nl: "betrouwbaarheid", en: "confidence" },
  provenance: { nl: "Bronnen", en: "Sources" },
  srcVehicle: { nl: "Voertuigdata", en: "Vehicle data" },
  srcMarket: { nl: "Marktanalyse", en: "Market analysis" },
  srcTax: { nl: "Belasting", en: "Tax" },
} as const;

export function AnalysisCard({ plate, lang = "nl", loading, error, data, onRequestDeep }: AnalysisCardProps) {
  if (loading) {
    return (
      <div className="analysis-card card">
        <div className="analysis-card-header">
          {plate && <span className="vehicle-plate-badge">{plate}</span>}
          <span className="analysis-card-fetching">{A.computing[lang]}</span>
        </div>
        <div className="vehicle-data-skeleton">
          <div className="skeleton-line w-80" />
          <div className="skeleton-line w-60" />
          <div className="skeleton-line w-75" />
          <div className="skeleton-line w-50" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-card card analysis-card-error">
        <div className="analysis-card-header">
          {plate && <span className="vehicle-plate-badge">{plate}</span>}
          <span className="badge badge-ai">AI</span>
        </div>
        <p style={{ color: "var(--danger)", margin: "0.5rem 0 0" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const tier = data.tier ?? "lite";
  const isDeep = tier === "deep";
  const hasWatchouts = (data.thingsToCheckBeforeBuying?.length ?? 0) > 0;
  const hasPros = (data.pros?.length ?? 0) > 0;
  const hasCons = (data.cons?.length ?? 0) > 0;
  const hasRedFlags = (data.redFlags?.length ?? 0) > 0;
  const running = data.runningCostsPerYearEur;
  const hasRunning =
    !!running && Object.values(running).some((v) => typeof v === "string" && v.length > 0);

  return (
    <div className="analysis-card card">
      {/* Header */}
      <div className="analysis-card-header">
        {plate && <span className="vehicle-plate-badge">{plate}</span>}
        <span className="badge badge-ai">{isDeep ? A.deepBadge[lang] : A.liteBadge[lang]}</span>
      </div>

      {/* Market value - hero element */}
      {data.marketValue?.estimateRangeEur && (
        <div className="analysis-market-value">
          <span className="analysis-market-label">{A.marketValue[lang]}</span>
          <strong className="analysis-market-price">{data.marketValue.estimateRangeEur}</strong>
          {data.marketValue.fairPriceEur && (
            <p className="analysis-market-note">{A.fairPrice[lang]}: <strong>{data.marketValue.fairPriceEur}</strong></p>
          )}
          {data.marketValue.explanation && (
            <p className="analysis-market-note">{data.marketValue.explanation}</p>
          )}
          {data.marketValue.depreciationOutlook && (
            <p className="analysis-market-note">{data.marketValue.depreciationOutlook}</p>
          )}
        </div>
      )}

      {/* Summary */}
      {data.summary && <p className="analysis-summary">{data.summary}</p>}

      {/* Red flags - deep only, surfaced prominently */}
      {hasRedFlags && (
        <div className="analysis-watchouts" style={{ borderColor: "var(--danger)" }}>
          <h4 className="analysis-watchouts-title" style={{ color: "var(--danger)" }}>
            {A.risks[lang]}
          </h4>
          <ul>
            {data.redFlags!.map((r, i) => (
              <li key={i}>⚠ {r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pros / Cons side by side */}
      {(hasPros || hasCons) && (
        <div className="analysis-proscons">
          {hasPros && (
            <div className="analysis-proscons-col analysis-pros">
              <h4 className="analysis-proscons-title">{A.pros[lang]}</h4>
              <ul>
                {data.pros!.map((p, i) => (
                  <li key={i}><span className="analysis-check" aria-hidden="true">✓</span> {p}</li>
                ))}
              </ul>
            </div>
          )}
          {hasCons && (
            <div className="analysis-proscons-col analysis-cons">
              <h4 className="analysis-proscons-title">{A.cons[lang]}</h4>
              <ul>
                {data.cons!.map((c, i) => (
                  <li key={i}><span className="analysis-cross" aria-hidden="true">✗</span> {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Things to check */}
      {hasWatchouts && (
        <div className="analysis-watchouts">
          {data.thingsToCheckBeforeBuying!.length <= 3 ? (
            <>
              <h4 className="analysis-watchouts-title">{A.checkBeforeBuying[lang]}</h4>
              <ul>
                {data.thingsToCheckBeforeBuying!.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          ) : (
            <details>
              <summary className="analysis-watchouts-title">
                {A.checkBeforeBuying[lang]} ({data.thingsToCheckBeforeBuying!.length})
              </summary>
              <ul>
                {data.thingsToCheckBeforeBuying!.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Collapsible secondary info */}
      <div className="analysis-details">
        {data.reliabilityNotes && (
          <details>
            <summary>{A.reliability[lang]}</summary>
            <p>{data.reliabilityNotes}</p>
          </details>
        )}
        {data.recallSummary && (
          <details>
            <summary>{A.recalls[lang]}</summary>
            <p>{data.recallSummary}</p>
          </details>
        )}
        {hasRunning && (
          <details>
            <summary>{A.yearlyCosts[lang]}</summary>
            <ul>
              {running!.fuelOrEnergy && <li>{A.fuel[lang]}: {running!.fuelOrEnergy}</li>}
              {running!.insuranceBand && <li>{A.insurance[lang]}: {running!.insuranceBand}</li>}
              {running!.maintenance && <li>{A.maintenance[lang]}: {running!.maintenance}</li>}
              {running!.roadTaxMrb && <li>{A.roadTax[lang]}: {running!.roadTaxMrb}</li>}
            </ul>
          </details>
        )}
        {data.dutchTaxNotes && (
          <details>
            <summary>{A.taxInfo[lang]}</summary>
            <p>{data.dutchTaxNotes}</p>
          </details>
        )}
        {data.emissionZonesAndBans && (
          <details>
            <summary>{A.emissionZones[lang]}</summary>
            <p>{data.emissionZonesAndBans}</p>
          </details>
        )}
        {(data.negotiationLeverage?.length ?? 0) > 0 && (
          <details>
            <summary>{A.negotiation[lang]}</summary>
            <ul>
              {data.negotiationLeverage!.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}
        {(data.bestAlternatives?.length ?? 0) > 0 && (
          <details>
            <summary>{A.alternatives[lang]}</summary>
            <ul>
              {data.bestAlternatives!.map((a, i) => (
                <li key={i}>
                  <strong>{a.model}</strong>{a.whyBetter ? ` - ${a.whyBetter}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
        {data.comparisonWithCurrentModels && (
          <details>
            <summary>{A.comparison[lang]}</summary>
            <p>{data.comparisonWithCurrentModels}</p>
          </details>
        )}
        {(data.competitorBrands?.length ?? 0) > 0 && (
          <details>
            <summary>{A.competitors[lang]}</summary>
            <ul className="analysis-chips">
              {data.competitorBrands!.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Upgrade / upsell footer */}
      {tier === "needs_upgrade" && (
        <div className="analysis-upgrade">
          <p>{A.upgradeBody[lang]}</p>
          <a className="btn btn-primary" href={data.upgradeUrl ?? "/prijzen"}>{A.buyCredits[lang]}</a>
        </div>
      )}
      {tier === "lite" && onRequestDeep && (
        <div className="analysis-upgrade">
          <button type="button" className="btn btn-primary" onClick={onRequestDeep}>
            {A.fullAnalysisCta[lang]}
          </button>
        </div>
      )}
      {isDeep && typeof data.creditsCharged === "number" && data.creditsCharged > 0 && (
        <p className="analysis-disclaimer">
          {data.creditsCharged} {A.creditUsed[lang]}{typeof data.balanceAfter === "number" ? ` · ${data.balanceAfter} ${A.remaining[lang]}` : ""}.
        </p>
      )}

      {data.sources && (
        <div className="analysis-provenance">
          <span className="analysis-provenance-label">{A.provenance[lang]}</span>
          <ul>
            {data.sources.vehicleData && (
              <li><strong>{A.srcVehicle[lang]}:</strong> {data.sources.vehicleData}</li>
            )}
            {data.sources.marketAnalysis && (
              <li><strong>{A.srcMarket[lang]}:</strong> {data.sources.marketAnalysis}</li>
            )}
            {data.sources.taxInfo && (
              <li><strong>{A.srcTax[lang]}:</strong> {data.sources.taxInfo}</li>
            )}
          </ul>
        </div>
      )}

      <CacheStamp cachedAt={data.cachedAt} />

      <p className="analysis-disclaimer">
        {A.disclaimer[lang]}{data.confidence ? ` (${A.confidence[lang]}: ${data.confidence})` : ""}
        {data.fromCache ? (lang === "en" ? " · Served from cache (no credit charged)." : " · Uit cache (geen credit afgeschreven).") : ""}
      </p>

      <div className="analysis-card-footer">
        <SourceBadge source="ai" lang={lang} />
      </div>
    </div>
  );
}
