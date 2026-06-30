import {
  type Analytics,
  getAnalytics,
  logEvent,
  setUserId,
  setUserProperties,
} from "firebase/analytics";

import { analyticsConfigured, getFirebaseApp } from "./firebase";

/**
 * Consent-gated GA4 / Firebase Analytics wrapper.
 *
 * Analytics initialises (and any event fires) ONLY when both:
 *   1. a measurement id is configured (analyticsConfigured()), and
 *   2. the user has granted analytics consent via the cookie banner.
 *
 * Until then - and after consent is withdrawn - every call is a no-op:
 * nothing is loaded, no cookies, no network. This keeps us compliant with
 * the NL/EU "no analytics before consent" rule.
 */
export type AnalyticsEvent =
  | { name: "page_view"; params: { page_path: string } }
  // plate_lookup = intent (source known at submit); the found/not_found
  // outcome rides dossier_viewed once the vehicle page resolves.
  | { name: "plate_lookup"; params: { source: "hero" | "dashboard" | "compare" } }
  | { name: "compare_started"; params: { n_plates: number } }
  | { name: "chat_opened"; params: { has_plate: boolean } }
  | { name: "chat_message_sent"; params?: Record<string, never> }
  | { name: "sign_up"; params: { method: string } }
  | { name: "login"; params: { method: string } }
  | { name: "dossier_viewed"; params: { found: boolean } };

type EventName = AnalyticsEvent["name"];
type ParamsOf<E extends EventName> = Extract<AnalyticsEvent, { name: E }>["params"];

let consent = false;
let instance: Analytics | null = null;

function ready(): Analytics | null {
  if (!consent || !analyticsConfigured()) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  if (!instance) instance = getAnalytics(app);
  return instance;
}

/** Toggle analytics consent. Withdrawing drops the instance so nothing else fires. */
export function setAnalyticsConsent(granted: boolean): void {
  consent = granted;
  if (!granted) instance = null;
}

/** Fire a typed analytics event (no-op until configured + consented). */
export function track<E extends EventName>(name: E, params?: ParamsOf<E>): void {
  const ga = ready();
  if (!ga) return;
  // firebase's logEvent has reserved-event-name overloads (e.g. "page_view")
  // that reject our generic union; cast to a permissive signature. The
  // AnalyticsEvent type already enforces name/params correctness at call sites.
  (logEvent as (a: Analytics, n: string, p?: Record<string, unknown>) => void)(
    ga,
    name,
    params as Record<string, unknown> | undefined,
  );
}

/** Associate subsequent events with a user id (or clear it on sign-out). */
export function setAnalyticsUser(uid: string | null): void {
  const ga = ready();
  if (!ga) return;
  setUserId(ga, uid ?? "");
}

/** Set segmentable user properties (logged-in state + pack tier). */
export function setAnalyticsUserProps(props: { tier: string; logged_in: boolean }): void {
  const ga = ready();
  if (!ga) return;
  setUserProperties(ga, props);
}
