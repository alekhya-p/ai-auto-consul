import type { Request, Response } from "express";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { auth, db } from "../lib/admin.js";
import { isPack, PACK_DETAILS, packTier, maxTier, type Pack, type Tier } from "./types.js";

/**
 * Stripe webhook handler.
 *
 * Verifies the signature, dedupes on event id, and writes the pass document
 * inside a Firestore transaction. Handles checkout.session.completed today.
 * The agent never writes to users/{uid}/passes/.
 */

export interface WebhookEnv {
  stripeSecret: string;
  webhookSecret: string;
}

export interface WebhookDeps {
  /** Lazily-built Stripe client; tests inject a stub. */
  stripeClient: (apiKey: string) => Stripe;
  /** Firestore handle; tests inject a fake. */
  firestore: () => Firestore;
  /**
   * Custom-claim setter (Admin SDK). Called after a successful pass-write
   * so the user's id-token carries the new tier on next refresh. Tests
   * inject a spy.
   */
  setCustomUserClaims: (uid: string, claims: Record<string, unknown>) => Promise<void>;
}

export const defaultDeps: WebhookDeps = {
  stripeClient: (apiKey) => new Stripe(apiKey),
  firestore: () => db(),
  setCustomUserClaims: (uid, claims) => auth().setCustomUserClaims(uid, claims),
};

export async function handleStripeWebhook(
  req: Request,
  res: Response,
  env: WebhookEnv,
  deps: WebhookDeps = defaultDeps,
): Promise<void> {
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).json({ error: "missing_signature" });
    return;
  }
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? req.body;
  if (!rawBody) {
    res.status(400).json({ error: "missing_body" });
    return;
  }

  const stripe = deps.stripeClient(env.stripeSecret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.webhookSecret);
  } catch (err) {
    res.status(400).json({ error: "invalid_signature", message: (err as Error).message });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event, deps);
        break;
      default:
        // Acknowledge unhandled events so Stripe doesn't keep retrying.
        break;
    }
    res.status(200).json({ received: true, type: event.type });
  } catch (err) {
    res.status(500).json({ error: "handler_failed", message: (err as Error).message });
  }
}

async function onCheckoutCompleted(event: Stripe.Event, deps: WebhookDeps): Promise<void> {
  const firestore = deps.firestore();
  const session = event.data.object as Stripe.Checkout.Session;
  const uid = session.metadata?.uid;
  const packRaw = session.metadata?.pack;
  const bindToPassId = session.metadata?.bindToPassId || null;

  if (!uid || !isPack(packRaw)) {
    throw new Error(`bad metadata uid=${uid} pack=${packRaw}`);
  }
  const pack: Pack = packRaw;

  const eventRef = firestore.collection("stripe_events").doc(event.id);

  let wrote = false;
  await firestore.runTransaction(async (tx) => {
    const dedupe = await tx.get(eventRef);
    if (dedupe.exists) return;
    wrote = true;

    tx.set(eventRef, {
      type: event.type,
      sessionId: session.id,
      processedAt: FieldValue.serverTimestamp(),
    });

    if (bindToPassId) {
      const passRef = firestore.doc(`users/${uid}/passes/${bindToPassId}`);
      const details = PACK_DETAILS[pack];
      tx.update(passRef, {
        "credits.remaining":    FieldValue.increment(details.credits),
        "credits.initial":      FieldValue.increment(details.credits),
        "chatBudget.remaining": FieldValue.increment(details.chatTurns),
        "chatBudget.initial":   FieldValue.increment(details.chatTurns),
        lastTopupAt:            FieldValue.serverTimestamp(),
      });
    } else {
      const passRef = firestore.collection(`users/${uid}/passes`).doc();
      tx.set(passRef, buildPassDoc(passRef.id, uid, pack, session));
    }
  });

  // Custom-claim flip happens AFTER the txn so a duplicate delivery (which
  // short-circuits inside the txn) never re-stamps the claim. Admin SDK
  // call is best-effort: a failure here doesn't undo the pass write -
  // the user will still see their pass on /dashboard once the next id-token
  // refreshes from Firestore-derived state. We log but don't re-throw.
  //
  // Tier precedence: read ALL the user's active passes and use the highest
  // mapped tier - never downgrade. Example: user with active Compare 3
  // (tier=pro) who later buys a Single must stay on pro until the Compare
  // 3 expires; setting tier=pass here would silently downgrade them.
  if (wrote) {
    try {
      const tier = await effectiveTier(firestore, uid, pack);
      await deps.setCustomUserClaims(uid, { tier });
    } catch (err) {
      console.error(`setCustomUserClaims failed uid=${uid} pack=${pack}:`, err);
    }
  }
}

/**
 * Highest tier across the user's still-active passes, plus the pack
 * we just wrote (defensive - in case the new pass doc isn't visible
 * to the query yet due to read-after-write timing).
 */
async function effectiveTier(firestore: Firestore, uid: string, justBought: Pack): Promise<Tier> {
  const now = Timestamp.now();
  let highest: Tier = packTier(justBought);
  try {
    const docs = await firestore.collection(`users/${uid}/passes`)
      .where("status", "==", "ACTIVE")
      .get();
    for (const d of docs.docs) {
      const p = d.get("pack");
      const expiresAt = d.get("expiresAt") as Timestamp | undefined;
      if (!isPack(p)) continue;
      if (expiresAt && expiresAt.toMillis() <= now.toMillis()) continue;
      highest = maxTier(highest, packTier(p));
    }
  } catch (err) {
    console.warn(`effectiveTier query failed uid=${uid}, falling back to just-bought pack:`, err);
  }
  return highest;
}

function buildPassDoc(passId: string, uid: string, pack: Pack, session: Stripe.Checkout.Session) {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlMillis(pack));
  const details = PACK_DETAILS[pack];

  return {
    passId,
    uid,
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    pack,
    credits:    { initial: details.credits,   remaining: details.credits   },
    chatBudget: { initial: details.chatTurns, remaining: details.chatTurns },
    boundVehicleId: null,
    purchasedAt: now,
    expiresAt,
    status: "ACTIVE",
    schemaVersion: 1,
  };
}

function ttlMillis(pack: Pack): number {
  const day = 24 * 60 * 60 * 1000;
  return pack === "POWER10" ? 60 * day : 30 * day;
}
