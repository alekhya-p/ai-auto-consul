import { useI18n } from "../lib/i18n";
import type { Lang } from "../lib/i18n";

/**
 * Topbar segmented control - `[NL | EN]`. Persists to localStorage via
 * the provider. Keep it visually minimal; this is chrome, not the show.
 */
export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("language.label")}>
      <Btn current={lang} target="nl" setLang={setLang}>NL</Btn>
      <Btn current={lang} target="en" setLang={setLang}>EN</Btn>
    </div>
  );
}

function Btn({
  current,
  target,
  setLang,
  children,
}: {
  current: Lang;
  target: Lang;
  setLang: (l: Lang) => void;
  children: React.ReactNode;
}) {
  const active = current === target;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={active ? "active" : ""}
      onClick={() => setLang(target)}
    >
      {children}
    </button>
  );
}
