import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import nl from "../i18n/nl.json";
import en from "../i18n/en.json";

/**
 * Lightweight i18n - hand-rolled to keep the bundle thin. Two languages,
 * ~70 keys; pulling in `react-i18next` (60+KB) for this scale would be
 * overkill. Migrate to i18next when we add a third language or rich
 * messages.
 *
 * Persistence: localStorage["lang"] is "nl" or "en". Default is Dutch.
 * The provider also syncs <html lang> for screen readers.
 */

export type Lang = "nl" | "en";

const DICTS: Record<Lang, unknown> = { nl, en };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "nl";
  // 1. URL query param wins - lets you share `?lang=en` links and gives
  //    automated tests a way in without poking localStorage.
  try {
    const fromQs = new URLSearchParams(window.location.search).get("lang");
    if (fromQs === "nl" || fromQs === "en") return fromQs;
  } catch {
    /* fall through */
  }
  // 2. Persisted choice from a previous visit.
  try {
    const stored = window.localStorage?.getItem?.("lang");
    if (stored === "nl" || stored === "en") return stored;
  } catch {
    /* fall through to default */
  }
  return "nl";
}

/** Resolves a dot-separated key against a nested dictionary. */
function lookup(dict: unknown, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? `{${k}}` : String(v);
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage?.setItem?.("lang", lang);
      } catch {
        /* ignore - storage may be unavailable */
      }
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = DICTS[lang];
      const found = lookup(dict, key);
      if (typeof found !== "string") {
        // Fallback to NL if a key is missing from EN - better than
        // returning the literal `key` string and leaking infra into UI.
        const fallback = lookup(DICTS.nl, key);
        if (typeof fallback !== "string") return key;
        return vars ? interpolate(fallback, vars) : fallback;
      }
      return vars ? interpolate(found, vars) : found;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <LanguageProvider>");
  }
  return ctx;
}

/** Sugar for the common case - `const t = useT()` then `{t('hero.title')}`. */
export function useT() {
  return useI18n().t;
}

/**
 * Read a string list (e.g. `voertuig.ai.lockedBullets`) - handy for
 * keys whose value is intentionally an array of strings, like bullet
 * lists. Returns [] when the key resolves to anything other than a list.
 */
export function useTList(): (key: string) => string[] {
  const { lang } = useI18n();
  return useCallback(
    (key: string) => {
      const v = lookup(DICTS[lang], key);
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
      const fallback = lookup(DICTS.nl, key);
      if (Array.isArray(fallback) && fallback.every((x) => typeof x === "string")) {
        return fallback as string[];
      }
      return [];
    },
    [lang]
  );
}
