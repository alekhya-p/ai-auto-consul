import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { handleStripeWebhook, type WebhookDeps, type WebhookEnv } from "./webhook";

const env: WebhookEnv = { stripeSecret: "sk_test_xxx", webhookSecret: "whsec_xxx" };

function newReqRes() {
  const setStatus = vi.fn();
  const json = vi.fn();
  const res = {
    status: vi.fn((code: number) => { setStatus(code); return res; }),
    json,
  } as unknown as import("express").Response;
  return { res, setStatus, json };
}

function mockReq(opts: { signature?: string; rawBody?: Buffer } = {}) {
  return {
    header: (name: string) =>
      name.toLowerCase() === "stripe-signature" ? opts.signature : undefined,
    rawBody: opts.rawBody,
    body: opts.rawBody,
  } as unknown as import("express").Request;
}

function fakeStripe(constructEvent: (raw: Buffer, sig: string, secret: string) => Stripe.Event): Stripe {
  return { webhooks: { constructEvent } } as unknown as Stripe;
}

interface CapturedTx {
  dedupeExists: boolean;
  sets: Array<{ path: string; data: Record<string, unknown> }>;
  updates: Array<{ path: string; data: Record<string, unknown> }>;
}

interface FakeTx {
  get: (r: { path: string }) => Promise<{ exists: boolean }>;
  set: (r: { path: string }, data: Record<string, unknown>) => void;
  update: (r: { path: string }, data: Record<string, unknown>) => void;
}

function fakeFirestore(opts: { dedupeExists?: boolean } = {}) {
  const captured: CapturedTx = { dedupeExists: !!opts.dedupeExists, sets: [], updates: [] };
  const ref = (path: string) => ({ path, _isDoc: true });
  let autoId = 0;
  const tx: FakeTx = {
    get: async (r) => ({ exists: r.path.startsWith("stripe_events") ? captured.dedupeExists : false }),
    set: (r, data) => captured.sets.push({ path: r.path, data }),
    update: (r, data) => captured.updates.push({ path: r.path, data }),
  };
  const firestore = {
    collection: (path: string) => ({
      doc: (id?: string) => ref(id ? `${path}/${id}` : `${path}/auto_${++autoId}`),
    }),
    doc: (path: string) => ref(path),
    runTransaction: async (fn: (tx: FakeTx) => Promise<void>) => { await fn(tx); },
  } as unknown as import("firebase-admin/firestore").Firestore;
  return { firestore, captured };
}

describe("handleStripeWebhook", () => {
  const noopClaims = vi.fn(async () => {});

  it("rejects requests with no signature", async () => {
    const { res, setStatus, json } = newReqRes();
    const deps: WebhookDeps = {
      stripeClient: () => fakeStripe(() => { throw new Error("should not be called"); }),
      firestore: () => fakeFirestore().firestore,
      setCustomUserClaims: noopClaims,
    };
    await handleStripeWebhook(mockReq({ rawBody: Buffer.from("{}") }), res, env, deps);
    expect(setStatus).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "missing_signature" });
  });

  it("rejects requests with no raw body", async () => {
    const { res, setStatus, json } = newReqRes();
    const deps: WebhookDeps = {
      stripeClient: () => fakeStripe(() => { throw new Error("nope"); }),
      firestore: () => fakeFirestore().firestore,
      setCustomUserClaims: noopClaims,
    };
    await handleStripeWebhook(mockReq({ signature: "sig" }), res, env, deps);
    expect(setStatus).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "missing_body" });
  });

  it("rejects events with an invalid signature", async () => {
    const { res, setStatus, json } = newReqRes();
    const deps: WebhookDeps = {
      stripeClient: () => fakeStripe(() => { throw new Error("bad sig"); }),
      firestore: () => fakeFirestore().firestore,
      setCustomUserClaims: noopClaims,
    };
    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env, deps);
    expect(setStatus).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "invalid_signature" }));
  });

  it("writes a fresh pass on checkout.session.completed", async () => {
    const { res, setStatus, json } = newReqRes();
    const { firestore, captured } = fakeFirestore();
    const claims = vi.fn(async () => {});
    const event: Stripe.Event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_test_1",
        metadata: { uid: "uid_lotte", pack: "SINGLE" },
        payment_intent: "pi_1",
      } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    const deps: WebhookDeps = {
      stripeClient: () => fakeStripe(() => event),
      firestore: () => firestore,
      setCustomUserClaims: claims,
    };
    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env, deps);

    expect(setStatus).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ received: true, type: "checkout.session.completed" });
    expect(captured.sets).toHaveLength(2);
    const passSet = captured.sets.find((s) => s.path.startsWith("users/uid_lotte/passes/"));
    expect(passSet).toBeDefined();
    expect(passSet?.data).toMatchObject({
      uid: "uid_lotte",
      pack: "SINGLE",
      stripeSessionId: "cs_test_1",
      stripePaymentIntentId: "pi_1",
      credits:    { initial: 1, remaining: 1 },
      chatBudget: { initial: 10, remaining: 10 },
      status: "ACTIVE",
      schemaVersion: 1,
    });
    expect(claims).toHaveBeenCalledWith("uid_lotte", { tier: "pass" });
  });

  it("flips tier to pro for POWER10", async () => {
    const { res, setStatus } = newReqRes();
    const { firestore } = fakeFirestore();
    const claims = vi.fn(async () => {});
    const event: Stripe.Event = {
      id: "evt_pro",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_pro",
        metadata: { uid: "uid_bram", pack: "POWER10" },
      } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(200);
    // POWER10 now maps to the highest tier so the web's compare-page
    // limit table (power = 10 plates) actually unlocks.
    expect(claims).toHaveBeenCalledWith("uid_bram", { tier: "power" });
  });

  it("dedupes a re-delivered event (no writes, no claim flip)", async () => {
    const { res, setStatus } = newReqRes();
    const { firestore, captured } = fakeFirestore({ dedupeExists: true });
    const claims = vi.fn(async () => {});
    const event: Stripe.Event = {
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: { id: "cs_x", metadata: { uid: "uid", pack: "SINGLE" } } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(200);
    expect(captured.sets).toHaveLength(0);
    expect(captured.updates).toHaveLength(0);
    expect(claims).not.toHaveBeenCalled();
  });

  it("tops up an existing pass when bindToPassId is set", async () => {
    const { res, setStatus } = newReqRes();
    const { firestore, captured } = fakeFirestore();
    const claims = vi.fn(async () => {});
    const event: Stripe.Event = {
      id: "evt_topup",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_topup",
        metadata: { uid: "uid_x", pack: "COMPARE3", bindToPassId: "pass_old" },
      } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(200);
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0].path).toBe("users/uid_x/passes/pass_old");
    expect(captured.updates[0].data).toHaveProperty("credits.remaining");
    expect(captured.updates[0].data).toHaveProperty("chatBudget.remaining");
    // COMPARE3 now maps to "pro" so the compare-page can actually
    // unlock 3 plates instead of being capped at the Single tier.
    expect(claims).toHaveBeenCalledWith("uid_x", { tier: "pro" });
  });

  it("keeps highest tier when a smaller pack is bought after a bigger one", async () => {
    // Scenario: user already has an active Compare 3 (tier=pro). They
    // buy a Single on top. Without precedence, setCustomUserClaims would
    // downgrade them to pass. With precedence, they stay on pro.
    const { res, setStatus } = newReqRes();
    const claims = vi.fn(async () => {});

    // Custom firestore stub that returns an existing COMPARE3 pass when
    // the webhook reads users/{uid}/passes.where("status","==","ACTIVE").
    const futureTs = {
      toMillis: () => Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    const fakeDocs = [{ get: (k: string) => (k === "pack" ? "COMPARE3" : k === "expiresAt" ? futureTs : null) }];
    const firestore = {
      collection: (path: string) => {
        if (path === `users/uid_keep/passes`) {
          return {
            doc: () => ({ path: `${path}/new` }),
            where: () => ({ get: async () => ({ docs: fakeDocs }) }),
          };
        }
        return { doc: (id?: string) => ({ path: id ? `${path}/${id}` : `${path}/auto` }) };
      },
      doc: (path: string) => ({ path }),
      runTransaction: async (fn: (tx: FakeTx) => Promise<void>) => {
        const tx: FakeTx = {
          get: async () => ({ exists: false }),
          set: () => {},
          update: () => {},
        };
        await fn(tx);
      },
    } as unknown as import("firebase-admin/firestore").Firestore;

    const event: Stripe.Event = {
      id: "evt_no_downgrade",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs_single",
        metadata: { uid: "uid_keep", pack: "SINGLE" },
      } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(200);
    // Even though they just bought a Single (pass), the existing
    // active Compare 3 (pro) keeps them on the higher tier.
    expect(claims).toHaveBeenCalledWith("uid_keep", { tier: "pro" });
  });

  it("survives a setCustomUserClaims failure (pass still written, response still 200)", async () => {
    const { res, setStatus } = newReqRes();
    const { firestore, captured } = fakeFirestore();
    const claims = vi.fn(async () => { throw new Error("admin api down"); });
    const event: Stripe.Event = {
      id: "evt_claim_fail",
      type: "checkout.session.completed",
      data: { object: { id: "cs_x", metadata: { uid: "uid_x", pack: "SINGLE" } } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(200);
    expect(captured.sets.some((s) => s.path.startsWith("users/uid_x/passes/"))).toBe(true);
  });

  it("rejects events with bad metadata", async () => {
    const { res, setStatus } = newReqRes();
    const { firestore } = fakeFirestore();
    const claims = vi.fn(async () => {});
    const event: Stripe.Event = {
      id: "evt_bad",
      type: "checkout.session.completed",
      data: { object: { id: "cs_bad", metadata: { uid: "u" /* missing pack */ } } as unknown as Stripe.Checkout.Session },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(500);
    expect(claims).not.toHaveBeenCalled();
  });

  it("acknowledges unhandled event types without writing", async () => {
    const { res, setStatus } = newReqRes();
    const { firestore, captured } = fakeFirestore();
    const claims = vi.fn(async () => {});
    const event = {
      id: "evt_other",
      type: "customer.created",
      data: { object: {} },
    } as unknown as Stripe.Event;

    await handleStripeWebhook(
      mockReq({ signature: "sig", rawBody: Buffer.from("{}") }), res, env,
      { stripeClient: () => fakeStripe(() => event), firestore: () => firestore, setCustomUserClaims: claims });

    expect(setStatus).toHaveBeenCalledWith(200);
    expect(captured.sets).toHaveLength(0);
    expect(captured.updates).toHaveLength(0);
    expect(claims).not.toHaveBeenCalled();
  });
});
