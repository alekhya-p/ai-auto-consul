import { useT } from "../lib/i18n";
import { PlateLookupForm } from "./PlateLookupForm";

export function HeroLookup() {
  const t = useT();

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">{t("hero.eyebrow")}</p>
        <h1>
          {t("hero.titleA")} <em>{t("hero.titleEm")}</em> {t("hero.titleB")}
        </h1>
        <p className="subtitle">{t("hero.subtitle")}</p>

        <PlateLookupForm variant="hero" />
      </div>

      <aside className="hero-features" aria-label={t("hero.featuresLabel")}>
        <ul>
          <li>
            <span className="icon" aria-hidden="true"><DatabaseIcon /></span>
            <span className="copy">
              <strong>{t("hero.features.rdw.title")}</strong>
              <span>{t("hero.features.rdw.body")}</span>
            </span>
          </li>
          <li>
            <span className="icon" aria-hidden="true"><SparkleIcon /></span>
            <span className="copy">
              <strong>{t("hero.features.ai.title")}</strong>
              <span>{t("hero.features.ai.body")}</span>
            </span>
          </li>
          <li>
            <span className="icon" aria-hidden="true"><LockIcon /></span>
            <span className="copy">
              <strong>{t("hero.features.privacy.title")}</strong>
              <span>{t("hero.features.privacy.body")}</span>
            </span>
          </li>
        </ul>
      </aside>
    </section>
  );
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
