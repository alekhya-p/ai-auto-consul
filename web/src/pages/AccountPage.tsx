import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createPortalSession,
  deleteAccount,
  listCreditHistory,
  listPasses,
  type CreditEventView,
  type PassView,
} from "../lib/api";
import { resendVerificationEmail, signOutCurrent, useAuth } from "../lib/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { useI18n, useT } from "../lib/i18n";
import { AccountChatThreads } from "../features/account/AccountChatThreads";
import { sortPassesFifo, usageToolLabel } from "../lib/usageToolLabels";

/**
 * /account - passes, billing portal link, credit history, chat threads.
 */
export function AccountPage() {
  const t = useT();
  const auth = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const [passes, setPasses] = useState<PassView[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [history, setHistory] = useState<CreditEventView[] | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalErr, setPortalErr] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState<"resend" | "refresh" | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<"sent" | "error" | "stillUnverified" | null>(null);
  const emailVerified = Boolean(auth.user?.emailVerified);

  async function onResendVerify() {
    setVerifyBusy("resend");
    setVerifyMsg(null);
    try {
      await resendVerificationEmail();
      setVerifyMsg("sent");
    } catch {
      setVerifyMsg("error");
    } finally {
      setVerifyBusy(null);
    }
  }

  /**
   * Pull the latest emailVerified state from Firebase Auth. Useful right
   * after the user clicked the verification link in their email - the
   * SDK doesn't auto-poll, so without this they'd have to sign out + in.
   */
  async function onRefreshVerified() {
    const fb = getFirebaseAuth();
    if (!fb?.currentUser) return;
    setVerifyBusy("refresh");
    setVerifyMsg(null);
    try {
      await fb.currentUser.reload();
      await fb.currentUser.getIdToken(true);
      if (!fb.currentUser.emailVerified) setVerifyMsg("stillUnverified");
    } catch {
      setVerifyMsg("error");
    } finally {
      setVerifyBusy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listPasses()
      .then((p) => { if (!cancelled) setPasses(p); })
      .catch((err: unknown) => {
        if (!cancelled) setLoadErr(err instanceof Error ? err.message : "load_failed");
      });
    listCreditHistory()
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, []);

  async function onPortal() {
    setPortalBusy(true);
    setPortalErr(null);
    try {
      const { sessionUrl } = await createPortalSession(window.location.origin + "/account");
      window.location.href = sessionUrl;
    } catch (err) {
      setPortalErr(err instanceof Error ? err.message : t("account.portal.error"));
      setPortalBusy(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try { await signOutCurrent(); } finally { setSigningOut(false); }
  }

  async function onConfirmDelete(e: FormEvent) {
    e.preventDefault();
    if (deleteConfirmEmail.trim().toLowerCase() !== (auth.user?.email ?? "").toLowerCase()) {
      setDeleteErr(t("account.delete.mismatch"));
      return;
    }
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteAccount();
      // Force sign-out client-side; the server already revoked the
      // refresh token so even without this we'd be evicted on next
      // request. Doing it explicitly avoids a confusing "you're still
      // signed in" flash.
      await signOutCurrent().catch(() => {});
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : t("account.delete.error"));
      setDeleting(false);
    }
  }

  const email = auth.user?.email ?? auth.user?.displayName ?? auth.user?.uid.slice(0, 8) ?? "";

  // Aggregate stats for the banner at the top: total credits remaining
  // across active passes, total chat turns remaining, total dossiers
  // saved (counted via the credit history later - for now just passes).
  const stats = (() => {
    if (!passes || passes.length === 0) return null;
    let credits = 0;
    let chatTurns = 0;
    for (const p of passes) {
      credits += p.creditsRemaining;
      chatTurns += p.chatTurnsRemaining;
    }
    return { credits, chatTurns, activePasses: passes.length };
  })();

  return (
    <article className="account account-v2">
      <header className="account-v2-hero">
        <p className="eyebrow">{t("account.eyebrow")}</p>
        <h1>{t("account.title")}</h1>
        <p className="account-v2-lead">{t("account.lead")}</p>
      </header>

      <section className="account-v2-balance" aria-labelledby="account-balance-title">
        <h2 id="account-balance-title">{t("account.balance.title")}</h2>
        {stats ? (
          <div className="account-v2-metrics">
            <div className="account-v2-metric">
              <span className="account-v2-metric-value">{stats.credits}</span>
              <span className="account-v2-metric-label">{t("account.stats.credits")}</span>
              <span className="account-v2-metric-hint">{t("account.balance.creditsHint")}</span>
            </div>
            <div className="account-v2-metric">
              <span className="account-v2-metric-value">{stats.chatTurns}</span>
              <span className="account-v2-metric-label">{t("account.stats.chatTurns")}</span>
              <span className="account-v2-metric-hint">{t("account.balance.chatHint")}</span>
            </div>
          </div>
        ) : (
          <p className="account-v2-balance-empty">{t("account.balance.empty")}</p>
        )}
        <nav className="account-v2-quick" aria-label={t("account.quick.label")}>
          <Link to="/v2/chat" className="account-v2-quick-btn primary">
            {t("account.quick.chat")}
          </Link>
          <Link to="/prijzen" className="account-v2-quick-btn ghost">
            {t("account.quick.pricing")}
          </Link>
          <Link to="/dashboard" className="account-v2-quick-btn ghost">
            {t("account.quick.dashboard")}
          </Link>
        </nav>
      </section>

      <section className="account-v2-block account-passes" id="passes">
        <header className="account-section-head">
          <div>
            <h2>{t("account.passes.title")}</h2>
            <p className="account-v2-block-lead">{t("account.sections.passesLead")}</p>
          </div>
          <Link to="/prijzen" className="account-link">{t("account.passes.buyMore")}</Link>
        </header>
        {loadErr && <p className="account-error" role="alert">{t("account.passes.loadError")}</p>}
        {passes === null && !loadErr && (
          <p className="account-skeleton">{t("account.passes.loading")}</p>
        )}
        {passes !== null && passes.length === 0 && (
          <div className="account-empty">
            <p>{t("account.passes.empty")}</p>
            <Link to="/prijzen" className="primary">{t("account.passes.browse")}</Link>
          </div>
        )}
        {passes && passes.length > 0 && (
          <ul className="account-passes-list">
            {sortPassesFifo(passes).map((p, i) => (
              <PassCard key={p.passId} pass={p} consumesFirst={i === 0} />
            ))}
          </ul>
        )}
      </section>

      <AccountChatThreads />

      <section className="account-v2-block account-usage" id="usage">
        <header className="account-section-head">
          <div>
            <h2>{t("account.usage.title")}</h2>
            <p className="account-v2-block-lead">{t("account.sections.usageLead")}</p>
          </div>
        </header>
        {history === null && (
          <p className="account-skeleton">{t("account.usage.loading")}</p>
        )}
        {history !== null && history.length === 0 && (
          <p className="account-empty">{t("account.usage.empty")}</p>
        )}
        {history && history.length > 0 && (
          <UsageFeed events={history} lang={lang} t={t} />
        )}
      </section>

      <section className="account-v2-block account-v2-settings card" id="settings">
        <h2>{t("account.sections.settings")}</h2>
        <div className="account-v2-profile">
          <div className="account-avatar" aria-hidden="true">
            {email.slice(0, 1).toUpperCase()}
          </div>
          <div className="account-v2-profile-meta">
            <p className="account-email">
              {email}
              <span
                className={`verify-badge ${emailVerified ? "ok" : "warn"}`}
                aria-label={emailVerified ? t("account.verify.ariaVerified") : t("account.verify.ariaUnverified")}
              >
                {emailVerified ? (
                  <>
                    <CheckIcon /> {t("account.verify.verified")}
                  </>
                ) : (
                  <>
                    <DotIcon /> {t("account.verify.unverified")}
                  </>
                )}
              </span>
            </p>
            <p className="account-tier-row">
              <span className={`tier-badge tier-${auth.tier}`}>{auth.tier}</span>
              <span className="account-tier-note">{t(`account.tier.${auth.tier}`)}</span>
            </p>
            {!emailVerified && (
              <div className="account-verify-actions">
                <button
                  type="button"
                  className="ghost small"
                  onClick={onResendVerify}
                  disabled={verifyBusy !== null}
                >
                  {verifyBusy === "resend" ? t("account.verify.sending") : t("account.verify.resend")}
                </button>
                <button
                  type="button"
                  className="ghost small"
                  onClick={onRefreshVerified}
                  disabled={verifyBusy !== null}
                >
                  {verifyBusy === "refresh" ? t("account.verify.refreshing") : t("account.verify.refresh")}
                </button>
                {verifyMsg === "sent" && (
                  <small className="account-verify-msg ok" role="status">{t("account.verify.sent")}</small>
                )}
                {verifyMsg === "stillUnverified" && (
                  <small className="account-verify-msg warn" role="status">{t("account.verify.stillUnverified")}</small>
                )}
                {verifyMsg === "error" && (
                  <small className="account-verify-msg error" role="alert">{t("account.verify.error")}</small>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="account-v2-billing-row">
          <div>
            <h3>{t("account.billing.title")}</h3>
            <p>{t("account.billing.body")}</p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={onPortal}
            disabled={portalBusy}
          >
            {portalBusy ? t("account.billing.opening") : t("account.billing.cta")}
          </button>
          {portalErr && <p className="account-error" role="alert">{portalErr}</p>}
        </div>

        <div className="account-v2-settings-foot">
          <button
            type="button"
            className="ghost"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? "…" : t("account.signOut")}
          </button>
        </div>
      </section>

      <section className="account-v2-block account-danger">
        <h2>{t("account.delete.title")}</h2>
        <p>{t("account.delete.body")}</p>
        <button
          type="button"
          className="danger"
          onClick={() => { setDeleteErr(null); setDeleteConfirmEmail(""); setDeleteModalOpen(true); }}
        >
          {t("account.delete.cta")}
        </button>
      </section>

      {deleteModalOpen && (
        <div
          className="account-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteModalOpen(false); }}
        >
          <form className="account-modal" onSubmit={onConfirmDelete}>
            <h3 id="delete-account-title">{t("account.delete.modalTitle")}</h3>
            <p>{t("account.delete.modalWarning")}</p>
            <ul className="account-delete-bullets">
              <li>{t("account.delete.bullet1")}</li>
              <li>{t("account.delete.bullet2")}</li>
              <li>{t("account.delete.bullet3")}</li>
            </ul>
            <label>
              <span>{t("account.delete.confirmLabel", { email })}</span>
              <input
                type="email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder={email}
                autoComplete="off"
                disabled={deleting}
                required
              />
            </label>
            {deleteErr && <p className="account-error" role="alert">{deleteErr}</p>}
            <div className="account-modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                {t("account.delete.cancel")}
              </button>
              <button
                type="submit"
                className="danger"
                disabled={deleting || deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase()}
              >
                {deleting ? t("account.delete.deleting") : t("account.delete.confirm")}
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}

const USAGE_PAGE_SIZE = 5;

function UsageFeed({
  events,
  lang,
  t,
}: {
  events: CreditEventView[];
  lang: "nl" | "en";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // Render in pages of 5 - the full history can be long and rendering it all
  // at once made the Account page slow to paint.
  const [visible, setVisible] = useState(USAGE_PAGE_SIZE);
  const shown = events.slice(0, visible);
  const remaining = events.length - shown.length;

  return (
    <>
    <ul className="account-usage-feed">
      {shown.map((e) => (
        <li key={e.eventId} className={e.cost > 0 ? "usage-feed-debit" : "usage-feed-free"}>
          <div className="usage-feed-main">
            <span className="usage-feed-tool">{usageToolLabel(e.toolName, t)}</span>
            {e.plateContext && (
              <span className="usage-feed-plate">{e.plateContext}</span>
            )}
          </div>
          <div className="usage-feed-meta">
            <time dateTime={e.timestamp}>{formatWhen(e.timestamp, lang)}</time>
            <span className="usage-feed-cost">
              {e.cost > 0 ? `−${e.cost}` : t("account.usage.free")}
            </span>
            {e.cost > 0 && (
              <span className="usage-feed-balance">
                {t("account.usage.col.balance")}: {e.balanceAfter}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
    {(remaining > 0 || visible > USAGE_PAGE_SIZE) && (
      <div className="account-usage-pager">
        {remaining > 0 && (
          <button
            type="button"
            className="ghost small"
            onClick={() => setVisible((v) => v + USAGE_PAGE_SIZE)}
          >
            {t("account.usage.showMore")} ({remaining})
          </button>
        )}
        {visible > USAGE_PAGE_SIZE && (
          <button
            type="button"
            className="ghost small"
            onClick={() => setVisible(USAGE_PAGE_SIZE)}
          >
            {t("account.usage.showLess")}
          </button>
        )}
      </div>
    )}
    </>
  );
}

function formatWhen(iso: string, lang: "nl" | "en"): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "nl-NL", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

function PassCard({ pass, consumesFirst }: { pass: PassView; consumesFirst?: boolean }) {
  const t = useT();
  const creditsPct = pass.creditsInitial > 0
    ? Math.round((pass.creditsRemaining / pass.creditsInitial) * 100)
    : 0;
  const chatPct = pass.chatTurnsInitial > 0
    ? Math.round((pass.chatTurnsRemaining / pass.chatTurnsInitial) * 100)
    : 0;
  const expires = pass.expiresAt ? new Date(pass.expiresAt) : null;
  const expiresStr = expires
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(expires)
    : "-";
  const daysLeft = expires
    ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 7;

  return (
    <li className={`pass-card pass-card-${pass.pack.toLowerCase()}${consumesFirst ? " pass-card-fifo" : ""}`}>
      <header className="pass-card-head">
        <div>
          <h3>{t(`pricing.pack.${pass.pack}.name`)}</h3>
          {consumesFirst && (
            <span className="pass-fifo-badge">{t("account.passes.consumesFirst")}</span>
          )}
        </div>
        <span className={`pass-badge${expiringSoon ? " warn" : ""}`}>
          {daysLeft === null
            ? t("account.passes.noExpiry")
            : t("account.passes.daysLeft", { n: daysLeft })}
        </span>
      </header>

      <div className="pass-counter">
        <div className="pass-counter-row">
          <span>{t("account.passes.credits")}</span>
          <strong>{pass.creditsRemaining} / {pass.creditsInitial}</strong>
        </div>
        <div className="pass-bar" aria-label={`${creditsPct}% credits remaining`}>
          <span style={{ width: `${creditsPct}%` }} />
        </div>
      </div>

      <div className="pass-counter">
        <div className="pass-counter-row">
          <span>{t("account.passes.chatTurns")}</span>
          <strong>{pass.chatTurnsRemaining} / {pass.chatTurnsInitial}</strong>
        </div>
        <div className="pass-bar" aria-label={`${chatPct}% chat turns remaining`}>
          <span style={{ width: `${chatPct}%` }} />
        </div>
      </div>

      <footer className="pass-meta">
        <span>{t("account.passes.expires", { date: expiresStr })}</span>
      </footer>
    </li>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill="currentColor" />
    </svg>
  );
}
