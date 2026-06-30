import { useEffect, useState } from "react";
import { getToken } from "firebase/app-check";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  appCheckConfigured,
  firebaseConfigured,
  getAppCheckClient,
  getFirebaseAuth,
} from "./firebase";
import { setAnalyticsUser, setAnalyticsUserProps } from "./analytics";
import { handleAuthUidChange } from "./userScope";

/**
 * Current user + ID token state. `null` when Firebase isn't configured
 * (typical for local dev without env vars); the agent's dev-stub user
 * handles authorization in that case.
 *
 * No anonymous sign-in: visitors browse the public RDW pages without an
 * account. Sign-up is required to use AI chat / analysis. See
 * memory/project-auth-no-anonymous.md.
 */
export type Tier = "free" | "pass" | "pro" | "power";

export interface AuthState {
  /** True once the SDK has resolved the initial sign-in attempt. */
  ready: boolean;
  /** Configured at build time; affects which auth UI is offered. */
  enabled: boolean;
  user: User | null;
  /** Current ID token, refreshed automatically by the SDK. */
  idToken: string | null;
  /**
   * Custom claim `tier` from the ID token. Defaults to "free" until the
   * Stripe webhook flips it via setCustomUserClaims, after which the
   * next id-token refresh carries the new value.
   */
  tier: Tier;
  /** Custom claim `admin` - gates the /admin/usage analytics route. */
  isAdmin: boolean;
}

const INITIAL: AuthState = {
  ready: false,
  enabled: false,
  user: null,
  idToken: null,
  tier: "free",
  isAdmin: false,
};

function readTier(claims: Record<string, unknown> | null | undefined): Tier {
  const t = claims?.tier;
  return t === "pass" || t === "pro" || t === "power" ? t : "free";
}

/** True only when the `admin` custom claim is exactly boolean true. */
export function readAdmin(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.admin === true;
}

/**
 * Mock-mode auth stub. Only activates in mock mode (VITE_USE_MOCKS=true)
 * AND when the URL explicitly opts in via `?mockAuth=on`. The default is
 * signed-out so anonymous flows (sign-in, sign-up, public pages) work
 * normally. Tier is configurable via `?mockTier=pass|pro|power|free`
 * (defaults to "pass").
 *
 * Outside mock mode the override never engages - production builds
 * always hit real Firebase.
 */
function readMockAuthOverride(): AuthState | null {
  const mocksEnabled =
    (import.meta as unknown as { env: Record<string, string> }).env?.VITE_USE_MOCKS === "true";
  if (!mocksEnabled) return null;
  let mockAuth: string | null = null;
  let mockTier: string | null = null;
  if (typeof window !== "undefined") {
    const p = new URLSearchParams(window.location.search);
    mockAuth = p.get("mockAuth");
    mockTier = p.get("mockTier");
  }
  if (mockAuth !== "on") return null;
  const tier: Tier =
    mockTier === "pass" || mockTier === "pro" || mockTier === "power" || mockTier === "free"
      ? mockTier
      : "pass";
  // Minimal User shape - only the fields the app actually reads. Cast through
  // unknown to satisfy the strict Firebase User type without dragging in the
  // full SDK at this layer.
  const stubUser = {
    uid: "mock-uid-0000",
    email: "mockuser@auto-consul.dev",
    emailVerified: true,
    displayName: "Mock User",
    isAnonymous: false,
    photoURL: null,
    phoneNumber: null,
    providerId: "password",
    metadata: { creationTime: undefined, lastSignInTime: undefined },
    providerData: [],
    refreshToken: "mock-refresh",
    tenantId: null,
    delete: async () => undefined,
    getIdToken: async () => "mock-id-token",
    getIdTokenResult: async () => ({
      token: "mock-id-token",
      claims: { tier } as Record<string, unknown>,
      authTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 3600_000).toISOString(),
      issuedAtTime: new Date().toISOString(),
      signInProvider: "password",
      signInSecondFactor: null,
    }),
    reload: async () => undefined,
    toJSON: () => ({}),
  } as unknown as User;
  handleAuthUidChange(stubUser.uid);
  return { ready: true, enabled: true, user: stubUser, idToken: "mock-id-token", tier, isAdmin: false };
}

/**
 * Subscribe to the Firebase id-token stream. The hook never forces a
 * sign-in - if no user is present, AuthState.user stays null until the
 * visitor signs in or signs up via the dedicated pages.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => {
    const mock = readMockAuthOverride();
    if (mock) return mock;
    return { ...INITIAL, enabled: firebaseConfigured() };
  });

  useEffect(() => {
    // If mock override is active, lock state and skip Firebase wiring.
    const mock = readMockAuthOverride();
    if (mock) {
      handleAuthUidChange(mock.user?.uid ?? null);
      setState(mock);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setState({ ready: true, enabled: false, user: null, idToken: null, tier: "free", isAdmin: false });
      return;
    }

    let lastUid: string | null | undefined;
    const unsub = onIdTokenChanged(auth, async (user) => {
      const nextUid = user?.uid ?? null;
      if (lastUid !== nextUid) {
        handleAuthUidChange(nextUid);
        lastUid = nextUid;
      }
      if (!user) {
        setAnalyticsUser(null);
        setAnalyticsUserProps({ tier: "free", logged_in: false });
        setState({ ready: true, enabled: true, user: null, idToken: null, tier: "free", isAdmin: false });
        return;
      }
      const result = await user.getIdTokenResult();
      const tier = readTier(result.claims);
      // Segment analytics by logged-in state + pack tier (no-op until consented).
      setAnalyticsUser(user.uid);
      setAnalyticsUserProps({ tier, logged_in: true });
      setState({
        ready: true,
        enabled: true,
        user,
        idToken: result.token,
        tier,
        isAdmin: readAdmin(result.claims),
      });
    });

    return () => unsub();
  }, []);

  return state;
}

/**
 * Single-shot helper. Returns the current ID token (force-refreshed
 * if expired) when Firebase is configured and someone is signed in;
 * null otherwise.
 */
export async function fetchIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

/**
 * Single-shot App Check token getter. Returns null when App Check isn't
 * configured (dev without VITE_RECAPTCHA_SITE_KEY) - the agent's filter
 * either short-circuits (app-check-enabled=false) or 401s.
 *
 * The SDK caches the token internally so calling this on every request
 * is cheap; reCAPTCHA only re-fires when the cached token is near
 * expiry.
 */
export async function fetchAppCheckToken(forceRefresh = false): Promise<string | null> {
  if (!appCheckConfigured()) return null;
  const client = getAppCheckClient();
  if (!client) return null;
  try {
    const { token } = await getToken(client, forceRefresh);
    return token;
  } catch (err) {
    console.warn("app check token fetch failed", err);
    return null;
  }
}

/**
 * Discriminated error for the sign-in/up surface so the UI can render
 * the right hint without parsing Firebase error codes.
 */
export class AuthError extends Error {
  constructor(message: string, public readonly code: AuthErrorCode) {
    super(message);
  }
}

export type AuthErrorCode =
  | "not_configured"
  | "not_authenticated"
  | "popup_blocked"
  | "popup_closed"
  | "invalid_credentials"
  | "email_in_use"
  | "weak_password"
  | "invalid_email"
  | "user_disabled"
  | "too_many_requests"
  | "network"
  | "unknown";

function translateFirebaseError(err: unknown, fallback: string): AuthError {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-blocked":
      return new AuthError("Pop-up blocked - allow pop-ups for this site.", "popup_blocked");
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return new AuthError("Sign-in window was closed.", "popup_closed");
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return new AuthError("Email or password is incorrect.", "invalid_credentials");
    case "auth/email-already-in-use":
      return new AuthError("An account already exists for this email.", "email_in_use");
    case "auth/weak-password":
      return new AuthError("Password is too weak (min 6 characters).", "weak_password");
    case "auth/invalid-email":
      return new AuthError("That email address looks invalid.", "invalid_email");
    case "auth/user-disabled":
      return new AuthError("This account has been disabled.", "user_disabled");
    case "auth/too-many-requests":
      return new AuthError("Too many attempts - try again in a minute.", "too_many_requests");
    case "auth/network-request-failed":
      return new AuthError("Network error - check your connection.", "network");
    default:
      return new AuthError((err as Error)?.message || fallback, "unknown");
  }
}

/** Email + password sign-in. */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new AuthError("Firebase is not configured.", "not_configured");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    throw translateFirebaseError(err, "Sign-in failed.");
  }
}

/** Sends a password-reset email. Firebase returns success even for unknown
 * addresses (to avoid leaking which emails are registered), so callers should
 * show a neutral "if an account exists, we sent a link" confirmation. */
export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new AuthError("Firebase is not configured.", "not_configured");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw translateFirebaseError(err, "Could not send the reset email.");
  }
}

/** Email + password sign-up. Triggers a verification email best-effort - failure to send doesn't block sign-up. */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new AuthError("Firebase is not configured.", "not_configured");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    sendEmailVerification(cred.user).catch((err) => {
      // Best-effort: rate-limited or transient. Don't block sign-up.
      // User can re-trigger from the dashboard banner.
      console.warn("sendEmailVerification failed:", err);
    });
    return cred.user;
  } catch (err) {
    throw translateFirebaseError(err, "Sign-up failed.");
  }
}

/** Manually re-send the verification email. Used by the dashboard banner. */
export async function resendVerificationEmail(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new AuthError("Not signed in.", "not_authenticated");
  if (auth.currentUser.emailVerified) return;
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (err) {
    throw translateFirebaseError(err, "Could not resend verification email.");
  }
}

/**
 * Whether the UI should gate paid actions on emailVerified. Controlled by
 * the build-time `VITE_REQUIRE_EMAIL_VERIFY` env (default off) so dev,
 * tests, and existing users without a verified email don't break.
 * Cloud Build flips it on for prod once the Firebase Auth email
 * template + sender domain are configured.
 */
export function requireEmailVerification(): boolean {
  return import.meta.env.VITE_REQUIRE_EMAIL_VERIFY === "true";
}

/** Google OAuth popup - used for both sign-in and sign-up. */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new AuthError("Firebase is not configured.", "not_configured");
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    return cred.user;
  } catch (err) {
    throw translateFirebaseError(err, "Sign-in failed.");
  }
}

/** Sign out the current user. After this, AuthState.user is null. */
export async function signOutCurrent(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
  handleAuthUidChange(null);
}
