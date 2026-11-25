import { describe, expect, it } from "vitest";
import archive from "./data.json";
import { isRamadanWinner, orderedWinners, validateWinners, type Winner } from "./data";

const first: Winner = {
  id: "winner-0001",
  displayName: "  اسم الاختبار  ",
  prize: "umrah",
  country: "EG",
  announcedOn: "2026-11-05",
  winnerOrdinal: 1,
  announcementUrl: "https://x.com/MyNusuk/status/1",
  verifiedAt: "2026-11-06T04:00:00Z",
};

const second: Winner = {
  id: "winner-0002",
  displayName: "Archive fixture",
  prize: "umrah",
  announcedOn: "2026-11-06",
  announcementUrl: "https://www.facebook.com/MyNusuk/posts/2",
  verifiedAt: "2026-11-06T04:00:00Z",
};

const campaign = {
  startsOn: "2026-11-21",
  endsOn: "2026-11-30",
  announcementUrl: "https://x.com/MyNusuk/status/3",
};

const review = (records: unknown[]) => ({
  schemaVersion: 1,
  presentationEnabled: true,
  updatedAt: "2026-11-06T05:00:00Z",
  ramadanUmrah: campaign,
  records,
});

describe("winners archive", () => {
  it("validates the checked-in dataset", () => {
    expect(validateWinners(archive)).toEqual(archive);
  });

  it("requires at least one reviewed record before presentation can be enabled", () => {
    const empty = { ...review([]), presentationEnabled: false, updatedAt: null };
    expect(validateWinners(empty)).toEqual(empty);
    expect(() => validateWinners({ ...empty, presentationEnabled: true })).toThrow();
    expect(() => validateWinners({ ...review([first]), updatedAt: null })).toThrow();
    expect(validateWinners({ ...review([first]), presentationEnabled: false }).records).toEqual([first]);
  });

  it("preserves the display name and allows unknown country, announcement date and winner number", () => {
    const undated = { ...second, announcedOn: null };
    expect(validateWinners(review([first, undated])).records).toEqual([first, undated]);
  });

  it.each([
    { id: "" }, { displayName: "" }, { country: "ZZ" }, { country: "eg" }, { prize: "other" },
    { winnerOrdinal: 2.5 }, { winnerOrdinal: 0 }, { winnerOrdinal: "2" }, { passportNumber: "private" },
    { announcedOn: "2026-11-31" }, { announcedOn: "2026-11-07" },
    { verifiedAt: "2026-11-06" }, { verifiedAt: "2026-11-06T05:01:00Z" },
    { announcementUrl: "javascript:alert(1)" }, { announcementUrl: "http://x.com/MyNusuk/status/1" },
    { announcementUrl: "https://x.com/MyNusuk" }, { announcementUrl: "https://x.com/other/status/1" },
    { announcementUrl: "https://x.com/MyNusuk/status/1?tracking=1" },
    { announcementUrl: "https://user@x.com/MyNusuk/status/1" },
    { announcementUrl: "https://x.com.example.com/MyNusuk/status/1" },
  ])("rejects invalid record fields %o", (invalid) => {
    expect(() => validateWinners(review([{ ...first, ...invalid }]))).toThrow();
  });

  it("uses the Saudi calendar date for the announcement-to-verification comparison", () => {
    const latePost = { ...first, announcedOn: "2026-11-06", verifiedAt: "2026-11-05T22:00:00Z" };
    expect(validateWinners(review([latePost])).records).toHaveLength(1);
  });

  it("rejects repeated IDs, winner numbers and duplicate entries from alternate URLs", () => {
    expect(() => validateWinners(review([first, { ...second, id: first.id }]))).toThrow(/Duplicate winner ID/);
    expect(() => validateWinners(review([first, { ...second, winnerOrdinal: 1 }]))).toThrow(/Duplicate winner number/);
    expect(() => validateWinners(review([first, {
      ...first, id: second.id, announcementUrl: second.announcementUrl, winnerOrdinal: undefined,
    }]))).toThrow(/Possible duplicate winner/);
    expect(() => validateWinners(review([
      { ...first, announcedOn: null, winnerOrdinal: undefined },
      { ...first, announcedOn: null, winnerOrdinal: undefined, id: second.id, announcementUrl: "https://twitter.com/MyNusuk/status/1" },
    ]))).toThrow(/Possible duplicate winner/);
  });

  it("sorts newest first and keeps undated records accessible", () => {
    const undated: Winner = { ...second, id: "winner-0003", announcedOn: null };
    const sameDay: Winner = { ...first, id: "winner-0004", winnerOrdinal: 2 };
    const records = [first, undated, second, sameDay];
    expect(orderedWinners(records)).toEqual([second, sameDay, first, undated]);
    expect(records[0]).toBe(first);
  });

  it.each([
    { startsOn: "2026-11-31" }, { endsOn: "2026-11-20" }, { announcementUrl: "https://example.com" },
  ])("validates the campaign evidence and inclusive date range %o", (invalid) => {
    expect(() => validateWinners({ ...review([first]), ramadanUmrah: { ...campaign, ...invalid } })).toThrow();
  });

  it.each([
    ["2026-11-20", false], ["2026-11-21", true], ["2026-11-30", true], ["2026-12-01", false], [null, false],
  ] as const)("labels Ramadan winners by announcement date %s", (announcedOn, expected) => {
    expect(isRamadanWinner({ ...first, announcedOn, winnerOrdinal: 25 }, campaign)).toBe(expected);
    expect(isRamadanWinner({ ...first, announcedOn }, null)).toBe(false);
  });
});
