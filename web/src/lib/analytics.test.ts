import { beforeEach, describe, expect, it, vi } from "vitest";

const { logEvent, getAnalytics, setUserId, setUserProperties } = vi.hoisted(() => ({
  logEvent: vi.fn(),
  getAnalytics: vi.fn(() => ({})),
  setUserId: vi.fn(),
  setUserProperties: vi.fn(),
}));

vi.mock("firebase/analytics", () => ({ logEvent, getAnalytics, setUserId, setUserProperties }));

vi.mock("./firebase", () => ({
  getFirebaseApp: () => ({ name: "test-app" }),
  analyticsConfigured: () => true,
}));

import { setAnalyticsConsent, track } from "./analytics";

beforeEach(() => {
  logEvent.mockClear();
  getAnalytics.mockClear();
  setAnalyticsConsent(false); // reset module consent state
});

describe("analytics consent gate", () => {
  it("does not init or log before consent", () => {
    track("chat_opened", { has_plate: true });
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs after consent is granted", () => {
    setAnalyticsConsent(true);
    track("chat_opened", { has_plate: true });
    expect(logEvent).toHaveBeenCalledWith(expect.anything(), "chat_opened", { has_plate: true });
  });

  it("stops logging after consent is withdrawn", () => {
    setAnalyticsConsent(true);
    setAnalyticsConsent(false);
    track("login", { method: "password" });
    expect(logEvent).not.toHaveBeenCalled();
  });
});
