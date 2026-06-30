import { afterEach, describe, expect, it, vi } from "vitest";

// Spy on the auth getters before importing the API client.
vi.mock("./auth", () => ({
  fetchIdToken: vi.fn(),
  fetchAppCheckToken: vi.fn(),
}));

import { lookupRdw } from "./api";
import { fetchAppCheckToken, fetchIdToken } from "./auth";

const mockedFetchIdToken = fetchIdToken as unknown as ReturnType<typeof vi.fn>;
const mockedFetchAppCheckToken =
  fetchAppCheckToken as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
  mockedFetchIdToken.mockReset();
  mockedFetchAppCheckToken.mockReset();
});

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

describe("authedFetch wiring", () => {
  it("attaches Authorization: Bearer <idToken> when available", async () => {
    mockedFetchIdToken.mockResolvedValue("eyJ-fake-id-token");
    mockedFetchAppCheckToken.mockResolvedValue(null);
    const fetchMock = vi.fn(async () =>
      jsonResponse({ kenteken: "12AB345", found: false }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await lookupRdw("12-AB-345");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = new Headers(calls[0][1].headers);
    expect(headers.get("Authorization")).toBe("Bearer eyJ-fake-id-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("omits Authorization when no ID token is available", async () => {
    mockedFetchIdToken.mockResolvedValue(null);
    mockedFetchAppCheckToken.mockResolvedValue(null);
    const fetchMock = vi.fn(async () => jsonResponse({ kenteken: "12AB345", found: false }));
    vi.stubGlobal("fetch", fetchMock);

    await lookupRdw("12-AB-345");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = new Headers(calls[0][1].headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("refreshes the token per request (called for each fetch)", async () => {
    mockedFetchIdToken
      .mockResolvedValueOnce("token-a")
      .mockResolvedValueOnce("token-b");
    mockedFetchAppCheckToken.mockResolvedValue(null);
    const fetchMock = vi.fn(async () => jsonResponse({ kenteken: "12AB345", found: false }));
    vi.stubGlobal("fetch", fetchMock);

    await lookupRdw("11-AA-11");
    await lookupRdw("22-BB-22");

    expect(mockedFetchIdToken).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(new Headers(calls[0][1].headers).get("Authorization")).toBe("Bearer token-a");
    expect(new Headers(calls[1][1].headers).get("Authorization")).toBe("Bearer token-b");
  });

  it("attaches X-Firebase-AppCheck when an App Check token is available", async () => {
    mockedFetchIdToken.mockResolvedValue(null);
    mockedFetchAppCheckToken.mockResolvedValue("appcheck-token-xyz");
    const fetchMock = vi.fn(async () =>
      jsonResponse({ kenteken: "12AB345", found: false }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await lookupRdw("12-AB-345");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = new Headers(calls[0][1].headers);
    expect(headers.get("X-Firebase-AppCheck")).toBe("appcheck-token-xyz");
    expect(headers.has("Authorization")).toBe(false);
  });

  it("attaches both bearer and app-check headers when both are available", async () => {
    mockedFetchIdToken.mockResolvedValue("id-tok");
    mockedFetchAppCheckToken.mockResolvedValue("ac-tok");
    const fetchMock = vi.fn(async () => jsonResponse({ kenteken: "12AB345", found: false }));
    vi.stubGlobal("fetch", fetchMock);

    await lookupRdw("12-AB-345");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = new Headers(calls[0][1].headers);
    expect(headers.get("Authorization")).toBe("Bearer id-tok");
    expect(headers.get("X-Firebase-AppCheck")).toBe("ac-tok");
  });

  it("omits X-Firebase-AppCheck when no App Check token is available", async () => {
    mockedFetchIdToken.mockResolvedValue("id-tok");
    mockedFetchAppCheckToken.mockResolvedValue(null);
    const fetchMock = vi.fn(async () => jsonResponse({ kenteken: "12AB345", found: false }));
    vi.stubGlobal("fetch", fetchMock);

    await lookupRdw("12-AB-345");

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = new Headers(calls[0][1].headers);
    expect(headers.has("X-Firebase-AppCheck")).toBe(false);
  });
});
