import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { signOutCurrent, useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";

/**
 * Header auth control. Three states:
 *   - Firebase not configured  → hidden (AuthBadge says "dev")
 *   - Signed-out               → single "Sign in" link
 *   - Signed-in                → user-name pill that opens a dropdown
 *                                (Dashboard, Sign out)
 *
 * The sign-up entry point is on the SignInPage as "Create an account",
 * plus the AiLockedTeaser on the dossier page - keeping the header
 * compact.
 */
export function SignInButton() {
  const auth = useAuth();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!auth.enabled || !auth.ready) return null;

  async function onSignOut() {
    setBusy(true);
    try {
      await signOutCurrent();
      setMenuOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!auth.user) {
    return (
      <div className="sign-in" role="group">
        <Link to="/sign-in" className="ghost">{t("nav.signIn")}</Link>
      </div>
    );
  }

  const label = auth.user.email ?? auth.user.displayName ?? auth.user.uid.slice(0, 8);
  const initial = (auth.user.displayName ?? auth.user.email ?? auth.user.uid).trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="sign-in user-menu" ref={menuRef}>
      <button
        type="button"
        className="ghost user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t("nav.userMenu")}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {auth.tier !== "free" && (
          <span className={`tier-badge tier-${auth.tier}`} aria-label={`tier ${auth.tier}`}>
            {auth.tier}
          </span>
        )}
        <span className="user-menu-avatar" aria-hidden="true">{initial}</span>
        <span className="user-menu-label">{label}</span>
      </button>
      {menuOpen && (
        <div className="user-menu-dropdown" role="menu">
          <p className="user-menu-email" aria-hidden="true">{label}</p>
          <Link to="/account" role="menuitem" onClick={() => setMenuOpen(false)}>
            {t("nav.account")}
          </Link>
          <Link to="/hoe-werkt-het" role="menuitem" onClick={() => setMenuOpen(false)}>
            {t("nav.how")}
          </Link>
          <Link to="/over" role="menuitem" onClick={() => setMenuOpen(false)}>
            {t("nav.about")}
          </Link>
          <Link to="/blog" role="menuitem" onClick={() => setMenuOpen(false)}>
            {t("nav.blog")}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="user-menu-signout"
            onClick={onSignOut}
            disabled={busy}
          >
            {busy ? "…" : t("nav.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
