import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useT } from "../lib/i18n";
import { isChatFocusRoute } from "../lib/routeFocus";

/**
 * Add-to-home-screen prompt for installable PWAs.
 *
 * Chrome / Edge fire `beforeinstallprompt` once per session when the
 * site qualifies (HTTPS + SW + manifest + sufficient engagement). We
 * capture the event, store it, and render a small bottom-anchored card
 * the second visit onwards (using a localStorage marker) so we don't
 * pop up on someone's first 10 seconds.
 *
 * Safari iOS doesn't fire the event - for Safari we'd need a custom
 * "Tap Share → Add to Home Screen" tutorial; deferred for now.
 *
 * Persists "dismissed" so a user who clicks Not now isn't nagged.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const SEEN_KEY = "pwa:visit-count";
const DISMISSED_KEY = "pwa:install-dismissed";

export function PwaInstallPrompt() {
  const t = useT();
  const { pathname } = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    // Bump visit count; show only from visit 2 onwards.
    try {
      const n = Number(localStorage.getItem(SEEN_KEY) ?? "0") + 1;
      localStorage.setItem(SEEN_KEY, String(n));
      const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
      setEligible(n >= 2 && !dismissed);
    } catch {
      // Private mode / storage blocked - skip.
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function onInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setDeferred(null);
      setEligible(false);
    } else {
      onDismiss();
    }
  }

  function onDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* ignore */ }
    setEligible(false);
    setDeferred(null);
  }

  if (isChatFocusRoute(pathname) || !eligible || !deferred) return null;

  return (
    <aside className="pwa-install" role="region" aria-label={t("pwa.install.label")}>
      <div className="pwa-install-body">
        <strong>{t("pwa.install.title")}</strong>
        <p>{t("pwa.install.subtitle")}</p>
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="ghost" onClick={onDismiss}>
          {t("pwa.install.dismiss")}
        </button>
        <button type="button" className="primary" onClick={onInstall}>
          {t("pwa.install.cta")}
        </button>
      </div>
    </aside>
  );
}
