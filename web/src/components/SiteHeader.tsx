import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LanguageSwitch } from "./LanguageSwitch";
import { SignInButton } from "./SignInButton";
import { signOutCurrent, useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { isChatFocusRoute } from "../lib/routeFocus";

/**
 * Sticky site header. Desktop: brand · primary nav · language switch.
 * Mobile (<880px): brand · hamburger that opens a slide-in drawer with
 * the same nav links + language switch in the footer of the drawer.
 *
 * Drawer accessibility:
 *   - traps the page from scrolling underneath when open
 *   - ESC closes
 *   - backdrop click closes
 *   - focus returns to trigger when closed (handled by the browser since
 *     we never focus-trap explicitly - the drawer's first link is the
 *     natural next focus stop)
 */
export function SiteHeader() {
  const t = useT();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const hideOnChatFocus = isChatFocusRoute(pathname);

  // Close the drawer on route change.
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll while drawer is open + ESC closes.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hideOnChatFocus) return null;

  // Signed-in users get a brand link to their dashboard so the header
  // never bounces them back to the marketing page.
  const brandHref = auth.user ? "/dashboard" : "/";

  // Header swap by auth state:
  //   - Signed-out: marketing nav (drives conversion)
  //   - Signed-in:  product nav (drives task completion)
  // About/Blog stay reachable via the slide-in drawer + footer.
  const marketingLinks = [
    { to: "/", labelKey: "nav.home" },
    { to: "/hoe-werkt-het", labelKey: "nav.how" },
    { to: "/prijzen", labelKey: "nav.pricing" },
    { to: "/over", labelKey: "nav.about" },
    { to: "/blog", labelKey: "nav.blog" },
  ];
  const productLinks = [
    { to: "/dashboard", labelKey: "nav.dashboard" },
    { to: "/v2/chat", labelKey: "nav.chat" },
    { to: "/compare", labelKey: "nav.compare" },
    { to: "/prijzen", labelKey: "nav.pricing" },
  ];
  const links = auth.user ? productLinks : marketingLinks;
  // Drawer (mobile) shows both sets when signed in, so users can still
  // jump to the marketing pages if they want to.
  const drawerLinks = auth.user
    ? [
        ...productLinks,
        { to: "/account", labelKey: "nav.account" },
        { to: "/over", labelKey: "nav.about" },
        { to: "/blog", labelKey: "nav.blog" },
      ]
    : marketingLinks;

  return (
    <>
      <header className="site-header" role="banner">
        <div className="site-header-inner">
          <Link to={brandHref} className="brand" aria-label={t("brand")}>
            <span className="brand-mark" aria-hidden="true">AC</span>
            <span>{t("brand")}</span>
          </Link>
          <nav className="primary-nav" aria-label={t("nav.primary")}>
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {t(l.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="site-header-right">
            <SignInButton />
            <LanguageSwitch />
            <button
              type="button"
              className="menu-trigger"
              aria-label={t("nav.openMenu")}
              aria-expanded={open}
              aria-controls="site-drawer"
              onClick={() => setOpen(true)}
            >
              <HamburgerIcon />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`drawer-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="site-drawer"
        className={`drawer${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.menu")}
      >
        <div className="drawer-header">
          <strong>{t("nav.menu")}</strong>
          <button
            type="button"
            className="drawer-close"
            aria-label={t("nav.closeMenu")}
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </div>
        {/* Auth CTAs at the top of the drawer. For anonymous visitors this
            is the primary conversion surface - Create account + Sign in.
            For signed-in users it's a compact account card with the email
            + tier badge; Sign out lives at the bottom of the drawer near
            language settings (low-traffic but always reachable). */}
        {!auth.user ? (
          <div className="drawer-auth">
            <Link to="/sign-up" className="drawer-auth-primary">{t("auth.signUp.submit")}</Link>
            <Link to="/sign-in" className="drawer-auth-ghost">{t("nav.signIn")}</Link>
          </div>
        ) : (
          <DrawerAccountCard />
        )}
        <nav aria-label={t("nav.primary")}>
          {drawerLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {t(l.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="drawer-bottom">
          <div className="lang-row">
            <span>{t("language.label")}</span>
            <LanguageSwitch />
          </div>
          {auth.user && <DrawerSignOutRow />}
        </div>
      </aside>
    </>
  );
}

/**
 * Compact account header inside the slide-in drawer. Replaces the header
 * SignInButton pill (which renders three crammed elements on one line:
 * tier badge + avatar + email). Here we have full drawer width so we use
 * a two-line layout: "Signed in as" label + email; tier badge sits below.
 */
function DrawerAccountCard() {
  const auth = useAuth();
  const t = useT();
  if (!auth.user) return null;
  const label = auth.user.email ?? auth.user.displayName ?? auth.user.uid.slice(0, 8);
  const initial = (auth.user.displayName ?? auth.user.email ?? auth.user.uid).trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="drawer-account">
      <span className="drawer-account-avatar" aria-hidden="true">{initial}</span>
      <div className="drawer-account-meta">
        <p className="drawer-account-label">{t("nav.signedInAs")}</p>
        <p className="drawer-account-email" title={label}>{label}</p>
        {auth.tier !== "free" && (
          <span className={`tier-badge tier-${auth.tier}`} aria-label={`tier ${auth.tier}`}>
            {auth.tier}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * "Sign out" row at the bottom of the drawer (next to language). Kept
 * separate from the account card so the destructive action isn't the
 * loudest thing in the drawer - users land on navigation links first.
 */
function DrawerSignOutRow() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function onSignOut() {
    setBusy(true);
    try { await signOutCurrent(); } finally { setBusy(false); }
  }
  return (
    <button
      type="button"
      className="drawer-signout"
      onClick={onSignOut}
      disabled={busy}
    >
      {busy ? "…" : t("nav.signOut")}
    </button>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h16M3 11h16M3 16h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l12 12M17 5L5 17" />
    </svg>
  );
}
