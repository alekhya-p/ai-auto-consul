import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithEmailMock: vi.fn(),
  createUserMock: vi.fn(),
  signInWithPopupMock: vi.fn(),
  signOutMock: vi.fn(),
  fakeAuth: {
    currentUser: null as { uid: string; getIdToken?: () => Promise<string> } | null,
  },
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(() => ({ providerId: "google.com" })),
  signInWithEmailAndPassword: mocks.signInWithEmailMock,
  createUserWithEmailAndPassword: mocks.createUserMock,
  signInWithPopup: mocks.signInWithPopupMock,
  signOut: mocks.signOutMock,
  onIdTokenChanged: vi.fn(() => () => {}),
}));
vi.mock("firebase/app-check", () => ({ getToken: vi.fn() }));

vi.mock("./firebase", () => ({
  appCheckConfigured: () => false,
  firebaseConfigured: () => true,
  getAppCheckClient: () => null,
  getFirebaseApp: () => ({ name: "test" }),
  getFirebaseAuth: () => mocks.fakeAuth,
}));

const {
  signInWithEmailMock,
  createUserMock,
  signInWithPopupMock,
  signOutMock,
  fakeAuth,
} = mocks;

import {
  AuthError,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrent,
  signUpWithEmail,
} from "./auth";

beforeEach(() => {
  signInWithEmailMock.mockReset();
  createUserMock.mockReset();
  signInWithPopupMock.mockReset();
  signOutMock.mockReset();
  fakeAuth.currentUser = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signInWithEmail", () => {
  it("returns the user on success", async () => {
    signInWithEmailMock.mockResolvedValue({ user: { uid: "u1" } });
    const user = await signInWithEmail("a@b.nl", "pw12345");
    expect(signInWithEmailMock).toHaveBeenCalledWith(fakeAuth, "a@b.nl", "pw12345");
    expect(user.uid).toBe("u1");
  });

  it("translates invalid-credential into AuthError(invalid_credentials)", async () => {
    signInWithEmailMock.mockRejectedValue({ code: "auth/invalid-credential" });
    await expect(signInWithEmail("a@b.nl", "wrong")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  });

  it("translates too-many-requests", async () => {
    signInWithEmailMock.mockRejectedValue({ code: "auth/too-many-requests" });
    await expect(signInWithEmail("a@b.nl", "pw")).rejects.toMatchObject({
      code: "too_many_requests",
    });
  });
});

describe("signUpWithEmail", () => {
  it("returns the user on success", async () => {
    createUserMock.mockResolvedValue({ user: { uid: "new" } });
    const user = await signUpWithEmail("new@b.nl", "pw12345");
    expect(createUserMock).toHaveBeenCalledWith(fakeAuth, "new@b.nl", "pw12345");
    expect(user.uid).toBe("new");
  });

  it("translates email-already-in-use", async () => {
    createUserMock.mockRejectedValue({ code: "auth/email-already-in-use" });
    await expect(signUpWithEmail("dup@b.nl", "pw12345")).rejects.toMatchObject({
      code: "email_in_use",
    });
  });

  it("translates weak-password", async () => {
    createUserMock.mockRejectedValue({ code: "auth/weak-password" });
    await expect(signUpWithEmail("a@b.nl", "x")).rejects.toMatchObject({
      code: "weak_password",
    });
  });
});

describe("signInWithGoogle", () => {
  it("opens a popup and returns the user", async () => {
    signInWithPopupMock.mockResolvedValue({ user: { uid: "g1" } });
    const user = await signInWithGoogle();
    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    expect(user.uid).toBe("g1");
  });

  it("translates popup-blocked", async () => {
    signInWithPopupMock.mockRejectedValue({ code: "auth/popup-blocked" });
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: "popup_blocked" });
  });

  it("translates popup-closed-by-user", async () => {
    signInWithPopupMock.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: "popup_closed" });
  });
});

describe("signOutCurrent", () => {
  it("calls firebase signOut", async () => {
    fakeAuth.currentUser = { uid: "u1" };
    signOutMock.mockResolvedValue(undefined);
    await signOutCurrent();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});

describe("AuthError", () => {
  it("carries message + code", () => {
    const e = new AuthError("nope", "invalid_credentials");
    expect(e.code).toBe("invalid_credentials");
    expect(e.message).toBe("nope");
    expect(e).toBeInstanceOf(Error);
  });
});
