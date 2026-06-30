import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { setAnalyticsConsent } from "../lib/analytics";
import { useI18n } from "../lib/i18n";

const KEY = "cookies-consent";

/**
 * Slim bottom banner - one-time strict-necessary acknowledgement. We don't
 * drop tracking cookies (see /cookies), but the AVG/GDPR expectation is
 * still to disclose strictly-necessary localStorage / IndexedDB usage,
 * especially when it persists across sessions (recent-plates list, last
 * dossier cache).
 *
 * Choice persisted to localStorage["cookies-consent"] ∈ {"granted","denied"}.
 * "Denied" is a soft signal - the recent-lookups + 24h dossier cache stop
 * being written (the rest of the app still works fine on every visit).
 */
export function CookieBanner() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    if (stored !== "granted" && stored !== "denied") {
      setOpen(true);
    }
    // Reflect any persisted choice so a returning consented visitor re-enables
    // analytics without re-prompting (the banner won't render for them).
    setAnalyticsConsent(stored === "granted");
  }, []);

  function set(choice: "granted" | "denied") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, choice);
    }
    setAnalyticsConsent(choice === "granted");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <aside className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title">
      <p id="cookie-banner-title">
        {t("cookies.bannerText")}{" "}
        <Link to="/cookies">{t("cookies.bannerLink")}</Link>
      </p>
      <div className="cookie-banner-actions">
        <button type="button" className="ghost" onClick={() => set("denied")}>
          {t("cookies.bannerDeny")}
        </button>
        <button type="button" className="primary" onClick={() => set("granted")}>
          {t("cookies.bannerAccept")}
        </button>
      </div>
    </aside>
  );
}

/** Reads the consent state without mounting the banner. */
export function hasCookieConsent(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(KEY);
  if (stored === "granted") return true;
  if (stored === "denied") return false;
  return null;
}
