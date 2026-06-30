import { useLayoutEffect } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { isChatFocusRoute } from "./lib/routeFocus";
import { usePageViews } from "./lib/usePageViews";
import { CookieBanner } from "./components/CookieBanner";
import { HeroLookup } from "./components/HeroLookup";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { RequireAdmin } from "./components/RequireAdmin";
import { RequireAuth } from "./components/RequireAuth";
import { AdminUsagePage } from "./features/admin/AdminUsagePage";
import { SiteFooter } from "./components/SiteFooter";
import { MarketingProductShowcase } from "./components/marketing/MarketingProductShowcase";
import { SiteHeader } from "./components/SiteHeader";
import { LanguageProvider, useT, useTList } from "./lib/i18n";
import { AboutPage } from "./pages/AboutPage";
import { AccountPage } from "./pages/AccountPage";
import { ArticlePage } from "./pages/ArticlePage";
import { BlogPage } from "./pages/BlogPage";
import { ChatV2Page } from "./pages/ChatV2Page";
import { ComparePage } from "./pages/ComparePage";
import { CookiesPage } from "./pages/CookiesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { PricingPage } from "./pages/PricingPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TermsPage } from "./pages/TermsPage";
import { VoertuigPage } from "./pages/VoertuigPage";

export function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <ScrollToTop />
        <PageViewTracker />
        <ChatFocusBodyClass />
        <SiteHeader />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/voertuig/:plate" element={<VoertuigPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="/v2/chat"
              element={
                <RequireAuth>
                  <ChatV2Page />
                </RequireAuth>
              }
            />
            <Route
              path="/compare"
              element={
                <RequireAuth>
                  <ComparePage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/usage"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminUsagePage />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route path="/prijzen" element={<PricingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/hoe-werkt-het" element={<HowItWorksPage />} />
            <Route path="/over" element={<AboutPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<ArticlePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
          </Routes>
        </main>
        <SiteFooter />
        <CookieBanner />
        <PwaInstallPrompt />
        <MobileBottomNav />
      </BrowserRouter>
    </LanguageProvider>
  );
}

/** Drops site chrome padding and enables full-height chat layout. */
function ChatFocusBodyClass() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const on = isChatFocusRoute(pathname);
    document.body.classList.toggle("route-chat-focus", on);
    return () => document.body.classList.remove("route-chat-focus");
  }, [pathname]);
  return null;
}

/** Emits a GA4 page_view on each route change (no-op until consented). */
function PageViewTracker() {
  usePageViews();
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    // Some browsers (and some routers) re-scroll on the next frame after a
    // route change; re-assert position-zero once more before restoring the
    // CSS smooth-scroll behaviour for in-page anchor jumps.
    const id = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      html.style.scrollBehavior = prev;
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}

function HomeView() {
  const auth = useAuth();
  if (auth.user) return <Navigate to="/dashboard" replace />;
  return (
    <>
      <div className="container">
        <HeroLookup />
      </div>
      <RedFlagsRevealStrip />
      <HowItWorksStrip />
      <MarketingProductShowcase />
      <FreeVsPaidStrip />
      <TrustStrip />
    </>
  );
}

function RedFlagsRevealStrip() {
  const t = useT();
  const items = ["mileage", "recalls", "wok", "apk", "cost", "zone"] as const;
  return (
    <section className="reveals" aria-label={t("reveals.title")}>
      <div className="reveals-inner">
        <p className="reveals-eyebrow">{t("reveals.label")}</p>
        <h2>{t("reveals.title")}</h2>
        <p className="reveals-subtitle">{t("reveals.subtitle")}</p>
        <ul className="reveals-grid">
          {items.map((key) => (
            <li key={key} className={`reveal-card reveal-${key}`}>
              {/* <span className="reveal-pip" aria-hidden="true" /> */}
              <h3>{t(`reveals.items.${key}.title`)}</h3>
              <p>{t(`reveals.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorksStrip() {
  const t = useT();
  return (
    <section className="how" aria-label={t("how.title")}>
      <div className="how-inner">
        <h2>{t("how.title")}</h2>
        <ol className="how-steps">
          <li className="how-step">
            {/* <span className="num">1</span> */}
            <h3>{t("how.step1.title")}</h3>
            <p>{t("how.step1.body")}</p>
          </li>
          <li className="how-step">
            {/* <span className="num">2</span> */}
            <h3>{t("how.step2.title")}</h3>
            <p>{t("how.step2.body")}</p>
          </li>
          <li className="how-step">
            {/* <span className="num">3</span> */}
            <h3>{t("how.step3.title")}</h3>
            <p>{t("how.step3.body")}</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

function FreeVsPaidStrip() {
  const t = useT();
  const freeItems = useTList()("freeVsPaid.free.items");
  const paidItems = useTList()("freeVsPaid.paid.items");
  return (
    <section className="free-vs-paid" aria-label={t("freeVsPaid.title")}>
      <div className="free-vs-paid-inner">
        <p className="reveals-eyebrow">{t("freeVsPaid.eyebrow")}</p>
        <h2>{t("freeVsPaid.title")}</h2>
        <p className="reveals-subtitle">{t("freeVsPaid.subtitle")}</p>
        <div className="fvp-grid">
          <article className="fvp-card fvp-free">
            <header>
              <h3>{t("freeVsPaid.free.title")}</h3>
              <span className="fvp-price">{t("freeVsPaid.free.price")}</span>
            </header>
            <ul>{freeItems.map((it, i) => <li key={i}>{it}</li>)}</ul>
            <Link to="/" className="ghost">{t("freeVsPaid.free.cta")}</Link>
          </article>
          <article className="fvp-card fvp-paid">
            <span className="fvp-badge">{t("freeVsPaid.paid.badge")}</span>
            <header>
              <h3>{t("freeVsPaid.paid.title")}</h3>
              <span className="fvp-price">{t("freeVsPaid.paid.price")}</span>
            </header>
            <ul>{paidItems.map((it, i) => <li key={i}>{it}</li>)}</ul>
            <Link to="/prijzen" className="primary">{t("freeVsPaid.paid.cta")}</Link>
          </article>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const t = useT();
  const items = ["rdw", "ai", "privacy"] as const;
  return (
    <section className="trust-strip" aria-label={t("trust.eyebrow")}>
      <div className="trust-strip-inner">
        <p className="reveals-eyebrow">{t("trust.eyebrow")}</p>
        <ul className="trust-grid">
          {items.map((key) => (
            <li key={key} className="trust-card">
              <h3>{t(`trust.items.${key}.title`)}</h3>
              <p>{t(`trust.items.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
