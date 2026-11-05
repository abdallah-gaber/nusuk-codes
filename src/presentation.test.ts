import { describe, expect, it } from "vitest";
import { formatDate, formatSeason } from "./presentation";

describe("dataset labels", () => {
  it("derives month and year from the manifest identifier", () => {
    expect(formatSeason("nov-2026")).toBe("بيانات نوفمبر ٢٠٢٦");
    expect(formatSeason("feb-2027")).toBe("بيانات فبراير ٢٠٢٧");
  });
  it("does not invent season context while data is missing or malformed", () => {
    for (const value of [undefined, "", "active", "nov-2026-extra", "2026-11"]) {
      expect(formatSeason(value)).toBe("بيانات الموسم غير متاحة");
    }
  });
  it("uses the release timestamp in UTC instead of the device date", () => {
    expect(formatDate("2026-11-05T23:30:00-05:00")).toBe("٦ نوفمبر ٢٠٢٦");
    expect(formatDate("2026-11-05T09:30:53.263055Z")).toBe("٥ نوفمبر ٢٠٢٦");
  });
  it("preserves the original observation day and handles unavailable dates", () => {
    expect(formatDate("2026-11-01T00:00:00Z")).toBe("١ نوفمبر ٢٠٢٦");
    for (const value of [undefined, "", "invalid"]) {
      expect(formatDate(value)).toBe("غير متاح");
    }
  });
});
