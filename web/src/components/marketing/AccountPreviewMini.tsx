import { useT } from "../../lib/i18n";

/** Desktop-proportion account hub replica - balance, pass, usage feed. */
export function AccountPreviewMini() {
  const t = useT();
  return (
    <div className="mkt-screen mkt-account">
      <div className="mkt-a-metrics">
        <div className="mkt-a-metric">
          <strong>7</strong>
          <span>{t("account.stats.credits")}</span>
        </div>
        <div className="mkt-a-metric">
          <strong>4</strong>
          <span>{t("account.stats.chatTurns")}</span>
        </div>
      </div>

      <div className="mkt-a-pass">
        <div className="mkt-a-pass-head">{t("marketing.preview.account.packName")}</div>
        <div className="mkt-a-pass-body">
          <div>{t("account.passes.credits")}: 7 / 10</div>
          <div className="mkt-a-bar"><i style={{ width: "70%" }} /></div>
          <div>{t("account.passes.chatTurns")}: 4 / 10</div>
          <div className="mkt-a-bar"><i style={{ width: "40%" }} /></div>
        </div>
      </div>

      <div className="mkt-a-usage">
        <h4>{t("account.usage.title")}</h4>
        <div className="mkt-a-uitem">
          <strong>{t("account.usage.tool.aiAnalysisDeep")}</strong>
          <div className="meta">
            <span>DT-001-K · {t("marketing.preview.account.when3")}</span>
            <span className="debit">−1</span>
          </div>
        </div>
        <div className="mkt-a-uitem">
          <strong>{t("account.usage.tool.chatTurn")}</strong>
          <div className="meta">
            <span>{t("marketing.preview.account.when1")}</span>
            <span className="debit">−1</span>
          </div>
        </div>
        <div className="mkt-a-uitem">
          <strong>{t("account.usage.tool.rdwFetch")}</strong>
          <div className="meta">
            <span>DT-001-K · {t("marketing.preview.account.when2")}</span>
            <span>{t("account.usage.free")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
