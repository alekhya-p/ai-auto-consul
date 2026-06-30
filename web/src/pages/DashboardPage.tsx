import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { NlPlate } from "../components/NlPlate";
import { PlateLookupForm } from "../components/PlateLookupForm";
import { WelcomeOnboardingSheet } from "../components/WelcomeOnboardingSheet";
import { deleteSavedDossier, listSavedDossiers } from "../lib/api";
import { requireEmailVerification, resendVerificationEmail, useAuth } from "../lib/auth";
import { brandFor } from "../lib/brandTheme";
import type { BrandTheme } from "../lib/brandTheme";
import { getFirebaseAuth } from "../lib/firebase";
import { useT } from "../lib/i18n";
import { clearRecent, getCached, getRecent, removeRecent } from "../lib/voertuigCache";

interface RecentEntry {
  plate: string;
  merk: string | null;
  model: string | null;
  theme: BrandTheme | null;
}

/**
 * /dashboard - landing for signed-in users. Three blocks:
 *   1. Hero greeting
 *   2. New-analysis lookup card (plate input)
 *   3. Recent dossiers - tiles with brand logo + make/model pulled
 *      from the 24h IndexedDB cache (voertuigCache).
 *
 * Saved dossiers from the API replace the local cache list when available;
 * tile shape stays the same.
 */
export function DashboardPage() {
  const auth = useAuth();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  // Start truthy: the first paint happens before loadRecent() resolves, and
  // for signed-in users that's a network round-trip. Without this flag we'd
  // flash the "no dossiers yet" empty state, then pop the tiles in.
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [paidBanner, setPaidBanner] = useState<"ok" | "cancel" | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [verifyMsg, setVerifyMsg] = useState<"sent" | "error" | null>(null);
  const [welcomeTrigger, setWelcomeTrigger] = useState(false);
  const showVerifyBanner = Boolean(auth.user) && !auth.user?.emailVerified;

  useEffect(() => {
    if (sessionStorage.getItem("ac_just_signed_up") === "1") {
      sessionStorage.removeItem("ac_just_signed_up");
      setWelcomeTrigger(true);
    }
  }, []);

  async function onResendVerify() {
    setVerifyMsg(null);
    try {
      await resendVerificationEmail();
      setVerifyMsg("sent");
    } catch {
      setVerifyMsg("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingRecent(true);
    void loadRecent(auth.user != null)
      .then((entries) => {
        if (!cancelled) setRecent(entries);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecent(false);
      });
    return () => { cancelled = true; };
    // Re-run when sign-in state flips (e.g. after Stripe return).
  }, [auth.user?.uid]);

  // Handle the ?paid=ok|cancel redirect from Stripe Checkout. On ok, force
  // a fresh id-token so the new tier custom claim (set by the webhook) is
  // visible without sign-out. The query param is stripped after handling
  // so reloads don't re-trigger the refresh / banner.
  useEffect(() => {
    const paid = params.get("paid");
    if (paid !== "ok" && paid !== "cancel") return;
    setPaidBanner(paid);
    if (paid === "ok") {
      const fb = getFirebaseAuth();
      void fb?.currentUser?.getIdToken(true).catch(() => {});
    }
    const next = new URLSearchParams(params);
    next.delete("paid");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const name = auth.user?.displayName ?? auth.user?.email?.split("@")[0] ?? "";

  function togglePick(plate: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(plate)) next.delete(plate);
      // Cap at 3. Higher counts would force us to reason about which
      // pack tier covers a 4+ comparison (pro covers 3, power covers 10)
      // and the side-by-side UI gets cramped on desktop too.
      else if (next.size < 3) next.add(plate);
      return next;
    });
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelected(new Set());
  }

  /**
   * Remove a single dossier from the recent list. Signed-in users get the
   * server-side saved dossier deleted too (best-effort); anonymous users
   * only have the local cache to clean. The tile disappears immediately
   * for snappy UX; if the server delete fails we still keep it gone
   * locally - the next listSavedDossiers() call will reconcile.
   */
  async function onRemoveRecent(plate: string) {
    setRecent((r) => r.filter((entry) => entry.plate !== plate));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(plate);
      return next;
    });
    if (auth.user) {
      try { await deleteSavedDossier(plate); } catch { /* keep local removal */ }
    }
    await removeRecent(plate);
  }

  async function onClearAllRecent() {
    if (!window.confirm(t("dashboard.recent.clearConfirm"))) return;
    const plates = recent.map((r) => r.plate);
    setRecent([]);
    setSelected(new Set());
    if (auth.user) {
      // Best-effort parallel deletes; failures don't block the local clear.
      await Promise.allSettled(plates.map((p) => deleteSavedDossier(p)));
    }
    await clearRecent();
  }

  const compareHref = `/compare?plates=${[...selected].join(",")}`;

  return (
    <article className="dashboard">
      <WelcomeOnboardingSheet trigger={welcomeTrigger} />
      {paidBanner === "ok" && (
        <div className="dashboard-banner ok" role="status">
          {t("dashboard.banner.paidOk")}
        </div>
      )}
      {paidBanner === "cancel" && (
        <div className="dashboard-banner cancel" role="status">
          {t("dashboard.banner.paidCancel")}
        </div>
      )}
      {showVerifyBanner && (
        <div className={`dashboard-banner ${requireEmailVerification() ? "warn" : "info"}`} role="status">
          <span>{t("dashboard.banner.verifyEmail", { email: auth.user?.email ?? "" })}</span>
          <button type="button" className="ghost" onClick={onResendVerify}>
            {verifyMsg === "sent" ? t("dashboard.banner.verifyResent") : t("dashboard.banner.verifyResend")}
          </button>
          {verifyMsg === "error" && (
            <small role="alert">{t("dashboard.banner.verifyError")}</small>
          )}
        </div>
      )}
      <header className="dashboard-hero">
        <p className="eyebrow">
          {t("brand")}
          {auth.tier !== "free" && (
            <span className={`tier-badge tier-${auth.tier}`} aria-label={`tier ${auth.tier}`}>
              {auth.tier}
            </span>
          )}
        </p>
        <h1>{t("dashboard.greeting", { name })}</h1>
        <p className="lede">{t("dashboard.subtitle")}</p>
      </header>

      <section className="card dashboard-lookup">
        <h2>{t("dashboard.lookup.title")}</h2>
        <p className="dashboard-lookup-hint">{t("dashboard.lookup.label")}</p>
        <PlateLookupForm variant="compact" showRecents={false} />
      </section>

      <section className="dashboard-recent">
        <header className="dashboard-recent-head">
          <h2>{t("dashboard.recent.title")}</h2>
          <div className="dashboard-recent-actions">
            {recent.length >= 2 && !compareMode && (
              <button
                type="button"
                className="ghost dashboard-compare-toggle"
                onClick={() => setCompareMode(true)}
              >
                {t("dashboard.compare.start")}
              </button>
            )}
            {compareMode && (
              <button type="button" className="ghost" onClick={exitCompareMode}>
                {t("dashboard.compare.cancel")}
              </button>
            )}
            {recent.length > 0 && !compareMode && (
              <button
                type="button"
                className="ghost dashboard-clear-all"
                onClick={onClearAllRecent}
              >
                {t("dashboard.recent.clearAll")}
              </button>
            )}
          </div>
        </header>

        {loadingRecent ? (
          <p className="dashboard-recent-loading" role="status" aria-live="polite">
            <span className="dossier-spinner" aria-hidden="true" />
            {t("dashboard.recent.loading")}
          </p>
        ) : recent.length === 0 ? (
          <p className="dashboard-empty">{t("dashboard.recent.empty")}</p>
        ) : (
          <ul className="dashboard-recent-grid">
            {recent.map((r) => {
              const picked = selected.has(r.plate);
              const tile = (
                <div
                  className={`dashboard-tile${picked ? " picked" : ""}${compareMode ? " selectable" : ""}`}
                >
                  <div
                    className="dashboard-tile-brand"
                    style={r.theme
                      ? { background: r.theme.accent, color: r.theme.ink }
                      : undefined}
                  >
                    {r.theme
                      ? <BrandLogo theme={r.theme} size={24} />
                      : <GenericCarIcon />}
                  </div>
                  <div className="dashboard-tile-body">
                    <NlPlate value={r.plate} size="sm" />
                    <p className="dashboard-tile-model">
                      {r.merk || r.model
                        ? [r.merk, r.model].filter(Boolean).join(" ")
                        : t("dashboard.recent.unknownModel")}
                    </p>
                  </div>
                  {compareMode && (
                    <span className={`dashboard-tile-check${picked ? " on" : ""}`} aria-hidden="true">
                      {picked ? "✓" : ""}
                    </span>
                  )}
                </div>
              );
              return (
                <li key={r.plate} className="dashboard-tile-li">
                  {compareMode ? (
                    <button
                      type="button"
                      className="dashboard-tile-button"
                      onClick={() => togglePick(r.plate)}
                      aria-pressed={picked}
                    >
                      {tile}
                    </button>
                  ) : (
                    <>
                      <Link to={`/voertuig/${r.plate}`} className="dashboard-tile-link">
                        {tile}
                      </Link>
                      <button
                        type="button"
                        className="dashboard-tile-remove"
                        onClick={() => onRemoveRecent(r.plate)}
                        aria-label={t("dashboard.recent.remove", { plate: r.plate })}
                        title={t("dashboard.recent.remove", { plate: r.plate })}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {compareMode && selected.size >= 2 && (
        <div className="dashboard-compare-bar" role="status">
          <span>{t("dashboard.compare.selected", { n: selected.size })}</span>
          <Link to={compareHref} className="primary">
            {t("dashboard.compare.go", { n: selected.size })}
          </Link>
        </div>
      )}
    </article>
  );
}

/**
 * For signed-in users: read the server-side saved list (Firestore) so the
 * dashboard survives cache clears + works across devices. The IndexedDB
 * cache is still used to enrich a single tile when the server didn't
 * record make/model (e.g. an older entry).
 *
 * For signed-out users: this dashboard is RequireAuth-gated, so we don't
 * normally hit this path; the local fallback exists for the "Firebase
 * not configured" dev case.
 */
async function loadRecent(signedIn: boolean): Promise<RecentEntry[]> {
  if (signedIn) {
    try {
      const dossiers = await listSavedDossiers();
      return dossiers.map((d) => ({
        plate: d.plate,
        merk: d.merk,
        model: d.model,
        theme: d.merk ? brandFor(d.merk) : null,
      }));
    } catch {
      // Fall through to the local cache so we never render a broken
      // dashboard just because the server hiccupped.
    }
  }

  const plates = await getRecent();
  const out: RecentEntry[] = [];
  for (const p of plates) {
    const detail = await getCached(p).catch(() => null);
    const merk = detail?.algemeen?.merk ?? null;
    const model = detail?.algemeen?.model ?? null;
    out.push({
      plate: p,
      merk,
      model,
      theme: merk ? brandFor(merk) : null,
    });
  }
  return out;
}

function GenericCarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 11l2-5h10l2 5" />
      <rect x="2" y="11" width="20" height="7" rx="2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M2 15h20" />
    </svg>
  );
}

