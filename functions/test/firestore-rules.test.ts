import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Tests the live firestore.rules file against the Firestore emulator.
 * Run with `npm run test:rules` (wraps firebase emulators:exec).
 */

const PROJECT_ID = "demo-auto-consul";
const RULES_PATH = resolve(__dirname, "../firestore.rules");

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (env) await env.cleanup();
});

beforeEach(async () => {
  if (env) await env.clearFirestore();
});

function alice() {
  return env.authenticatedContext("uid_alice", { firebase: { sign_in_provider: "google.com" } }).firestore();
}
function bob() {
  return env.authenticatedContext("uid_bob", { firebase: { sign_in_provider: "google.com" } }).firestore();
}
function anon() {
  return env.unauthenticatedContext().firestore();
}
function anonymousUser() {
  return env.authenticatedContext("uid_anon", { firebase: { sign_in_provider: "anonymous" } }).firestore();
}

// Helpers to bypass rules and seed initial documents - the same shape
// the agent's Admin SDK would produce.
async function seed(setup: (db: import("firebase/firestore").Firestore) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setup(ctx.firestore() as unknown as import("firebase/firestore").Firestore);
  });
}

describe("users/{uid}", () => {
  it("owner can read their own user doc", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice"), { uid: "uid_alice", displayName: "Alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "users/uid_alice")));
  });

  it("other users cannot read another user's doc", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice"), { uid: "uid_alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "users/uid_alice")));
  });

  it("self can update displayName / locale / persona", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice"), {
        uid: "uid_alice", displayName: "Alice", locale: "nl", persona: "A",
      });
    });
    const { doc, updateDoc } = await import("firebase/firestore");
    await assertSucceeds(updateDoc(doc(alice(), "users/uid_alice"), { displayName: "Alice B." }));
  });

  it("self cannot update money-touching fields like tier", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice"), { uid: "uid_alice", tier: "free" });
    });
    const { doc, updateDoc } = await import("firebase/firestore");
    await assertFails(updateDoc(doc(alice(), "users/uid_alice"), { tier: "pass" }));
  });

  it("anonymous (unauthenticated) cannot read user docs", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice"), { uid: "uid_alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(anon(), "users/uid_alice")));
  });
});

describe("users/{uid}/passes", () => {
  it("owner can read their passes", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice/passes/pass_1"),
          { passId: "pass_1", status: "ACTIVE" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "users/uid_alice/passes/pass_1")));
  });

  it("nobody (not even the owner) can write passes from the client", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "users/uid_alice/passes/pass_1"),
        { passId: "pass_1", credits: { remaining: 99 } }));
  });

  it("other users cannot read another user's passes", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice/passes/pass_1"), { passId: "pass_1" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "users/uid_alice/passes/pass_1")));
  });
});

describe("sessions/{sessionId}", () => {
  it("owner can read their own session", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "sessions/sess_1"), { sessionId: "sess_1", uid: "uid_alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "sessions/sess_1")));
  });

  it("another user cannot read someone else's session", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "sessions/sess_1"), { sessionId: "sess_1", uid: "uid_alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "sessions/sess_1")));
  });

  it("clients cannot write sessions directly", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "sessions/sess_X"),
        { sessionId: "sess_X", uid: "uid_alice" }));
  });

  it("owner can read turns under their session", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "sessions/sess_1"), { sessionId: "sess_1", uid: "uid_alice" });
      await setDoc(doc(db, "sessions/sess_1/turns/turn_a"),
          { turnId: "turn_a", role: "USER", content: "hi" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "sessions/sess_1/turns/turn_a")));
  });

  it("non-owner cannot read turns under someone else's session", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "sessions/sess_1"), { sessionId: "sess_1", uid: "uid_alice" });
      await setDoc(doc(db, "sessions/sess_1/turns/turn_a"),
          { turnId: "turn_a", role: "USER", content: "private" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "sessions/sess_1/turns/turn_a")));
  });
});

describe("dossiers/{vehicleId}", () => {
  it("anonymous visitor can read by id", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "dossiers/veh_123"), { vehicleId: "veh_123", make: "VW" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(anon(), "dossiers/veh_123")));
  });

  it("clients cannot write dossiers", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "dossiers/veh_999"), { vehicleId: "veh_999" }));
  });
});

describe("server-only collections reject all client access", () => {
  const blocked: Array<{ path: string; data?: Record<string, unknown> }> = [
    { path: "adk_sessions/key_X",   data: { sessionId: "X" } },
    { path: "vehicleCache/12AB345", data: { source: "rdw" } },
    { path: "events/evt_1",         data: { kind: "credit.debit" } },
    { path: "stripe_events/evt_2",  data: { sessionId: "cs_1" } },
    { path: "stripeCustomers/uid_alice", data: { customerId: "cus_X" } },
    { path: "idempotency/key_X",    data: { uid: "uid_alice" } },
    { path: "migrations/m_1",       data: { name: "0001" } },
  ];

  it.each(blocked)("$path: client read denied", async ({ path }) => {
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(alice(), path)));
  });

  it.each(blocked)("$path: client write denied", async ({ path, data }) => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), path), data ?? { x: 1 }));
  });
});

describe("featureFlags", () => {
  it("signed-in user can read flags", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "featureFlags/paid.autotelex"), { enabled: true });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "featureFlags/paid.autotelex")));
  });

  it("anonymous-Firebase user (signedIn) can also read flags", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "featureFlags/paid.autotelex"), { enabled: true });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(anonymousUser(), "featureFlags/paid.autotelex")));
  });

  it("unauthenticated cannot read flags", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "featureFlags/paid.autotelex"), { enabled: true });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(anon(), "featureFlags/paid.autotelex")));
  });

  it("clients cannot write flags", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "featureFlags/chat.global"), { enabled: false }));
  });
});

describe("vision_jobs/{jobId}", () => {
  it("owner can read their job", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "vision_jobs/job_1"),
          { jobId: "job_1", uid: "uid_alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "vision_jobs/job_1")));
  });

  it("non-owner cannot read someone else's job", async () => {
    await seed(async (db) => {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "vision_jobs/job_1"),
          { jobId: "job_1", uid: "uid_alice" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "vision_jobs/job_1")));
  });

  it("clients cannot write jobs", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "vision_jobs/job_X"),
        { jobId: "job_X", uid: "uid_alice" }));
  });
});

describe("users/{uid}/savedDossiers/{plate}", () => {
  it("owner can read their saved dossier", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice/savedDossiers/12AB345"),
          { plate: "12AB345", merk: "BMW" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "users/uid_alice/savedDossiers/12AB345")));
  });

  it("non-owner cannot read another user's saved dossier", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice/savedDossiers/12AB345"),
          { plate: "12AB345" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "users/uid_alice/savedDossiers/12AB345")));
  });

  it("clients cannot write saved dossiers (server-only)", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "users/uid_alice/savedDossiers/12AB345"),
        { plate: "12AB345" }));
  });
});

describe("users/{uid}/dailyCounters/{dateKey}", () => {
  it("owner can read their counter to show 'X / 5 used today'", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice/dailyCounters/2026-05-16"),
          { rdwLookups: 3 });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertSucceeds(getDoc(doc(alice(), "users/uid_alice/dailyCounters/2026-05-16")));
  });

  it("non-owner cannot read counters", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "users/uid_alice/dailyCounters/2026-05-16"),
          { rdwLookups: 1 });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(bob(), "users/uid_alice/dailyCounters/2026-05-16")));
  });

  it("clients cannot write counters (server-only)", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "users/uid_alice/dailyCounters/2026-05-16"),
        { rdwLookups: 1 }));
  });
});

describe("credit_events/{eventId}", () => {
  it("clients cannot read credit events (use /v1/credits/history)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "credit_events/ev_1"),
          { uid: "uid_alice", cost: 1, toolName: "autotelex.fetch" });
    });
    const { doc, getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(alice(), "credit_events/ev_1")));
  });

  it("clients cannot write credit events", async () => {
    const { doc, setDoc } = await import("firebase/firestore");
    await assertFails(setDoc(doc(alice(), "credit_events/ev_X"),
        { uid: "uid_alice", cost: 1 }));
  });
});

describe("default deny", () => {
  it("an unknown collection rejects all access", async () => {
    const { doc, getDoc, setDoc } = await import("firebase/firestore");
    await assertFails(getDoc(doc(alice(), "unspecced_collection/x")));
    await assertFails(setDoc(doc(alice(), "unspecced_collection/x"), { y: 1 }));
  });
});
