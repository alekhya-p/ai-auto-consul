import { useT } from "../lib/i18n";

/**
 * One-paragraph "what's in this section?" collapse. Lives just under a
 * section card's <h2>. Uses native <details> so it works without JS,
 * is accessible by default, and animates trivially with CSS.
 */
export function SectionExplainer({ textKey }: { textKey: string }) {
  const t = useT();
  return (
    <details className="section-explainer">
      <summary>{t("voertuig.explainer.toggle")}</summary>
      <p>{t(textKey)}</p>
    </details>
  );
}
