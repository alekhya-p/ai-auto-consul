import { useEffect, useState } from "react";
import { getAiAnalysisV2, type AiAnalysisV2 } from "../../lib/api";
import { useI18n, useT } from "../../lib/i18n";
import { prettyPlate } from "../../lib/voertuigCache";

interface DossierLiteAnalysisProps {
  plate: string;
}

/**
 * Free lite AI summary on the dossier page (signed-in). Deep analysis stays
 * in /v2/chat and costs a credit on cache miss.
 */
export function DossierLiteAnalysis({ plate }: DossierLiteAnalysisProps) {
  const { lang } = useI18n();
  const t = useT();
  const [data, setData] = useState<AiAnalysisV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    getAiAnalysisV2(plate, lang, false, ctrl.signal)
      .then((d) => {
        setData(d);
        setFailed(Boolean(d.error) || d.tier === "needs_upgrade");
      })
      .catch(() => {
        setData(null);
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [plate, lang]);

  const pretty = prettyPlate(plate.toUpperCase());

  if (loading) {
    return (
      <section className="card dossier-lite-analysis" aria-busy="true">
        <h2>{t("voertuig.lite.title", { plate: pretty })}</h2>
        <p className="dossier-lite-muted">{t("voertuig.lite.loading")}</p>
      </section>
    );
  }

  if (failed || !data?.summary) {
    return null;
  }

  const flags = (data.redFlags ?? []).slice(0, 3);

  return (
    <section className="card dossier-lite-analysis">
      <header className="dossier-lite-head">
        <h2>{t("voertuig.lite.title", { plate: pretty })}</h2>
        <span className="badge badge-ai">{t("voertuig.lite.badge")}</span>
      </header>
      <p className="dossier-lite-summary">{data.summary}</p>
      {flags.length > 0 && (
        <ul className="dossier-lite-flags">
          {flags.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
