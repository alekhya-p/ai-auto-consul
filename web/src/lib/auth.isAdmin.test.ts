import { describe, expect, it } from "vitest";

import { readAdmin } from "./auth";

describe("readAdmin", () => {
  it("is true only when the admin claim is exactly true", () => {
    expect(readAdmin({ admin: true })).toBe(true);
    expect(readAdmin({ admin: false })).toBe(false);
    expect(readAdmin({ admin: "true" })).toBe(false);
    expect(readAdmin({})).toBe(false);
    expect(readAdmin(null)).toBe(false);
    expect(readAdmin(undefined)).toBe(false);
  });
});
