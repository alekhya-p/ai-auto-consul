import { describe, expect, it } from "vitest";
import { prettyPlate } from "./voertuigCache";

describe("prettyPlate", () => {
  // Covers every Dutch sidecode shape we expect to see in the wild.
  it.each([
    // sidecode 1 - LL-DD-DD
    ["AB1234", "AB-12-34"],
    // sidecode 2 - DD-DD-LL
    ["1234AB", "12-34-AB"],
    // sidecode 3 - DD-LL-DD
    ["12AB34", "12-AB-34"],
    // sidecode 4 - LL-DD-LL
    ["AB12CD", "AB-12-CD"],
    // sidecode 5 - LL-LL-DD
    ["ABCD12", "AB-CD-12"],
    // sidecode 6 - DD-LL-LL
    ["12ABCD", "12-AB-CD"],
    // sidecode 7 - DD-LLL-D
    ["20TRF4", "20-TRF-4"],
    // sidecode 8 - D-LLL-DD
    ["1ABC23", "1-ABC-23"],
    // sidecode 9 - LL-DDD-L
    ["A898CD", "A-898-CD"],
    // sidecode 10 - L-DDD-LL
    ["J640HX", "J-640-HX"],
  ])("formats %s as %s", (input, expected) => {
    expect(prettyPlate(input)).toBe(expected);
  });

  it("accepts pre-hyphenated input and re-formats correctly", () => {
    expect(prettyPlate("j-640-ht")).toBe("J-640-HT");
    expect(prettyPlate("20-trf-4")).toBe("20-TRF-4");
  });

  it("falls back to the raw normalised input when not 3 alternating runs", () => {
    expect(prettyPlate("ABCDEF")).toBe("ABCDEF");
    expect(prettyPlate("123456")).toBe("123456");
    expect(prettyPlate("AB12CD34")).toBe("AB12CD34");
  });
});
