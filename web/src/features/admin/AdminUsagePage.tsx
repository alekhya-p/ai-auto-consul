import { useEffect, useState } from "react";
import { getAdminUsage, type UsageReport } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { usageToolLabel } from "../../lib/usageToolLabels";
import { UsageBars } from "./usageBars";
import "./admin.css";

const RANGES = [7, 30, 90] as const;

export function AdminUsagePage() {
  const t = useT();
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    getAdminUsage(days, ctrl.signal)
      .then((r) => setReport(r))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [days]);

  return (
    <section className="admin-usage">
      <header className="admin-usage-head">
        <h1>{t("admin.usage.title")}</h1>
        <div className="admin-range" role="group" aria-label={t("admin.usage.rangeLabel")}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`admin-range-btn${r === days ? " active" : ""}`}
              onClick={() => setDays(r)}
            >
              {t("admin.usage.daysN", { n: r })}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="admin-usage-loading" role="status">{t("admin.usage.loading")}</p>}
      {error && <p className="admin-usage-error" role="alert">{t("admin.usage.error")}</p>}

      {report && !loading && !error && (
        <>
          <ul className="admin-cards">
            <Card label={t("admin.usage.cards.turns")} value={report.totals.turns} />
            <Card label={t("admin.usage.cards.credits")} value={report.totals.credits} />
            <Card label={t("admin.usage.cards.avgPerTurn")} value={round(report.totals.avgCreditsPerTurn)} />
            <Card label={t("admin.usage.cards.avgTools")} value={round(report.totals.avgToolsPerTurn)} />
            <Card label={t("admin.usage.cards.users")} value={report.totals.uniqueUsers} />
          </ul>

          <section className="admin-panel">
            <h2>{t("admin.usage.perTool.title")}</h2>
            {report.perTool.length === 0 ? (
              <p className="admin-empty">{t("admin.usage.empty")}</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.usage.perTool.tool")}</th>
                    <th>{t("admin.usage.perTool.calls")}</th>
                    <th>{t("admin.usage.perTool.cost")}</th>
                    <th>{t("admin.usage.perTool.avg")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perTool.map((s) => (
                    <tr key={s.toolName}>
                      <td>{usageToolLabel(s.toolName, t)}</td>
                      <td>{s.calls}</td>
                      <td>{s.totalCost}</td>
                      <td>{round(s.avgCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-panel">
            <h2>{t("admin.usage.cache.title")}</h2>
            {report.cacheStats.length === 0 ? (
              <p className="admin-empty">{t("admin.usage.empty")}</p>
            ) : (
              <UsageBars
                bars={report.cacheStats.map((c) => ({
                  label: c.source,
                  value: Math.round(c.hitRate * 100),
                  display: `${Math.round(c.hitRate * 100)}% (${c.hits}/${c.hits + c.misses})`,
                }))}
              />
            )}
          </section>

          <section className="admin-panel">
            <h2>{t("admin.usage.ai.title")}</h2>
            {report.aiStats.length === 0 ? (
              <p className="admin-empty">{t("admin.usage.empty")}</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.usage.ai.model")}</th>
                    <th>{t("admin.usage.ai.calls")}</th>
                    <th>{t("admin.usage.ai.inTok")}</th>
                    <th>{t("admin.usage.ai.outTok")}</th>
                    <th>{t("admin.usage.ai.latency")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.aiStats.map((a) => (
                    <tr key={a.model}>
                      <td>{a.model}</td>
                      <td>{a.calls}</td>
                      <td>{round(a.avgInputTokens)}</td>
                      <td>{round(a.avgOutputTokens)}</td>
                      <td>{round(a.avgLatencyMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-panel">
            <h2>{t("admin.usage.daily.title")}</h2>
            {report.daily.length === 0 ? (
              <p className="admin-empty">{t("admin.usage.empty")}</p>
            ) : (
              <UsageBars
                bars={report.daily.map((d) => ({ label: d.date, value: d.credits, display: String(d.credits) }))}
              />
            )}
          </section>

          {report.truncated && <p className="admin-usage-error">{t("admin.usage.truncated")}</p>}
        </>
      )}
    </section>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <li className="admin-card">
      <span className="admin-card-value">{value}</span>
      <span className="admin-card-label">{label}</span>
    </li>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
