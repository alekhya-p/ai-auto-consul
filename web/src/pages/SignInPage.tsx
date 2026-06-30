import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { track } from "../lib/analytics";
import { AuthError, sendPasswordReset, signInWithEmail, signInWithGoogle, useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";

/**
 * /sign-in - Google one-tap + email/password form.
 * Redirects to `?next=…` (URL-decoded path) on success, or `/dashboard`
 * by default. If a user is already signed in, the page auto-redirects.
 */
export function SignInPage() {
  const auth = useAuth();
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = decodeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.ready && auth.user) {
    navigate(next, { replace: true });
    return null;
  }

  function setErrorFrom(err: unknown) {
    if (err instanceof AuthError) {
      setError(t(`auth.errors.${err.code}`));
    } else {
      setError(t("auth.errors.unknown"));
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      track("login", { method: "password" });
      navigate(next, { replace: true });
    } catch (err) {
      setErrorFrom(err);
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError(t("auth.signIn.resetNeedEmail"));
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(addr);
      // Neutral confirmation - Firebase succeeds even for unknown addresses,
      // so we never reveal whether an account exists.
      setNotice(t("auth.signIn.resetSent", { email: addr }));
    } catch (err) {
      setErrorFrom(err);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      track("login", { method: "google" });
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof AuthError && err.code === "popup_closed") return;
      setErrorFrom(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="auth-page">
      <header className="auth-hero">
        <Link to="/" className="auth-brand" aria-label={t("brand")}>
          <span className="brand-mark" aria-hidden="true">AC</span>
          <span>{t("brand")}</span>
        </Link>
        <h1>{t("auth.signIn.title")}</h1>
        <p>{t("auth.signIn.subtitle")}</p>
      </header>

      <button
        type="button"
        className="auth-google"
        onClick={onGoogle}
        disabled={busy}
      >
        <GoogleMark />
        <span>{t("auth.signIn.google")}</span>
      </button>

      <div className="auth-divider"><span>{t("auth.signIn.or")}</span></div>

      <form className="auth-form" onSubmit={onEmailSubmit} noValidate>
        <label>
          <span>{t("auth.signIn.email")}</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          <span>{t("auth.signIn.password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="auth-forgot"
          onClick={() => void onForgotPassword()}
          disabled={busy}
        >
          {t("auth.signIn.forgot")}
        </button>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t("auth.signIn.submitting") : t("auth.signIn.submit")}
        </button>
      </form>

      <p className="auth-alt">
        {t("auth.signIn.altPrompt")}{" "}
        <Link to={`/sign-up${nextQuery(next)}`}>{t("auth.signIn.altLink")}</Link>
      </p>
    </article>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

function decodeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) return decoded;
  } catch {
    /* fall through */
  }
  return "/dashboard";
}

function nextQuery(next: string): string {
  return next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`;
}
