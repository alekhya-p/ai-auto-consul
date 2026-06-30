import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useT } from "../lib/i18n";

/**
 * Pops once when the user hits a daily-limit 429. Single dismissible
 * card with a clear "you've hit today's free X - upgrade for unlimited"
 * message + Buy CTA routed to /prijzen?reason=lookup|ai.
 *
 * Backdrop click + ESC close. Owner page tracks "already shown today"
 * in localStorage so re-renders don't re-pop the same modal.
 */
export function DailyLimitModal({
  feature,
  limit,
  onClose,
}: {
  feature: "rdw_lookup" | "ai_analysis";
  limit: number;
  onClose: () => void;
}) {
  const t = useT();
  const reason = feature === "rdw_lookup" ? "lookup" : "ai";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="daily-limit-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-limit-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="daily-limit-modal">
        <span className="daily-limit-icon" aria-hidden="true">⛔</span>
        <h2 id="daily-limit-title">
          {feature === "rdw_lookup"
            ? t("dailyLimit.rdw.title", { limit })
            : t("dailyLimit.ai.title", { limit })}
        </h2>
        <p>
          {feature === "rdw_lookup"
            ? t("dailyLimit.rdw.body")
            : t("dailyLimit.ai.body")}
        </p>
        <ul className="daily-limit-perks">
          <li>{t("dailyLimit.perks.unlimited")}</li>
          <li>{t("dailyLimit.perks.chat")}</li>
          <li>{t("dailyLimit.perks.fullAi")}</li>
        </ul>
        <div className="daily-limit-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("dailyLimit.dismiss")}
          </button>
          <Link to={`/prijzen?reason=${reason}`} className="primary" onClick={onClose}>
            {t("dailyLimit.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
