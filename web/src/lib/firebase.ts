import { type FirebaseApp, initializeApp } from "firebase/app";
import {
  type AppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { type Auth, getAuth } from "firebase/auth";

/**
 * Lazy singleton Firebase init. Returns null when the SDK config isn't
 * set (typical for `npm run dev` without a Firebase project) - callers
 * gracefully skip auth and rely on the agent's dev-stub user.
 *
 * Cloud / staging builds set all six VITE_FIREBASE_* env vars at build
 * time; presence is checked here, not at init time, so a misconfigured
 * deploy fails closed (no auth → 401 on cloud endpoints).
 *
 * App Check is independent: VITE_RECAPTCHA_SITE_KEY can be set without
 * Firebase Auth (the App Check token doesn't depend on a signed-in user).
 */
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _appCheck: AppCheck | null = null;

export function firebaseConfigured(): boolean {
  const env = import.meta.env;
  return Boolean(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID,
  );
}

export function appCheckConfigured(): boolean {
  return Boolean(import.meta.env.VITE_RECAPTCHA_SITE_KEY);
}

/**
 * GA4 measurement id is optional and independent of auth: analytics only
 * initialises when it's present AND the user has granted consent (see
 * lib/analytics.ts). Absent (local dev / preview) → analytics is a no-op.
 */
export function analyticsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured()) return null;
  if (_app) return _app;
  const env = import.meta.env;
  _app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY!,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: env.VITE_FIREBASE_PROJECT_ID!,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID!,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
  });
  return _app;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!_auth) _auth = getAuth(app);
  return _auth;
}

/**
 * Lazily init Firebase App Check with the reCAPTCHA Enterprise provider.
 * Requires a Firebase app, a site key, and (optionally) a debug token
 * for local development. Returns null when App Check isn't configured.
 *
 * The debug token short-circuits reCAPTCHA in local dev so testing isn't
 * blocked. Whitelist the token in Firebase Console → App Check → Manage
 * debug tokens, exactly once per workstation.
 */
export function getAppCheckClient(): AppCheck | null {
  if (_appCheck) return _appCheck;
  const app = getFirebaseApp();
  if (!app || !appCheckConfigured()) return null;

  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    // Cast through unknown - this is the documented opt-in for debug mode
    // and isn't on the standard Window type.
    (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  _appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY!,
    ),
    isTokenAutoRefreshEnabled: true,
  });
  return _appCheck;
}
