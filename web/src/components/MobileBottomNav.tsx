import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { isChatFocusRoute } from "../lib/routeFocus";

/**
 * Fixed bottom navigation, mobile-only, signed-in-only. Four tabs:
 * Home / Compare / Chat / Account. Hidden on auth pages so the
 * sign-in form is not crowded.
 *
 * The CSS uses --mobile-nav-h on :root + env(safe-area-inset-bottom)
 * so page-level layouts can reserve the right amount of room above.
 */
export function MobileBottomNav() {
  const auth = useAuth();
  const t = useT();
  const { pathname } = useLocation();

  if (!auth.user) return null;
  if (pathname.startsWith("/sign-")) return null;
  if (isChatFocusRoute(pathname)) return null;

  return (
    <nav className="mobile-nav" aria-label={t("nav.mobile.label")}>
      <NavLink to="/dashboard" end className="mobile-nav-item">
        <HomeIcon /> <span>{t("nav.mobile.home")}</span>
      </NavLink>
      <NavLink to="/compare" className="mobile-nav-item">
        <CompareIcon /> <span>{t("nav.mobile.compare")}</span>
      </NavLink>
      <NavLink to="/v2/chat" className="mobile-nav-item">
        <ChatIcon /> <span>{t("nav.mobile.chat")}</span>
      </NavLink>
      <NavLink to="/account" className="mobile-nav-item">
        <AccountIcon /> <span>{t("nav.mobile.account")}</span>
      </NavLink>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="7" height="14" rx="1" /><rect x="14" y="5" width="7" height="14" rx="1" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
