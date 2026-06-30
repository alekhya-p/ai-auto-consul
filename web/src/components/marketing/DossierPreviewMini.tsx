import { NlPlate } from "../NlPlate";
import { useT } from "../../lib/i18n";

/**
 * Dossier replica for the marketing preview. Uses real dossier markup/classes.
 */
export function DossierPreviewMini() {
  const t = useT();
  const L = (k: string) => t(`voertuig.labels.${k}`);
  return (
    <div className="voertuig-page mkt-dossier">
      <header className="hero-card">
        <div className="hero-card-top">
          <NlPlate value="DT001K" size="lg" />
          <div className="hero-card-title">
            <strong>{t("marketing.preview.dossier.model")}</strong>
            <span className="muted"> · {t("marketing.preview.dossier.year")}</span>
          </div>
        </div>
        <ul className="hero-tiles">
          <li className="tile">
            <div className="tile-label">{t("voertuig.tile.brandstof")}</div>
            <div className="tile-value">{t("marketing.preview.dossier.fuel")}</div>
          </li>
          <li className="tile">
            <div className="tile-label">{t("voertuig.tile.vermogen")}</div>
            <div className="tile-value">{t("marketing.preview.dossier.power")}</div>
          </li>
          <li className="tile">
            <div className="tile-label">{t("voertuig.tile.verbruik")}</div>
            <div className="tile-value">{t("marketing.preview.dossier.consumption")}</div>
          </li>
          <li className="tile ok">
            <div className="tile-label">{t("voertuig.tile.apkTot")}</div>
            <div className="tile-value">{t("marketing.preview.dossier.apk")}</div>
          </li>
        </ul>
      </header>

      <section className="card dossier-lite-analysis">
        <header className="dossier-lite-head">
          <h2>{t("marketing.preview.dossier.aiTitle")}</h2>
          <span className="badge badge-ai">{t("voertuig.lite.badge")}</span>
        </header>
        <p className="dossier-lite-summary">{t("marketing.preview.dossier.aiSnippet")}</p>
      </section>

      <h2 className="rdw-supporting-headline">
        {t("voertuig.section.rdwSupporting")}{" "}
        <span className="badge badge-rdw">{t("voertuig.badge.rdw")}</span>
      </h2>

      <section className="card">
        <h2>{t("voertuig.section.algemeen")}</h2>
        <dl className="grid">
          <dt>{L("merk")}</dt><dd>BMW</dd>
          <dt>{L("model")}</dt><dd>320i</dd>
          <dt>{L("voertuigsoort")}</dt><dd>{t("marketing.preview.dossier.valType")}</dd>
          <dt>{L("kleur")}</dt><dd>{t("marketing.preview.dossier.valColor")}</dd>
          <dt>{L("aantalZitplaatsen")}</dt><dd>5</dd>
          <dt>{L("datumEersteToelating")}</dt><dd>21-03-2019</dd>
        </dl>
      </section>

      <section className="card">
        <h2>{t("voertuig.section.status")}</h2>
        <dl className="grid">
          <dt>{L("apkGeldigTot")}</dt><dd><span className="ok">{t("marketing.preview.dossier.apk")} ✓</span></dd>
          <dt>{L("openstaandeTerugroepactie")}</dt><dd><span className="ok">{t("marketing.preview.dossier.valRecall")}</span></dd>
          <dt>{L("wokStatus")}</dt><dd><span className="ok">{t("marketing.preview.dossier.valWok")}</span></dd>
          <dt>{L("tellerstandoordeel")}</dt><dd>{t("marketing.preview.dossier.valNap")}</dd>
        </dl>
      </section>
    </div>
  );
}
