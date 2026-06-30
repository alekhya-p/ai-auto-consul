import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAiAnalysisV2, type AiAnalysisV2 } from "../../lib/api";
import {
  buildDossierExportHtml,
  labelsFromT,
  printDossierExport,
} from "../../lib/dossierExport";
import type { Lang } from "../../lib/i18n";
import { useT, useTList } from "../../lib/i18n";
import type { RdwVehicleDetail } from "../../lib/types";
import { prettyPlate } from "../../lib/voertuigCache";

interface DossierExportPanelProps {
  plate: string;
  detail: RdwVehicleDetail;
  lang: Lang;
}

/**
 * Signed-in dossier actions: export PDF (RDW + lite + optional deep AI)
 * and on-demand full analysis (1 credit).
 */
export function DossierExportPanel({ plate, detail, lang }: DossierExportPanelProps) {
  const t = useT();
  const tList = useTList();
  const pretty = prettyPlate(plate.toUpperCase());
  const [lite, setLite] = useState<AiAnalysisV2 | null>(null);
  const [deep, setDeep] = useState<AiAnalysisV2 | null>(null);
  const [liteLoading, setLiteLoading] = useState(true);
  const [deepLoading, setDeepLoading] = useState(false);
  // "resuming" = the user triggered a deep analysis, then left/refreshed before
  // it finished; on return we poll the cache until the server's result lands.
  const [resuming, setResuming] = useState(false);
  const [deepErr, setDeepErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const deepBusy = deepLoading || resuming;

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    setLiteLoading(true);
    setDeep(null);
    setDeepErr(null);
    setResuming(false);

    getAiAnalysisV2(plate, lang, false, ctrl.signal)
      .then(setLite)
      .catch(() => setLite(null))
      .finally(() => setLiteLoading(false));

    // Cache-only peek: surface a deep analysis this user already ran (here or in
    // chat) - no credit is charged on a peek. If it isn't ready yet but a recent
    // "pending" marker exists (they triggered it, then refreshed), poll until
    // the server finishes writing the result so it returns to the page.
    getAiAnalysisV2(plate, lang, true, ctrl.signal, true)
      .then((d) => {
        if (cancelled) return;
        if (d.deepAvailable && d.summary) {
          setDeep(d);
          clearDeepPending(plate);
          return;
        }
        if (!isDeepPending(plate)) return;
        setResuming(true);
        let attempts = 0;
        pollTimer = setInterval(async () => {
          if (cancelled) return;
          attempts += 1;
          try {
            const p = await getAiAnalysisV2(plate, lang, true, undefined, true);
            if (!cancelled && p.deepAvailable && p.summary) {
              setDeep(p);
              setResuming(false);
              clearDeepPending(plate);
              clearInterval(pollTimer);
            }
          } catch {
            /* transient - keep polling */
          }
          if (attempts >= DEEP_POLL_MAX) {
            setResuming(false);
            clearDeepPending(plate);
            clearInterval(pollTimer);
          }
        }, DEEP_POLL_MS);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      ctrl.abort();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [plate, lang]);

  async function onRequestDeep() {
    setDeepLoading(true);
    setDeepErr(null);
    // Mark before the request so a refresh mid-generation knows to resume -
    // the server completes and caches the result even if this tab goes away.
    markDeepPending(plate);
    try {
      const d = await getAiAnalysisV2(plate, lang, true);
      if (d.tier === "needs_upgrade") {
        setDeepErr(t("voertuig.export.needsUpgrade"));
        setDeep(null);
      } else {
        setDeep(d);
      }
      clearDeepPending(plate);
    } catch (err) {
      setDeepErr(err instanceof Error ? err.message : t("voertuig.export.deepError"));
      clearDeepPending(plate);
    } finally {
      setDeepLoading(false);
    }
  }

  function onExportPdf() {
    setExportBusy(true);
    try {
      const labels = labelsFromT(t, tList);
      const html = buildDossierExportHtml(plate, detail, labels, t, lang, lite, deep);
      printDossierExport(html);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section className="card dossier-export-panel" aria-labelledby="dossier-export-title">
      <header className="dossier-export-head">
        <h2 id="dossier-export-title">{t("voertuig.export.panelTitle", { plate: pretty })}</h2>
        <p className="dossier-export-lead">{t("voertuig.export.panelLead")}</p>
      </header>

      <div className="dossier-export-actions">
        <button
          type="button"
          className="primary"
          onClick={onExportPdf}
          disabled={exportBusy || liteLoading}
        >
          {exportBusy ? t("voertuig.export.exporting") : t("voertuig.export.exportPdf")}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => void onRequestDeep()}
          disabled={deepBusy || Boolean(deep?.summary)}
        >
          {deepBusy
            ? t("voertuig.export.deepLoading")
            : deep?.summary
              ? t("voertuig.export.deepReady")
              : t("voertuig.export.deepCta")}
        </button>
      </div>

      {deepBusy && (
        <p className="dossier-export-progress" role="status" aria-busy="true">
          <span className="dossier-spinner" aria-hidden="true" />
          {resuming
            ? t("voertuig.export.deepResuming")
            : t("voertuig.export.deepProgress")}
        </p>
      )}

      {liteLoading && (
        <p className="dossier-export-muted">{t("voertuig.lite.loading")}</p>
      )}
      {!liteLoading && lite?.summary && (
        <div className="dossier-export-preview">
          <span className="badge badge-ai">{t("voertuig.lite.badge")}</span>
          <p>{lite.summary}</p>
        </div>
      )}
      {deep?.summary && (
        <div className="dossier-export-preview dossier-export-preview-deep">
          <span className="badge badge-ai">{t("voertuig.export.badgeDeep")}</span>
          <p>{deep.summary}</p>
        </div>
      )}
      {deepErr && (
        <p className="dossier-export-error" role="alert">
          {deepErr}{" "}
          <Link to="/prijzen">{t("voertuig.export.buyCredits")}</Link>
        </p>
      )}
      <p className="dossier-export-foot">{t("voertuig.export.pdfHint")}</p>
    </section>
  );
}

// ─── deep-analysis resume markers ───────────────────────────────────
// A deep analysis is generated server-side and cached per user; it completes
// (and debits) even if this tab navigates away. We drop a short-lived marker
// when one is triggered so that, on returning to the page, we poll the cache
// until the result lands instead of showing nothing.
const DEEP_POLL_MS = 3_000;
const DEEP_POLL_MAX = 12; // ~36s ceiling - deep usually finishes in 5-10s
const DEEP_PENDING_TTL_MS = 90_000;

function deepPendingKey(plate: string): string {
  return `acv2.deepPending.${plate.replace(/[\s-]/g, "").toUpperCase()}`;
}
function markDeepPending(plate: string): void {
  try {
    localStorage.setItem(deepPendingKey(plate), String(Date.now()));
  } catch {
    /* storage unavailable - resume is best-effort */
  }
}
function clearDeepPending(plate: string): void {
  try {
    localStorage.removeItem(deepPendingKey(plate));
  } catch {
    /* ignore */
  }
}
function isDeepPending(plate: string): boolean {
  try {
    const ts = localStorage.getItem(deepPendingKey(plate));
    return ts != null && Date.now() - Number(ts) < DEEP_PENDING_TTL_MS;
  } catch {
    return false;
  }
}
