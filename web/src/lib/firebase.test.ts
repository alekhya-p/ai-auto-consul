import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub firebase/app + firebase/auth before importing the module under
// test so the lazy singleton doesn't try to dial the real SDK.
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "test-app" })),
}));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ name: "test-auth" })),
}));

let firebaseConfigured: () => boolean;
let getFirebaseApp: () => unknown;

async function reload() {
  vi.resetModules();
  const mod = await import("./firebase");
  firebaseConfigured = mod.firebaseConfigured;
  getFirebaseApp = mod.getFirebaseApp;
}

const ORIGINAL_ENV = { ...import.meta.env };

afterEach(() => {
  const env = import.meta.env as unknown as Record<string, unknown>;
  for (const k of Object.keys(env)) {
    if (k.startsWith("VITE_FIREBASE_")) delete env[k];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) env[k] = v;
});

describe("firebase config detection", () => {
  beforeEach(async () => {
    await reload();
  });

  it("reports not configured when env vars are missing", () => {
    expect(firebaseConfigured()).toBe(false);
    expect(getFirebaseApp()).toBeNull();
  });

  it("reports configured when the required env vars are present", async () => {
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_API_KEY = "fake-key";
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = "auto-consul.firebaseapp.com";
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_PROJECT_ID = "auto-consul";
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_APP_ID = "1:123:web:abc";
    await reload();

    expect(firebaseConfigured()).toBe(true);
    expect(getFirebaseApp()).not.toBeNull();
  });

  it("treats partial config (missing app id) as not configured", async () => {
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_API_KEY = "fake-key";
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = "auto-consul.firebaseapp.com";
    // @ts-expect-error stub env
    import.meta.env.VITE_FIREBASE_PROJECT_ID = "auto-consul";
    await reload();

    expect(firebaseConfigured()).toBe(false);
  });
});
