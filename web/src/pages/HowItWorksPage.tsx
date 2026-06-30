import { Link } from "react-router-dom";
import { MarketingProductShowcase } from "../components/marketing/MarketingProductShowcase";
import { useT, useTList } from "../lib/i18n";

/**
 * /hoe-werkt-het - the marketing how-it-works page.
 *
 * Order: hero → 3 steps → red-flag list (the protective-tone proof of
 * value) → free-vs-paid comparison → personas → benefits → CTA.
 */
export function HowItWorksPage() {
  const t = useT();
  const tList = useTList();
  const personas = tList("how.personas.items");
  const benefits = tList("how.benefits.items");
  const redFlags = tList("how.redFlags.items");
  const freeItems = tList("how.comparison.freeColumn.items");
  const paidItems = tList("how.comparison.paidColumn.items");

  return (
    <>
    <article className="how-page">
      <header className="content-hero">
        <p className="eyebrow">{t("nav.how")}</p>
        <h1>{t("how.title")}</h1>
        <p className="lede">{t("how.lede")}</p>
      </header>

      <section className="how-steps-block" aria-label={t("how.title")}>
        <ol>
          <li className="how-step">
            {/* <span className="num">1</span> */}
            <div>
              <h3>{t("how.step1.title")}</h3>
              <p>{t("how.step1.body")}</p>
            </div>
          </li>
          <li className="how-step">
            {/* <span className="num">2</span> */}
            <div>
              <h3>{t("how.step2.title")}</h3>
              <p>{t("how.step2.body")}</p>
            </div>
          </li>
          <li className="how-step">
            {/* <span className="num">3</span> */}
            <div>
              <h3>{t("how.step3.title")}</h3>
              <p>{t("how.step3.body")}</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="how-redflags">
        <h2>{t("how.redFlags.title")}</h2>
        <p className="how-redflags-sub">{t("how.redFlags.subtitle")}</p>
        <ul className="how-redflags-grid">
          {redFlags.map((b, i) => {
            const [title, body] = b.split("|");
            return (
              <li key={i} className="how-redflag">
                {/* <span className="how-redflag-pip" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span> */}
                <div>
                  <strong>{title?.trim()}</strong>
                  <span>{body?.trim()}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="how-comparison">
        <h2>{t("how.comparison.title")}</h2>
        <p className="how-comparison-sub">{t("how.comparison.subtitle")}</p>
        <div className="how-comparison-grid">
          <article className="how-comparison-col">
            <h3>{t("how.comparison.freeColumn.label")}</h3>
            <ul>
              {freeItems.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </article>
          <article className="how-comparison-col how-comparison-col-paid">
            <h3>{t("how.comparison.paidColumn.label")}</h3>
            <ul>
              {paidItems.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="how-personas">
        <h2>{t("how.personas.title")}</h2>
        <div className="how-personas-grid">
          {personas.map((p, i) => {
            const [name, body] = p.split("|");
            return (
              <article key={i} className="how-persona">
                <h3>{name?.trim()}</h3>
                <p>{body?.trim()}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="how-benefits">
        <h2>{t("how.benefits.title")}</h2>
        <ul className="how-benefits-grid">
          {benefits.map((b, i) => {
            const [title, body] = b.split("|");
            return (
              <li key={i} className="how-benefit">
                <strong>{title?.trim()}</strong>
                <span>{body?.trim()}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="how-cta">
        <h2>{t("how.cta.title")}</h2>
        <p>{t("how.cta.body")}</p>
        <div className="how-cta-row">
          <Link to="/" className="primary">{t("how.cta.lookup")}</Link>
          <Link to="/prijzen" className="ghost">{t("how.cta.pricing")}</Link>
        </div>
      </section>
    </article>
    <MarketingProductShowcase />
    </>
  );
}
