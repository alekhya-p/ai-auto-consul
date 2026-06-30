/// <reference types="vite/client" />

/**
 * Firebase Web SDK + App Check config. Set these in web/.env.local
 * for dev and via the Cloud Build pipeline / Firebase Hosting build env
 * for staging and prod. The six VITE_FIREBASE_* must be set together -
 * partial config is treated as "no Firebase configured" and the auth path
 * is skipped (the agent's dev-stub user kicks in instead).
 *
 * App Check is independent: VITE_RECAPTCHA_SITE_KEY enables App Check
 * regardless of whether Firebase Auth is configured (any visitor - even
 * anonymous + unsigned - needs an App Check token in cloud).
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** reCAPTCHA Enterprise site key. When set, App Check is enabled. */
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  /** Debug token for local dev. Whitelist in Firebase console under App Check. */
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
