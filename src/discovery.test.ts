import { afterEach, describe, expect, it, vi } from "vitest";
import { moveForward, newHistory, parseHistory, type Entry, type History } from "./core";
import { filterCodes, getProgress } from "./discovery";

const entry = (code: string): Entry => ({
  code, status: "community_submitted_unverified", source: "facebook.com", observedAt: "2026-11-02",
});
const entries = [entry("NG-aBcD0001"), entry("NG-AbCd0002"), entry("NG-Zzzz0003")];
const history = (): History => ({ ...newHistory(), seen: [entries[0].code],
  tried: [entries[1].code], skipped: [entries[2].code] });

afterEach(() => vi.unstubAllGlobals());

describe("local code discovery", () => {
  it("searches case-insensitively without changing exact values used for copying", () => {
    const result = filterCodes(entries, history(), "  ng-ABcd  ", "all");
    expect(result.map((e) => e.code)).toEqual(["NG-aBcD0001", "NG-AbCd0002"]);
    expect(result[0]).toBe(entries[0]);
  });

  it("filters all, unseen, tried and skipped using the existing exact-case history", () => {
    const h = history();
    expect(filterCodes(entries, h, "", "all")).toEqual(entries);
    expect(filterCodes(entries, h, "", "unseen")).toEqual(entries.slice(1));
    expect(filterCodes(entries, h, "", "tried")).toEqual([entries[1]]);
    expect(filterCodes(entries, h, "", "skipped")).toEqual([entries[2]]);
    expect(filterCodes(entries, { ...h, seen: ["NG-AbCD0001"] }, "", "unseen")).toEqual(entries);
  });

  it("does not mutate history, reorder entries, write storage or fetch data", () => {
    const h = history();
    Object.freeze(h.seen); Object.freeze(h.tried); Object.freeze(h.skipped); Object.freeze(h);
    const frozen = Object.freeze([...entries]);
    const before = JSON.stringify(h);
    const fetcher = vi.fn(); const write = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("localStorage", { setItem: write });
    for (const filter of ["all", "unseen", "tried", "skipped"] as const) {
      filterCodes(frozen, h, "ng-", filter);
    }
    getProgress(frozen, h);
    expect(JSON.stringify(h)).toBe(before);
    expect(frozen).toEqual(entries);
    expect(fetcher).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
  });

  it("handles empty snapshots, empty annotations, no matches and exhausted unseen lists", () => {
    expect(filterCodes([], history(), "", "all")).toEqual([]);
    expect(filterCodes(entries, newHistory(), "", "tried")).toEqual([]);
    expect(filterCodes(entries, history(), "does-not-exist", "all")).toEqual([]);
    expect(filterCodes(entries, { ...newHistory(), seen: entries.map((e) => e.code) }, "", "unseen")).toEqual([]);
  });

  it("searches and derives progress for 10,000 codes with a large existing history", () => {
    const large = Array.from({ length: 10000 }, (_, i) => entry(`NG-X${String(i).padStart(7, "0")}`));
    const h = { ...newHistory(), seen: large.slice(0, 9000).map((e) => e.code) };
    const result = filterCodes(large, h, "ng-x0009", "unseen");
    expect(result).toHaveLength(1000);
    expect(getProgress(large, h)).toMatchObject({ total: 10000, seen: 9000, remaining: 1000, percentage: 90 });
  });
});

describe("derived personal progress", () => {
  it("counts unique current-snapshot codes and leaves annotations independent of seen", () => {
    const h = { ...history(), seen: [entries[0].code, entries[0].code, "NG-OLD00001"],
      tried: [entries[1].code, entries[1].code], skipped: ["NG-OLD00001"] };
    expect(getProgress(entries, h)).toMatchObject({ total: 3, seen: 1, remaining: 2, tried: 1, skipped: 0 });
    expect(getProgress(entries, h).percentage).toBeCloseTo(100 / 3);
    expect(getProgress([], h)).toEqual({ total: 0, seen: 0, remaining: 0, tried: 0, skipped: 0, percentage: 0 });
  });

  it("follows Next, Skip, Tried and Undo without changing no-repeat transitions", () => {
    const initial = { ...newHistory(), seen: [entries[0].code] };
    const skipped = moveForward(initial, entries[0].code, entries, "skipped");
    expect(skipped.current).toBe(entries[1].code);
    expect(getProgress(entries, skipped.history)).toMatchObject({ seen: 2, remaining: 1, skipped: 1, tried: 0 });
    const tried = moveForward(skipped.history, skipped.current, entries, "tried");
    expect(tried.current).toBe(entries[2].code);
    expect(getProgress(entries, tried.history)).toMatchObject({ seen: 3, remaining: 0, tried: 1, skipped: 1, percentage: 100 });
    // Undo restores the saved history object, exactly as the main browser does.
    expect(getProgress(entries, skipped.history)).toMatchObject({ seen: 2, tried: 0, skipped: 1 });
    expect(moveForward(tried.history, tried.current, entries, "next").current).toBeUndefined();
  });

  it("reflects imported/cross-tab history and reset using the existing v1 format", () => {
    const incoming = parseHistory(JSON.stringify({ ...newHistory(),
      seen: [entries[0].code, entries[1].code], tried: [entries[0].code] }));
    expect(getProgress(entries, incoming)).toMatchObject({ seen: 2, remaining: 1, tried: 1 });
    expect(filterCodes(entries, incoming, "", "unseen")).toEqual([entries[2]]);
    const reset = newHistory();
    expect(getProgress(entries, reset)).toMatchObject({ seen: 0, remaining: 3, percentage: 0 });
    expect(filterCodes(entries, reset, "", "unseen")).toEqual(entries);
    // The unchanged display effect then marks the first main-browser code seen.
    expect(getProgress(entries, { ...reset, seen: [entries[0].code] }).seen).toBe(1);
    expect(incoming.version).toBe(1);
  });
});
