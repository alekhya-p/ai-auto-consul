#!/usr/bin/env node
/**
 * One-time bootstrap: grant the `admin` custom claim so an account can see the
 * admin usage analytics (web route /admin/usage; API GET /v1/admin/usage).
 *
 * Custom claims are per-user runtime state - they can't be expressed in
 * Terraform - so this is the single manual step for admin access. It is
 * idempotent and MERGES claims (preserves any existing `tier`), because
 * setCustomUserClaims replaces the whole claims object.
 *
 * Run from the functions/ directory so firebase-admin resolves from node_modules:
 *
 *   # with a service-account key:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json \
 *     node scripts/set-admin-claim.mjs admin@autoconsul.example
 *
 *   # or with gcloud application-default credentials:
 *   gcloud auth application-default login
 *   node scripts/set-admin-claim.mjs admin@autoconsul.example
 *
 * After running, the user must refresh their ID token (sign out/in, or wait
 * up to ~1h) for the claim to take effect in the web app.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/set-admin-claim.mjs <email>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });

const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims ?? {}), admin: true };
await auth.setCustomUserClaims(user.uid, claims);

console.log(`✓ admin claim set for ${email} (uid=${user.uid}).`);
console.log("  claims now:", JSON.stringify(claims));
console.log("  → the user must sign out/in (or wait ~1h) to refresh their ID token.");
process.exit(0);
