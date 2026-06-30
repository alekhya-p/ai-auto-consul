import { useT } from "../../lib/i18n";

/** Replica of the exported PDF, shown as a document on a viewer backdrop. */
export function PdfPreviewMini() {
  const t = useT();
  return (
    <div className="mkt-pdf-stage">
      <div className="mkt-pdf-page">
        <div className="mkt-pdf-top">
          <span className="mkt-pdf-brand">
            <span className="mkt-pdf-mark">AC</span>
            <b>{t("brand")}</b>
          </span>
          <span className="mkt-pdf-doc">{t("voertuig.export.title")}</span>
        </div>

        <div className="mkt-pdf-main">
          <div>
            <p className="mkt-pdf-kicker">{t("voertuig.export.plate")}</p>
            <h1>{t("marketing.preview.dossier.model")}</h1>
            <div className="yr">{t("marketing.preview.dossier.year")}</div>
          </div>
          <span className="mkt-pdf-plate">
            <span className="band">NL</span>
            <span className="reg">DT-001-K</span>
          </span>
        </div>

        <div className="mkt-pdf-sec-head">
          <h2>{t("voertuig.section.algemeen")}</h2>
          <span className="b">{t("voertuig.badge.rdw")}</span>
        </div>
        <div className="mkt-pdf-trow"><span className="k">{t("compare.row.brand")}</span><span>BMW</span></div>
        <div className="mkt-pdf-trow"><span className="k">{t("marketing.preview.dossier.rowColor")}</span><span>{t("marketing.preview.dossier.valColor")}</span></div>
        <div className="mkt-pdf-trow"><span className="k">{t("marketing.preview.dossier.rowNap")}</span><span>{t("marketing.preview.dossier.valNap")}</span></div>
        <div className="mkt-pdf-trow"><span className="k">{t("marketing.preview.dossier.rowRecall")}</span><span>{t("marketing.preview.dossier.valRecall")}</span></div>

        <div className="mkt-pdf-ai">
          <div className="h">
            <h2>{t("voertuig.export.sectionDeep")}</h2>
            <span className="b">{t("voertuig.export.badgeDeep")}</span>
          </div>
          <p>{t("marketing.preview.dossier.aiSnippet")}</p>
        </div>
      </div>
    </div>
  );
}
