import { auth as functionsAuth } from "firebase-functions/v1";
import { Timestamp } from "firebase-admin/firestore";
import { auth, db } from "./lib/admin.js";

/**
 * Welcome-pack grant. Fires once per Firebase Auth user creation
 * (createUserWithEmailAndPassword or first Google sign-in) and writes
 * a small "welcome" pass so the new user can experience the full AI
 * analysis on their first dossier - the conversion wow moment.
 *
 * Shape: same as a paid Single Pass, but:
 *   - credits = 1, chatBudget = 3   (tighter than €4.95 SINGLE)
 *   - 7-day TTL                      (sense of urgency)
 *   - source: "welcome"              (so the credit ledger can group/report)
 *   - boundVehicleId stays null      (we don't know which plate they're on)
 *
 * Sets tier=pass via setCustomUserClaims so the web UI unlocks paid
 * surfaces immediately. The web force-refreshes the id token after
 * sign-up so the new claim is visible without a reload.
 *
 * Idempotency: keyed by a fixed `welcome-{uid}` doc id, so re-triggering
 * the function (manual replay, auth event redelivery) cannot duplicate.
 */
export const grantWelcomePassOnCreate = functionsAuth
  .user()
  .onCreate(async (user) => {
    const uid = user.uid;
    const welcomeRef = db().collection(`users/${uid}/passes`).doc(`welcome-${uid}`);

    const existing = await welcomeRef.get();
    if (existing.exists) {
      console.log(`welcome-pass: already granted uid=${uid}, skipping`);
      return;
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);

    await welcomeRef.set({
      passId: welcomeRef.id,
      uid,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      pack: "SINGLE",
      credits: { initial: 1, remaining: 1 },
      chatBudget: { initial: 3, remaining: 3 },
      boundVehicleId: null,
      purchasedAt: now,
      expiresAt,
      status: "ACTIVE",
      source: "welcome",
      schemaVersion: 1,
    });

    try {
      await auth().setCustomUserClaims(uid, { tier: "pass" });
      console.log(`welcome-pass: granted uid=${uid}, tier=pass`);
    } catch (err) {
      // Pass doc exists, so the agent can still authorize via Firestore.
      // The next ID-token refresh from the existing webhook flow OR a
      // page reload will pick up the claim eventually.
      console.error(`welcome-pass: setCustomUserClaims failed uid=${uid}:`, err);
    }
  });
