import { useEffect, useState } from "react";
import { listPasses } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useT } from "../../lib/i18n";
import { sortPassesFifo } from "../../lib/usageToolLabels";

/**
 * Compact credits + chat-turn strip for the chat header.
 *
 * `refreshKey` is bumped by ChatLayout each time a chat run finishes, so the
 * meter re-reads the pass balances right after a turn debits - otherwise the
 * counts stayed frozen at their mount value until a full page reload.
 */
export function ChatCreditMeter({ refreshKey = 0 }: { refreshKey?: number }) {
  const t = useT();
  const { idToken } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [chatTurns, setChatTurns] = useState<number | null>(null);

  useEffect(() => {
    if (!idToken) {
      setCredits(null);
      setChatTurns(null);
      return;
    }
    let cancelled = false;
    listPasses()
      .then((passes) => {
        if (cancelled) return;
        const active = sortPassesFifo(passes);
        let c = 0;
        let ch = 0;
        for (const p of active) {
          c += p.creditsRemaining;
          ch += p.chatTurnsRemaining;
        }
        setCredits(c);
        setChatTurns(ch);
      })
      .catch(() => {
        if (!cancelled) {
          setCredits(null);
          setChatTurns(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, refreshKey]);

  if (!idToken || credits === null || chatTurns === null) {
    return null;
  }

  return (
    <div className="cv2-credit-meter" aria-label={t("chat.meter.summaryAria", { credits, chatTurns })}>
      <span className="cv2-credit-meter-item">
        <span className="cv2-credit-meter-label">{t("chat.meter.credits")}</span>
        <strong>{credits}</strong>
      </span>
      <span className="cv2-credit-meter-sep" aria-hidden="true">
        ·
      </span>
      <span className="cv2-credit-meter-item">
        <span className="cv2-credit-meter-label">{t("chat.meter.chat")}</span>
        <strong>{chatTurns}</strong>
      </span>
    </div>
  );
}
