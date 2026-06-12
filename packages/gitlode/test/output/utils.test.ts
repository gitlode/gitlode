import { describe, expect, it } from "vitest";

import { formatSessionTimestamp } from "../../src/output/utils.js";

describe("formatSessionTimestamp", () => {
  it("formats Unix epoch as 19700101T000000Z", () => {
    expect(formatSessionTimestamp(new Date(0))).toBe("19700101T000000Z");
  });

  it("truncates milliseconds (second precision only)", () => {
    // 500ms past epoch should still produce the same second as epoch
    expect(formatSessionTimestamp(new Date(500))).toBe("19700101T000000Z");
  });

  it("formats a known UTC datetime correctly", () => {
    // 2024-01-15T09:05:00Z
    const d = new Date("2024-01-15T09:05:00Z");
    expect(formatSessionTimestamp(d)).toBe("20240115T090500Z");
  });

  it("always uses UTC regardless of local timezone", () => {
    // 2024-06-01T00:00:00Z — UTC midnight
    const d = new Date("2024-06-01T00:00:00Z");
    expect(formatSessionTimestamp(d)).toBe("20240601T000000Z");
  });
});
