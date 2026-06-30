import { prettyPlate } from "../lib/voertuigCache";
import type { RdwVehicleSummary } from "../lib/types";

interface Props {
  summary: RdwVehicleSummary;
}

export function SummaryCard({ summary }: Props) {
  if (!summary.found) {
    return (
      <div className="card not-found">
        <strong>{prettyPlate(summary.kenteken)}</strong> isn't in the RDW
        registry. Is it imported, written off, or was the plate transferred?
      </div>
    );
  }

  const title = [summary.make, summary.model].filter(Boolean).join(" ");

  return (
    <article className="card">
      <header>
        <span className="plate">{prettyPlate(summary.kenteken)}</span>
        <span className="title">{title || "Unknown vehicle"}</span>
      </header>

      <dl>
        <Row label="APK valid until">
          <span className={summary.apkValid ? "ok" : "warn"}>
            {summary.apkValidUntil ?? "-"}
            {summary.apkValid ? " ✓" : summary.apkValidUntil ? " (expired)" : ""}
          </span>
        </Row>
        <Row label="First NL registration">
          {summary.firstNlRegistration ?? "-"}
          {summary.imported && <span className="badge">imported</span>}
        </Row>
        <Row label="Open recall">
          <span className={summary.openRecall ? "warn" : "ok"}>
            {summary.openRecall ? "yes - check the recall record" : "none"}
          </span>
        </Row>
        <Row label="Energy label">{summary.energyLabel ?? "-"}</Row>
      </dl>

      <footer>
        Want valuation, factory options, VIN history, or a finance/photo audit?{" "}
        <strong>Buy a Single Pass (€4.95)</strong>
      </footer>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

