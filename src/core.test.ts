import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  HISTORY_KEY,
  SEASON,
  loadFeed,
  moveForward,
  newHistory,
  officialUrl,
  parseHistory,
  shuffled,
  validateManifest,
  verifySnapshot,
  type Manifest,
} from "./core";
const manifest = JSON.parse(
  readFileSync("admin/tests/fixtures/preview-manifest.json", "utf8"),
) as Manifest;
const raw = readFileSync(`public${manifest.snapshotUrl}`, "utf8");
afterEach(() => vi.unstubAllGlobals());
describe("candidate snapshot integrity", () => {
  it("preserves all exact-case candidates and contains no verified status", async () => {
    const codes = await verifySnapshot(manifest, raw);
    expect(codes).toHaveLength(1132);
    expect(codes[0].code).toBe("NG-dX626jFL");
    expect(
      codes.every((c) => c.status === "community_submitted_unverified"),
    ).toBe(true);
  });
  it("rejects tampering, a different season and unsafe paths", async () => {
    await expect(verifySnapshot(manifest, raw + " ")).rejects.toThrow();
    expect(() =>
      validateManifest({ ...manifest, season: "feb-2026" }),
    ).toThrow();
    expect(() =>
      validateManifest({
        ...manifest,
        snapshotUrl: "https://evil.example/data.json",
      }),
    ).toThrow();
  });
  it("uses an allowlisted official URL and preserves case", () =>
    expect(officialUrl("NG-dX626jFL")).toBe(
      "https://services.nusuk.sa/app?p=27&id=NG-dX626jFL",
    ));
});
describe("local browsing history", () => {
  it("serializes safely, dedupes exact case and scopes season", () => {
    const h = {
      ...newHistory(),
      seen: ["NG-dX626jFL", "NG-dX626jFL", "NG-dx626jFL"],
    };
    expect(parseHistory(JSON.stringify(h)).seen).toHaveLength(2);
    expect(() =>
      parseHistory(JSON.stringify({ ...h, season: "old" })),
    ).toThrow();
    expect(HISTORY_KEY).toContain(SEASON);
  });
  it("rejects untrusted imports", () => {
    expect(() => parseHistory("{")).toThrow();
    expect(() =>
      parseHistory(JSON.stringify({ ...newHistory(), seen: ["<script>"] })),
    ).toThrow();
  });
  it("shuffles every code once, repeatably for a browser seed", () => {
    const items = Array.from({ length: 1132 }, (_, i) => i);
    const a = shuffled(items, 42);
    expect(a).toEqual(shuffled(items, 42));
    expect(a).not.toEqual(shuffled(items, 43));
    expect(new Set(a).size).toBe(1132);
    expect(items[0]).toBe(0);
  });
});
describe("CDN failure and cache fallback", () => {
  it("loads two CDN resources and caches only a checked snapshot", async () => {
    const map = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k),
      setItem: (k: string, v: string) => map.set(k, v),
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(new Response(raw));
    vi.stubGlobal("fetch", fetcher);
    const feed = await loadFeed();
    expect(feed.cached).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockRejectedValue(new Error("offline"));
    expect((await loadFeed()).cached).toBe(true);
  });
  it("fails gracefully without a cache and rejects corrupted cached data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ manifest, raw: raw + "bad" }),
    });
    await expect(loadFeed()).rejects.toThrow("تعذر تحميل");
  });
  it("works when storage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
        .mockResolvedValueOnce(new Response(raw)),
    );
    expect((await loadFeed()).codes).toHaveLength(1132);
  });
});

describe("explicit next, skip and tried transitions", () => {
  it("does not repeat seen codes, records separate annotations, and exhausts", async () => {
    const codes = (await verifySnapshot(manifest, raw)).slice(0, 3);
    let state = {
      history: { ...newHistory(), seen: [codes[0].code] },
      current: codes[0].code as string | undefined,
    };
    state = moveForward(state.history, state.current, codes, "skipped");
    expect(state.current).toBe(codes[1].code);
    expect(state.history.skipped).toEqual([codes[0].code]);
    state = moveForward(state.history, state.current, codes, "tried");
    expect(state.current).toBe(codes[2].code);
    expect(state.history.tried).toEqual([codes[1].code]);
    state = moveForward(state.history, state.current, codes, "next");
    expect(state.current).toBeUndefined();
    expect(state.history.seen).toHaveLength(3);
  });
});

describe("administrative snapshot compatibility", () => {
  it("accepts the currently checked-in feed without fixing its count or order", async () => {
    const live = JSON.parse(
      readFileSync("public/data/manifest.json", "utf8"),
    ) as Manifest;
    expect(
      await verifySnapshot(
        live,
        readFileSync(`public${live.snapshotUrl}`, "utf8"),
      ),
    ).toHaveLength(live.codeCount);
  });
  it("accepts deterministic Python-published records with new observation dates", async () => {
    const folder = mkdtempSync(join(tmpdir(), "nusuk-pipeline-"));
    try {
      const output = join(folder, "stage");
      execFileSync("python3", [
        "-c",
        "from pathlib import Path; import sys; from admin.publishing import stage; from admin.tests.test_pipeline import record; r=record(); r['discoveredAt']='2026-11-04T00:00:00Z'; stage([r],Path(sys.argv[1]))",
        output,
      ]);
      const published = JSON.parse(
        readFileSync(join(output, "manifest.json"), "utf8"),
      ) as Manifest;
      const entries = await verifySnapshot(
        published,
        readFileSync(
          join(output, published.snapshotUrl.split("/").pop()!),
          "utf8",
        ),
      );
      expect(entries[0].observedAt).toBe("2026-11-04");
      expect(entries[0].status).toBe("community_submitted_unverified");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
