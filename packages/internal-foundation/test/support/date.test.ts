import { describe, expect, it } from "vitest";

import { formatUnixTimestampWithOffset } from "../../src/support/date.js";

describe("formatUnixTimestampWithOffset", () => {
  it("converts JST timestamp (timezoneOffset: 540) to +09:00", () => {
    // Unix 0 = 1970-01-01T00:00:00Z; in JST (UTC+9) = 1970-01-01T09:00:00+09:00
    expect(formatUnixTimestampWithOffset(0, 540)).toBe("1970-01-01T09:00:00+09:00");
  });

  it("converts UTC timestamp (timezoneOffset: 0) to +00:00", () => {
    expect(formatUnixTimestampWithOffset(0, 0)).toBe("1970-01-01T00:00:00+00:00");
  });

  it("converts negative UTC offset (timezoneOffset: -300) to -05:00", () => {
    // timezoneOffset 300 → real offset = -300 min = -05:00
    // Unix 0 in UTC-5 = 1969-12-31T19:00:00-05:00
    expect(formatUnixTimestampWithOffset(0, -300)).toBe("1969-12-31T19:00:00-05:00");
  });

  it("converts a known timestamp round-trip correctly", () => {
    // 2024-01-15T09:00:00+09:00 == 2024-01-15T00:00:00Z == Unix 1705276800
    expect(formatUnixTimestampWithOffset(1705276800, 540)).toBe("2024-01-15T09:00:00+09:00");
  });

  it("formats a sub-hour offset correctly (IST +05:30, timezoneOffset: 330)", () => {
    // IST is UTC+5:30; in isomorphic-git convention timezoneOffset = -330 (negated).
    // Unix 0 in IST = 1970-01-01T05:30:00+05:30
    expect(formatUnixTimestampWithOffset(0, 330)).toBe("1970-01-01T05:30:00+05:30");
  });
});
