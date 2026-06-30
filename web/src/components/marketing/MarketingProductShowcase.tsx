import { useT } from "../../lib/i18n";
import { AccountPreviewMini } from "./AccountPreviewMini";
import { ChatPreviewMini } from "./ChatPreviewMini";
import { ComparePreviewMini } from "./ComparePreviewMini";
import { DossierPreviewMini } from "./DossierPreviewMini";
import { MktWindow, ScaledStage } from "./MktWindow";
import { PdfPreviewMini } from "./PdfPreviewMini";
import "./marketing-previews.css";

/**
 * Landing-page product previews: each surface at desktop size, scaled down
 * inside a minimal app window. Featured dossier on top; rest in a 2×2 grid.
 */
export function MarketingProductShowcase() {
  const t = useT();

  return (
    <section className="mkt-showcase" aria-labelledby="mkt-showcase-title">
      <div className="mkt-showcase-inner">
        <header className="mkt-showcase-head">
          <p className="eyebrow">{t("marketing.showcase.eyebrow")}</p>
          <h2 id="mkt-showcase-title">{t("marketing.showcase.title")}</h2>
          <p>{t("marketing.showcase.subtitle")}</p>
        </header>

        <div className="mkt-showcase-grid">
          <article className="mkt-showcase-item is-featured">
            <MktWindow title={t("marketing.showcase.dossier.label")}>
              <ScaledStage width={1120} height={700}>
                <DossierPreviewMini />
              </ScaledStage>
            </MktWindow>
            <div className="mkt-showcase-caption">
              <h3>{t("marketing.showcase.dossier.title")}</h3>
              <p>{t("marketing.showcase.dossier.body")}</p>
            </div>
          </article>

          <article className="mkt-showcase-item">
            <MktWindow title={t("marketing.showcase.compare.label")}>
              <ScaledStage width={1120} height={720}>
                <ComparePreviewMini />
              </ScaledStage>
            </MktWindow>
            <div className="mkt-showcase-caption">
              <h3>{t("marketing.showcase.compare.title")}</h3>
              <p>{t("marketing.showcase.compare.body")}</p>
            </div>
          </article>

          <article className="mkt-showcase-item">
            <MktWindow title={t("marketing.showcase.chat.label")}>
              <ScaledStage width={1120} height={720}>
                <ChatPreviewMini />
              </ScaledStage>
            </MktWindow>
            <div className="mkt-showcase-caption">
              <h3>{t("marketing.showcase.chat.title")}</h3>
              <p>{t("marketing.showcase.chat.body")}</p>
            </div>
          </article>

          <article className="mkt-showcase-item">
            <MktWindow title={t("marketing.showcase.pdf.label")} tone="pdf">
              <ScaledStage width={1120} height={720}>
                <PdfPreviewMini />
              </ScaledStage>
            </MktWindow>
            <div className="mkt-showcase-caption">
              <h3>{t("marketing.showcase.pdf.title")}</h3>
              <p>{t("marketing.showcase.pdf.body")}</p>
            </div>
          </article>

          <article className="mkt-showcase-item">
            <MktWindow title={t("marketing.showcase.account.label")}>
              <ScaledStage width={1120} height={720}>
                <AccountPreviewMini />
              </ScaledStage>
            </MktWindow>
            <div className="mkt-showcase-caption">
              <h3>{t("marketing.showcase.account.title")}</h3>
              <p>{t("marketing.showcase.account.body")}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
