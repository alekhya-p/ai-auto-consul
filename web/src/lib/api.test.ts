import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupRdw, LookupError } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupRdw", () => {
  it("posts the plate as JSON and returns the summary on 200", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          kenteken: "12AB345",
          found: true,
          make: "VOLKSWAGEN",
          model: "ID.3 Pro Performance",
          imported: false,
          apkValid: true,
          openRecall: false,
          liabilityInsured: true,
          exported: false,
          taxi: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const summary = await lookupRdw("12-AB-345");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe("/v1/lookup/rdw");
    expect(calls[0][1].method).toBe("POST");
    expect(new Headers(calls[0][1].headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(calls[0][1].body as string)).toEqual({ plate: "12-AB-345" });
    expect(summary.kenteken).toBe("12AB345");
    expect(summary.found).toBe(true);
  });

  it("throws a friendly LookupError on 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 400 })),
    );

    await expect(lookupRdw("!!@@##$$")).rejects.toMatchObject({
      message: expect.stringContaining("valid Dutch plate"),
      status: 400,
    });
  });

  it("throws a generic LookupError on other non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    await expect(lookupRdw("12AB345")).rejects.toBeInstanceOf(LookupError);
  });

  it("forwards an AbortSignal to fetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const ac = new AbortController();
    await lookupRdw("12AB345", ac.signal).catch(() => undefined);

    expect((fetchMock.mock.calls as unknown as [string, RequestInit][])[0][1].signal).toBe(ac.signal);
  });
});
