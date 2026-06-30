import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BottomSheet } from "./BottomSheet";
import { scopedLocalKey } from "../lib/userScope";
import { useT } from "../lib/i18n";

const STORAGE_NAME = "welcome_onboarding_seen";

interface WelcomeOnboardingSheetProps {
  /** Set by sign-up flow so we only show once after registration. */
  trigger?: boolean;
}

function WelcomeContent({
  onDismiss,
  t,
}: {
  onDismiss: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="welcome-sheet">
      <p className="welcome-sheet-eyebrow">{t("onboarding.welcome.eyebrow")}</p>
      <h2 id="welcome-modal-title">{t("onboarding.welcome.title")}</h2>
      <p>{t("onboarding.welcome.body")}</p>
      <ul className="welcome-sheet-list">
        <li>{t("onboarding.welcome.perk1")}</li>
        <li>{t("onboarding.welcome.perk2")}</li>
        <li>{t("onboarding.welcome.perk3")}</li>
      </ul>
      <div className="welcome-sheet-actions">
        <Link to="/v2/chat" className="primary" onClick={onDismiss}>
          {t("onboarding.welcome.ctaChat")}
        </Link>
        <button type="button" className="ghost" onClick={onDismiss}>
          {t("onboarding.welcome.dismiss")}
        </button>
      </div>
    </div>
  );
}

/**
 * One-time welcome after first sign-up. Bottom sheet on mobile; centered
 * dialog on desktop (avoids the chat-style bottom sheet on dashboard).
 */
export function WelcomeOnboardingSheet({ trigger }: WelcomeOnboardingSheetProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!trigger) return;
    const key = scopedLocalKey(STORAGE_NAME);
    if (localStorage.getItem(key) === "1") return;
    setOpen(true);
  }, [trigger]);

  function dismiss() {
    try {
      localStorage.setItem(scopedLocalKey(STORAGE_NAME), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  if (!open) return null;

  if (isMobile) {
    return (
      <BottomSheet ariaLabel={t("onboarding.welcome.title")} onClose={dismiss}>
        <WelcomeContent onDismiss={dismiss} t={t} />
      </BottomSheet>
    );
  }

  return (
    <div
      className="welcome-modal-backdrop"
      role="presentation"
      onClick={dismiss}
    >
      <div
        className="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <WelcomeContent onDismiss={dismiss} t={t} />
      </div>
    </div>
  );
}
