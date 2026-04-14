import { describe, expect, it } from "vitest";

import { splitMessage, toISO8601 } from "../../src/output/utils.js";

describe("toISO8601", () => {
  it("converts JST timestamp (timezoneOffset: -540) to +09:00", () => {
    // Unix 0 = 1970-01-01T00:00:00Z; in JST (UTC+9) = 1970-01-01T09:00:00+09:00
    expect(toISO8601(0, -540)).toBe("1970-01-01T09:00:00+09:00");
  });

  it("converts UTC timestamp (timezoneOffset: 0) to +00:00", () => {
    expect(toISO8601(0, 0)).toBe("1970-01-01T00:00:00+00:00");
  });

  it("converts negative UTC offset (timezoneOffset: 300) to -05:00", () => {
    // timezoneOffset 300 → real offset = -300 min = -05:00
    // Unix 0 in UTC-5 = 1969-12-31T19:00:00-05:00
    expect(toISO8601(0, 300)).toBe("1969-12-31T19:00:00-05:00");
  });

  it("converts a known timestamp round-trip correctly", () => {
    // 2024-01-15T09:00:00+09:00 == 2024-01-15T00:00:00Z == Unix 1705276800
    expect(toISO8601(1705276800, -540)).toBe("2024-01-15T09:00:00+09:00");
  });
});

describe("splitMessage", () => {
  it("handles message with no body", () => {
    const { subject, body } = splitMessage("fix typo");
    expect(subject).toBe("fix typo");
    expect(body).toBe("");
  });

  it("handles message with a single-line body", () => {
    const { subject, body } = splitMessage("fix typo\n\nThis fixes a typo.");
    expect(subject).toBe("fix typo");
    expect(body).toBe("This fixes a typo.");
  });

  it("handles multi-paragraph body", () => {
    const { subject, body } = splitMessage(
      "feat: add feature\n\nFirst paragraph.\n\nSecond paragraph.",
    );
    expect(subject).toBe("feat: add feature");
    expect(body).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("trims trailing newlines from body", () => {
    const { subject, body } = splitMessage("commit msg\n\nbody line\n\n");
    expect(subject).toBe("commit msg");
    expect(body).toBe("body line");
  });
});
