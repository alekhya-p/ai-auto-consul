import { CacheStamp } from "./CacheStamp";
import { SourceBadge } from "./SourceBadge";
import "./chat-v2.css";

export interface VehicleDataCardProps {
  plate?: string;
  lang?: "nl" | "en";
  data?: {
    kenteken?: string;
    found?: boolean;
    make?: string;
    model?: string;
    firstRegistration?: string;
    firstNlRegistration?: string;
    imported?: boolean;
    apkValidUntil?: string;
    apkValid?: boolean;
    openRecall?: boolean;
    liabilityInsured?: boolean;
    exported?: boolean;
    taxi?: boolean;
    energyLabel?: string;
    cachedAt?: string;
  };
  loading?: boolean;
  error?: string;
}

const L = {
  fetching: { nl: "Gegevens ophalen…", en: "Fetching data…" },
  notFound: { nl: "Niet gevonden in het RDW-register", en: "Not found in the RDW registry" },
  apkValid: { nl: "APK geldig", en: "MOT valid" },
  apkExpired: { nl: "APK verlopen", en: "MOT expired" },
  until: { nl: "tot", en: "until" },
  recall: { nl: "Terugroepactie", en: "Recall" },
  imported: { nl: "Import", en: "Imported" },
  insured: { nl: "WAM verzekerd", en: "Insured" },
  uninsured: { nl: "WAM onverzekerd", en: "Uninsured" },
  energy: { nl: "Energielabel", en: "Energy label" },
  exported: { nl: "Geëxporteerd", en: "Exported" },
  taxi: { nl: "Taxi", en: "Taxi" },
  firstNl: { nl: "Eerste NL-registratie", en: "First NL registration" },
} as const;

/**
 * Generative UI card for Dutch vehicle RDW data.
 * Rendered inline in the CopilotKit chat thread when the AI calls rdwFetch.
 */
export function VehicleDataCard({ plate, lang = "nl", data, loading, error }: VehicleDataCardProps) {
  if (loading) {
    return (
      <div className="vehicle-data-card card">
        <div className="vehicle-data-card-header">
          <span className="vehicle-plate-loading">{plate ?? "…"}</span>
          <span className="vehicle-data-card-fetching">{L.fetching[lang]}</span>
        </div>
        <div className="vehicle-data-skeleton">
          <div className="skeleton-line w-70" />
          <div className="skeleton-line w-50" />
          <div className="skeleton-line w-60" />
        </div>
      </div>
    );
  }

  if (error || data?.found === false) {
    return (
      <div className="vehicle-data-card card vehicle-data-card-error">
        <div className="vehicle-data-card-header">
          <span className="vehicle-plate-badge">{plate ?? "?"}</span>
        </div>
        <p style={{ color: "var(--danger)", margin: "0.5rem 0 0" }}>{error ?? L.notFound[lang]}</p>
      </div>
    );
  }

  if (!data) return null;

  const displayPlate = data.kenteken ?? plate ?? "?";
  const year = data.firstRegistration
    ? data.firstRegistration.slice(0, 4)
    : null;

  return (
    <div className="vehicle-data-card card">
      {/* Header: plate + make/model/year */}
      <div className="vehicle-data-card-header">
        <span className="vehicle-plate-badge">{formatPlate(displayPlate)}</span>
        {(data.make || data.model) && (
          <span className="vehicle-identity">
            {[data.make, data.model, year].filter(Boolean).join(" ")}
          </span>
        )}
      </div>

      {/* Status badges row */}
      <div className="vehicle-status-row">
        {/* APK status */}
        {data.apkValid !== undefined && (
          <span className={`card-badge ${data.apkValid ? "apk-ok" : "apk-expired"}`}>
            {data.apkValid ? L.apkValid[lang] : L.apkExpired[lang]}
            {data.apkValidUntil && !data.apkValid && ` ${L.until[lang]} ${formatDate(data.apkValidUntil)}`}
          </span>
        )}
        {data.apkValid && data.apkValidUntil && (
          <span className="vehicle-apk-until">{L.until[lang]} {formatDate(data.apkValidUntil)}</span>
        )}

        {/* Recall */}
        {data.openRecall && (
          <span className="card-badge recall-open">{L.recall[lang]}</span>
        )}

        {/* Imported */}
        {data.imported && (
          <span className="card-badge imported">{L.imported[lang]}</span>
        )}

        {/* Insurance */}
        {data.liabilityInsured !== undefined && (
          <span className={`card-badge ${data.liabilityInsured ? "apk-ok" : "apk-expired"}`}>
            {data.liabilityInsured ? L.insured[lang] : L.uninsured[lang]}
          </span>
        )}
      </div>

      {/* Energy label chip */}
      {data.energyLabel && (
        <div className="vehicle-energy-row">
          <span className={`vehicle-energy-chip energy-${data.energyLabel.toLowerCase()}`}>
            {L.energy[lang]} {data.energyLabel}
          </span>
        </div>
      )}

      {/* Extra flags */}
      {(data.exported || data.taxi) && (
        <div className="vehicle-flags-row">
          {data.exported && <span className="card-badge apk-expired">{L.exported[lang]}</span>}
          {data.taxi && <span className="card-badge imported">{L.taxi[lang]}</span>}
        </div>
      )}

      {/* First NL registration date (import context) */}
      {data.imported && data.firstNlRegistration && (
        <p className="vehicle-data-meta">
          {L.firstNl[lang]}: {formatDate(data.firstNlRegistration)}
        </p>
      )}

      <CacheStamp cachedAt={data.cachedAt} />

      {/* Source attribution footer */}
      <div className="vehicle-data-card-footer">
        <SourceBadge source="rdw" lang={lang} />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Formats a bare Dutch plate (XXYYYYY) into display format.
 * Simple heuristic: insert dashes for common NL sidecar patterns.
 * Actual formatting is complex (>70 formats); this covers the most common.
 */
function formatPlate(raw: string): string {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  // XX-123-Y, 12-AB-34, etc. - RDW normalises to exactly these widths.
  // For now, just insert a dash every 2 chars if length 6, every 2+3 if 7.
  if (s.length === 6) return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4)}`;
  if (s.length === 7) return `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`;
  return s;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
