import { useEffect, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { useT } from "../../lib/i18n";
import "./chat-v2.css";

interface UpgradePromptProps {
  lang: "nl" | "en";
  upgradeUrl: string;
}

/**
 * In-chat conversion when quota blocks the run (HTTP 429). On narrow viewports
 * this renders as a bottom sheet so the CTA stays thumb-reachable.
 */
export function UpgradePrompt({ lang: _lang, upgradeUrl }: UpgradePromptProps) {
  const t = useT();
  const [mobileSheet, setMobileSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setMobileSheet(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const body = (
    <>
      <div className="cv2-upgrade-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#7c3aed" }}>
          <path d="M12 3l1.8 5.2H19l-4.6 3.3 1.8 5.2L12 14l-4.2 2.7 1.8-5.2L5 8.2h5.2z" />
          <path d="M19 16l.6 1.8L21.5 19l-1.9.6L19 21.5l-.6-1.9L16.5 19l1.9-.6z" />
        </svg>
      </div>
      <div className="cv2-upgrade-text">
        <strong className="cv2-upgrade-title">{t("chat.upgrade.turnsTitle")}</strong>
        <p className="cv2-upgrade-body">{t("chat.upgrade.turnsBody")}</p>
      </div>
      <a className="btn btn-primary cv2-upgrade-cta" href={upgradeUrl}>
        {t("chat.upgrade.turnsCta")}
      </a>
    </>
  );

  if (mobileSheet) {
    return (
      <BottomSheet ariaLabel={t("chat.upgrade.turnsTitle")}>
        <div className="cv2-upgrade-prompt cv2-upgrade-prompt--sheet" role="status">
          {body}
        </div>
      </BottomSheet>
    );
  }

  return (
    <div className="cv2-upgrade-prompt" role="status">
      {body}
    </div>
  );
}
