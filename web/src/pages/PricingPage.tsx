import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requireEmailVerification, useAuth } from "../lib/auth";
import { useI18n, useT } from "../lib/i18n";
import { createCheckoutSession } from "../lib/api";
import { PACKS, type PackId } from "../lib/packs";

/**
 * /prijzen (nl) and /pricing (en) - three tier cards rendered from the
 * typed PACKS config. Buy buttons require a signed-in user; signed-out
 * visitors are routed through /sign-up with the next-param preserved so
 * they land back here, then click Buy again.
 *
 * Failure modes:
 *   - signed-out  → redirect to /sign-up?next=…
 *   - 502 from /v1/passes/checkout → inline error per-card
 *   - Stripe redirect cancelled    → user lands on /dashboard?paid=cancel
 */
export function PricingPage() {
  const t = useT();
  const { lang } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busyId, setBusyId] = useState<PackId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const reason = params.get("reason"); // chat | compare | ai | lookup | credits | null
  const reasonKey = reason && ["chat", "compare", "ai", "lookup", "credits"].includes(reason)
    ? `pricing.reason.${reason}`
    : null;
  const preselected = params.get("pack") as PackId | null;
  const preselectedPack = preselected && PACKS.some((p) => p.id === preselected) ? preselected : null;
  const preselectedRef = useRef<HTMLElement | null>(null);

  // Scroll the preselected tier into view on first mount. Smooth, but
  // capped to "nearest" so we don't yank the page if it's already visible.
  useEffect(() => {
    if (preselectedPack && preselectedRef.current) {
      preselectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [preselectedPack]);

  async function onBuy(packId: PackId) {
    setError(null);
    if (!auth.user) {
      const next = encodeURIComponent("/prijzen");
      navigate(`/sign-up?next=${next}`);
      return;
    }
    if (requireEmailVerification() && !auth.user.emailVerified) {
      setError(t("pricing.errors.verifyEmailFirst"));
      return;
    }
    setBusyId(packId);
    try {
      const { sessionUrl } = await createCheckoutSession({
        pack: packId,
        // Bare base URL - agent appends ?paid=ok|cancel.
        returnTo: window.location.origin + "/dashboard",
        lang,
      });
      window.location.href = sessionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pricing.errors.unknown"));
      setBusyId(null);
    }
  }

  const faqKeys = ["refund", "expiry", "tax", "cancel", "data"];

  return (
    <article className="pricing">
      <header className="pricing-hero">
        <p className="eyebrow">{t("pricing.eyebrow")}</p>
        {reasonKey && (
          <p className="pricing-reason" role="status">{t(reasonKey)}</p>
        )}
        <h1>{t("pricing.title")}</h1>
        <p className="lede">{t("pricing.subtitle")}</p>
      </header>

      <section className="pricing-tiers" aria-label={t("pricing.tiers")}>
        {PACKS.map((p) => {
          const isBusy = busyId === p.id;
          const isPreselected = preselectedPack === p.id;
          return (
            <article
              key={p.id}
              ref={isPreselected ? preselectedRef : null}
              className={`pricing-card${p.highlight ? " highlight" : ""}${isPreselected ? " preselected" : ""}`}
            >
              {p.highlight && (
                <span className="pricing-badge">{t("pricing.popular")}</span>
              )}
              <h2>{t(`pricing.pack.${p.id}.name`)}</h2>
              <p className="pricing-price">{p.price}</p>
              {p.saving && (
                <p className="pricing-saving">{t("pricing.saving", { amount: p.saving })}</p>
              )}
              <ul className="pricing-features">
                <li>{t("pricing.features.credits", { n: p.credits })}</li>
                <li>{t("pricing.features.chatTurns", { n: p.chatTurns })}</li>
                <li>{t("pricing.features.validity", { n: p.validityDays })}</li>
                <li>{t(`pricing.pack.${p.id}.audience`)}</li>
              </ul>
              <button
                type="button"
                className="primary"
                onClick={() => onBuy(p.id)}
                disabled={isBusy}
              >
                {isBusy ? t("pricing.buying") : t("pricing.buy")}
              </button>
            </article>
          );
        })}
      </section>

      {error && <p className="pricing-error" role="alert">{error}</p>}

      <section className="pricing-credits-explainer">
        <h2>{t("pricing.creditsTable.title")}</h2>
        <p>{t("pricing.creditsTable.intro")}</p>
        <table>
          <thead>
            <tr>
              <th>{t("pricing.creditsTable.tool")}</th>
              <th>{t("pricing.creditsTable.cost")}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>{t("pricing.creditsTable.rdw")}</td><td>0</td></tr>
            <tr><td>{t("pricing.creditsTable.aiAnalysis")}</td><td>1</td></tr>
            <tr><td>{t("pricing.creditsTable.autotelex")} <Soon t={t} /></td><td>1</td></tr>
            <tr><td>{t("pricing.creditsTable.vin")} <Soon t={t} /></td><td>1</td></tr>
            <tr><td>{t("pricing.creditsTable.pdf")} <Soon t={t} /></td><td>1</td></tr>
            <tr><td>{t("pricing.creditsTable.vision")} <Soon t={t} /></td><td>1</td></tr>
            <tr><td>{t("pricing.creditsTable.tco")} <Soon t={t} /></td><td>0</td></tr>
            <tr><td>{t("pricing.creditsTable.chat")}</td><td>{t("pricing.creditsTable.chatNote")}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="pricing-trust" aria-label={t("pricing.trust.label")}>
        <div><LockIcon /><span>{t("pricing.trust.stripe")}</span></div>
        <div><RefundIcon /><span>{t("pricing.trust.refund")}</span></div>
        <div><FlagIcon /><span>{t("pricing.trust.nl")}</span></div>
      </section>

      <section className="pricing-free-tier">
        <h2>{t("pricing.freeTier.title")}</h2>
        <p>{t("pricing.freeTier.body")}</p>
      </section>

      <section className="pricing-faq">
        <h2>{t("pricing.faq.title")}</h2>
        <div className="pricing-faq-list">
          {faqKeys.map((key, i) => (
            <details
              key={key}
              open={openFaq === i}
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) setOpenFaq(i);
                else if (openFaq === i) setOpenFaq(null);
              }}
            >
              <summary>{t(`pricing.faq.q.${key}`)}</summary>
              <p>{t(`pricing.faq.a.${key}`)}</p>
            </details>
          ))}
        </div>
      </section>
    </article>
  );
}

/** "coming soon" badge for credit-table tools not yet wired in agent-v2. */
function Soon({ t }: { t: (key: string) => string }) {
  return <span className="badge-soon">{t("pricing.creditsTable.comingSoon")}</span>;
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function RefundIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21V4h13l-2 4 2 4H4" />
      <path d="M4 4v17" />
    </svg>
  );
}
