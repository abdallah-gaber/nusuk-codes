import { describe, expect, it, vi } from "vitest";
import {
  HISTORY_KEY, SEASON, type Entry, type History, moveForward, newHistory,
  parseHistory, readHistory, restoreCurrent, writeHistory,
} from "./core";
import { getProgress } from "./discovery";

const entries: Entry[] = ["NG-aBcD0001", "NG-AbCd0002", "NG-Zzzz0003"].map((code) => ({
  code, status: "community_submitted_unverified", source: "facebook.com", observedAt: "2026-11-05",
}));
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
}
const progress = (h: History) => getProgress(entries, h);

describe("persistent current code", () => {
  it("marks the first display once, including repeated Strict Mode updater/effect calls", () => {
    const original = newHistory();
    const first = restoreCurrent(original, entries);
    expect(first.current).toBe(entries[0].code);
    expect(first.seen).toEqual([entries[0].code]);
    expect(original.seen).toEqual([]);
    expect(restoreCurrent(original, entries)).toEqual(first);
    expect(restoreCurrent(first, entries)).toBe(first);
    const storage = memory();
    // Before the feed arrives, saving the seed also keeps offline reset/import usable.
    writeHistory(storage, original);
    writeHistory(storage, original);
    writeHistory(storage, first);
    writeHistory(storage, first);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(readHistory(storage)).toEqual(first);
  });

  it("restores the exact code and counters through repeated refreshes and reopening", () => {
    const storage = memory();
    let state = restoreCurrent(newHistory(), entries);
    state = moveForward(state, state.current!, entries, "skipped").history;
    writeHistory(storage, state);
    const before = progress(state);
    for (let i = 0; i < 10; i++) {
      const reopened = restoreCurrent(readHistory(storage), [...entries].reverse());
      expect(reopened).toEqual(state);
      expect(progress(reopened)).toEqual(before);
      writeHistory(storage, reopened);
    }
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(readHistory(storage).current).toBe("NG-AbCd0002");
  });

  it.each(["next", "tried", "skipped"] as const)("%s advances and records the correct action once", (action) => {
    const initial = restoreCurrent(newHistory(), entries);
    const next = moveForward(initial, initial.current!, entries, action);
    expect(next.current).toBe(entries[1].code);
    expect(next.history.current).toBe(next.current);
    expect(next.history.seen).toEqual(entries.slice(0, 2).map((e) => e.code));
    expect(next.history.tried).toEqual(action === "tried" ? [entries[0].code] : []);
    expect(next.history.skipped).toEqual(action === "skipped" ? [entries[0].code] : []);
    expect(restoreCurrent(next.history, entries)).toBe(next.history);
    expect(restoreCurrent(parseHistory(JSON.stringify(next.history)), entries)).toEqual(next.history);
  });

  it("restores the full Undo state and persists that same code across refresh", () => {
    const storage = memory();
    const before = restoreCurrent(newHistory(), entries);
    const after = moveForward(before, before.current!, entries, "tried").history;
    writeHistory(storage, after);
    // The app's one-step Undo restores this saved history, including its cursor.
    writeHistory(storage, before);
    expect(restoreCurrent(readHistory(storage), entries)).toEqual(before);
    expect(progress(readHistory(storage))).toMatchObject({ seen: 1, tried: 0, skipped: 0 });
  });

  it("persists exhaustion without selecting or counting another code", () => {
    let state = restoreCurrent(newHistory(), entries);
    for (let i = 0; i < entries.length; i++)
      state = moveForward(state, state.current!, entries, "next").history;
    expect(state.current).toBeNull();
    expect(restoreCurrent(parseHistory(JSON.stringify(state)), entries)).toEqual(state);
    expect(progress(state)).toMatchObject({ seen: 3, remaining: 0 });
    const extended = [...entries, { ...entries[0], code: "NG-NEW00001" }];
    const updated = restoreCurrent(state, extended);
    expect(updated.current).toBe("NG-NEW00001");
    expect(updated.seen).toHaveLength(4);
    expect(restoreCurrent(updated, extended)).toBe(updated);
  });

  it("restores a fully seen large dataset without adding entries", () => {
    const large = Array.from({ length: 15000 }, (_, i) => ({ ...entries[0],
      code: `NG-L${String(i).padStart(7, "0")}` }));
    const history: History = { ...newHistory(), current: null, seen: large.map((e) => e.code) };
    expect(restoreCurrent(history, large)).toBe(history);
  });

  it("recovers a legacy v1 history's last available seen code without adding progress", () => {
    const legacy = { ...newHistory(), seen: entries.slice(0, 2).map((e) => e.code) };
    const restored = restoreCurrent(parseHistory(JSON.stringify(legacy)), entries);
    expect(restored).toEqual({ ...legacy, current: entries[1].code });
    expect(progress(restored)).toEqual(progress(legacy));
    expect(restored.version).toBe(1);
  });

  it.each([undefined, "bad", "NG-DELETED1", "NG-abcd0001", 42, {}])(
    "handles a missing, malformed, removed or wrong-case saved cursor (%s) without losing history",
    (current) => {
      const stored = { ...newHistory(), current, seen: [entries[0].code], tried: [entries[0].code] };
      const restored = restoreCurrent(parseHistory(JSON.stringify(stored)), entries);
      expect(restored.current).toBe(entries[0].code);
      expect(restored.seen).toEqual(stored.seen);
      expect(restored.tried).toEqual(stored.tried);
    },
  );

  it("does not trust an unseen cursor or display a removed code", () => {
    const h = { ...newHistory(), current: entries[1].code, seen: [entries[0].code] };
    expect(restoreCurrent(h, entries).current).toBe(entries[0].code);
    const removed = restoreCurrent({ ...h, current: entries[0].code }, entries.slice(1));
    expect(removed.current).toBe(entries[1].code);
    expect(removed.seen).toEqual([entries[0].code, entries[1].code]);
    expect(restoreCurrent(removed, entries.slice(1))).toBe(removed);
    const empty = restoreCurrent(h, []);
    expect(empty.current).toBeNull();
    expect(empty.seen).toEqual(h.seen);
  });

  it("isolates season-mismatched history and recovers corrupt storage", () => {
    const storage = memory();
    storage.setItem(HISTORY_KEY, JSON.stringify({ ...newHistory(), season: "old-season",
      current: entries[2].code, seen: [entries[2].code] }));
    const restored = restoreCurrent(readHistory(storage), entries);
    expect(restored.season).toBe(SEASON);
    expect(restored.current).toBe(entries[0].code);
    expect(restored.seen).toEqual([entries[0].code]);
    storage.setItem(HISTORY_KEY, "{broken");
    expect(readHistory(storage).seen).toEqual([]);
  });

  it("syncs current and counters in one v1 record and does not echo identical cross-tab writes", () => {
    const storage = memory();
    const first = restoreCurrent(newHistory(), entries);
    const otherTab = moveForward(first, first.current!, entries, "tried").history;
    writeHistory(storage, otherTab);
    const synced = restoreCurrent(parseHistory(storage.getItem(HISTORY_KEY)!), entries);
    expect(synced).toEqual(otherTab);
    writeHistory(storage, synced);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    // A legacy tab's update still retains all counters and restores its last display.
    const legacy: History = { ...otherTab };
    delete legacy.current;
    expect(restoreCurrent(parseHistory(JSON.stringify(legacy)), entries)).toEqual(otherTab);
  });

  it("keeps import-compatible v1 arrays and the local current code after a history merge", () => {
    const local = restoreCurrent(newHistory(), entries);
    const incoming = parseHistory(JSON.stringify({ ...newHistory(),
      seen: [entries[1].code], tried: [entries[1].code] }));
    const merged = { ...local, seen: [...new Set([...local.seen, ...incoming.seen])],
      tried: [...new Set([...local.tried, ...incoming.tried])],
      skipped: [...new Set([...local.skipped, ...incoming.skipped])] };
    expect(restoreCurrent(merged, entries)).toBe(merged);
    expect(merged.current).toBe(local.current);
    expect(progress(merged)).toMatchObject({ seen: 2, tried: 1 });
    const reset = restoreCurrent(newHistory(), entries);
    expect(progress(reset)).toMatchObject({ seen: 1, tried: 0, skipped: 0 });
  });

  it("keeps an idempotent in-memory selection when storage is blocked or full", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); } };
    const state = restoreCurrent(readHistory(blocked), entries);
    expect(() => writeHistory(blocked, state)).toThrow("blocked");
    expect(restoreCurrent(state, entries)).toBe(state);
    const full = memory();
    full.setItem.mockImplementation(() => { throw new Error("quota"); });
    expect(() => writeHistory(full, state)).toThrow("quota");
    expect(moveForward(state, state.current!, entries, "next").current).toBe(entries[1].code);
  });
});
