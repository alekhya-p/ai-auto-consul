import { useT } from "../../lib/i18n";

/** Desktop-proportion side-by-side compare replica (dummy data). */
export function ComparePreviewMini() {
  const t = useT();
  const rows: Array<{ k: string; a: string; b: string; winA?: boolean; winB?: boolean }> = [
    { k: t("voertuig.export.marketRange"), a: "€22-26k", b: "€19-23k", winB: true },
    { k: t("voertuig.tile.vermogen"), a: "184 hp", b: "150 hp", winA: true },
    { k: t("voertuig.tile.verbruik"), a: "5.8 l", b: "5.1 l", winB: true },
    { k: t("voertuig.tile.apkTot"), a: "Dec 2026", b: "Sep 2025" },
    { k: t("marketing.preview.dossier.rowNap"), a: t("marketing.preview.dossier.valNap"), b: t("marketing.preview.dossier.valNap") },
  ];
  return (
    <div className="mkt-screen mkt-compare">
      <div className="mkt-c-head">
        <div className="mkt-c-h label">
          <div className="mkt-c-title">{t("marketing.preview.compare.title")}</div>
          <div className="mkt-c-sub">{t("marketing.preview.compare.sub")}</div>
        </div>
        <div className="mkt-c-h">
          <span className="mkt-chip" style={{ background: "#ffcb05", color: "#15233b", fontFamily: "var(--font-mono)" }}>
            DT-001-K
          </span>
          <strong>{t("marketing.preview.dossier.model")}</strong>
        </div>
        <div className="mkt-c-h">
          <span className="mkt-chip" style={{ background: "#ffcb05", color: "#15233b", fontFamily: "var(--font-mono)" }}>
            8-KXL-92
          </span>
          <strong>{t("marketing.preview.compare.carB")}</strong>
        </div>
      </div>

      <div className="mkt-c-table">
        {rows.map((r) => (
          <div className="mkt-c-trow" key={r.k}>
            <span className="k">{r.k}</span>
            <span className={`v${r.winA ? " win" : ""}`}>{r.a}{r.winA ? " ✓" : ""}</span>
            <span className={`v${r.winB ? " win" : ""}`}>{r.b}{r.winB ? " ✓" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
