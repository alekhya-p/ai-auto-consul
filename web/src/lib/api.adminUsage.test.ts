import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  fetchIdToken: vi.fn().mockResolvedValue("tok"),
  fetchAppCheckToken: vi.fn().mockResolvedValue(null),
}));

import { getAdminUsage } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getAdminUsage", () => {
  it("calls /v1/admin/usage with the days param and returns the report", async () => {
    const report = {
      totals: { events: 5, credits: 2, turns: 2, uniqueUsers: 2, avgCreditsPerTurn: 1, avgToolsPerTurn: 1 },
      perTool: [], daily: [], cacheStats: [], aiStats: [], truncated: false,
    };
    const fetchMock = vi.fn(async () => jsonResponse(report));
    vi.stubGlobal("fetch", fetchMock);

    const r = await getAdminUsage(30);

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toContain("/v1/admin/usage?days=30");
    expect(r.totals.turns).toBe(2);
  });

  it("throws on a 403 (non-admin)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 403)));
    await expect(getAdminUsage(30)).rejects.toThrow();
  });
});
