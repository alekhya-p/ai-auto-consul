import { useT } from "../../lib/i18n";

/** Desktop-proportion AI chat replica for the marketing preview. */
export function ChatPreviewMini() {
  const t = useT();
  return (
    <div className="mkt-chat-screen">
      <div className="mkt-chat-top">
        <span className="ttl">{t("marketing.preview.chat.plateTitle")}</span>
        <span className="mkt-chat-meter">
          <strong>7</strong> {t("chat.meter.credits")} · <strong>4</strong> {t("chat.meter.chat")}
        </span>
      </div>

      <div className="mkt-chat-body">
        <div className="mkt-bubble user">{t("marketing.preview.chat.userMsg")}</div>
        <div className="mkt-bubble agent">
          <p>{t("marketing.preview.chat.agentLead")}</p>
          <div className="mkt-chat-acard">
            <div className="ah">
              <span className="mkt-chip" style={{ background: "#ffcb05", color: "#15233b", fontFamily: "var(--font-mono)" }}>
                DT-001-K
              </span>
              <span>{t("marketing.preview.dossier.model")}</span>
            </div>
            <div className="ab">
              <span className="mkt-chip ok">{t("marketing.preview.chat.badgeApk")}</span>
              <span className="mkt-chip ok">{t("marketing.preview.chat.badgeRecall")}</span>
              <span className="mkt-chip warn">{t("marketing.preview.chat.badgeNap")}</span>
            </div>
          </div>
          <p style={{ marginBottom: 0 }}>{t("marketing.preview.chat.agentTail")}</p>
        </div>
      </div>

      <div className="mkt-chat-foot">
        <span className="fake">{t("chat.composer.placeholder")}</span>
        <span className="send" aria-hidden="true">↑</span>
      </div>
    </div>
  );
}
