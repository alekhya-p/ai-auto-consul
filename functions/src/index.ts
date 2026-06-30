import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { rdwApp } from "./mocks/rdw/handler.js";
import { autotelexApp } from "./mocks/autotelex/handler.js";
import { handleStripeWebhook } from "./stripe/webhook.js";

setGlobalOptions({ region: "europe-west4", maxInstances: 5 });

/**
 * Dev-only mock proxies. Deployed to dev / staging projects; never to
 * prod. See functions/README.md.
 */
export const rdwMock = onRequest({ cors: false, invoker: "public" }, rdwApp);
export const autotelexMock = onRequest({ cors: false, invoker: "public" }, autotelexApp);

/**
 * Stripe webhook. Only this function writes users/{uid}/passes/ after checkout.
 * The Python agent reads passes but never creates them.
 */
const STRIPE_SECRET = defineSecret("STRIPE_SECRET");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

export const stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
    invoker: "public",
    maxInstances: 5,
  },
  (req, res) => handleStripeWebhook(req, res, {
    stripeSecret: STRIPE_SECRET.value(),
    webhookSecret: STRIPE_WEBHOOK_SECRET.value(),
  }),
);

export { grantWelcomePassOnCreate } from "./welcome.js";
