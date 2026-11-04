export const SEASON = "nov-2026";
export const HISTORY_KEY = `nusuk:history:${SEASON}:v1`;
export type Entry = {
  code: string;
  status: "community_submitted_unverified";
  source: string;
  observedAt: string;
};
export type History = {
  version: 1;
  season: string;
  seed: number;
  seen: string[];
  tried: string[];
  skipped: string[];
};
export type Manifest = {
  schemaVersion: number;
  season: string;
  generatedAt: string;
  codeCount: number;
  snapshotUrl: string;
  snapshotSha256: string;
  readOnly: boolean;
  submissionsEnabled: boolean;
  candidatePreview: boolean;
  maintenance: boolean;
};
export type Feed = { manifest: Manifest; codes: Entry[]; cached: boolean };
export const officialUrl = (code: string) =>
  `https://services.nusuk.sa/app?p=27&id=${encodeURIComponent(code)}`;
export const newHistory = (): History => ({
  version: 1,
  season: SEASON,
  seed: crypto.getRandomValues(new Uint32Array(1))[0],
  seen: [],
  tried: [],
  skipped: [],
});
export function parseHistory(raw: string): History {
  const h = JSON.parse(raw);
  if (
    h.version !== 1 ||
    h.season !== SEASON ||
    !Number.isInteger(h.seed) ||
    h.seed < 0 ||
    h.seed > 4294967295 ||
    !["seen", "tried", "skipped"].every(
      (k) =>
        Array.isArray(h[k]) &&
        h[k].length <= 100000 &&
        h[k].every(
          (s: unknown) =>
            typeof s === "string" && /^NG-[A-Za-z0-9]{8}$/.test(s),
        ),
    )
  )
    throw new Error("ملف سجل غير صالح أو من موسم مختلف");
  return {
    ...h,
    seen: [...new Set<string>(h.seen)],
    tried: [...new Set<string>(h.tried)],
    skipped: [...new Set<string>(h.skipped)],
  };
}
export function shuffled<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function validateManifest(m: Manifest) {
  if (
    m.schemaVersion !== 1 ||
    m.season !== SEASON ||
    !/^\/data\/codes\.[a-f0-9]{16}\.json$/.test(m.snapshotUrl) ||
    !/^[a-f0-9]{64}$/.test(m.snapshotSha256) ||
    !Number.isInteger(m.codeCount) ||
    m.codeCount < 0 ||
    m.codeCount > 15_000 ||
    !Number.isFinite(Date.parse(m.generatedAt)) ||
    typeof m.readOnly !== "boolean" ||
    m.candidatePreview !== true
  )
    throw new Error("بيانات الموسم غير متوافقة");
}
export async function verifySnapshot(
  manifest: Manifest,
  raw: string,
): Promise<Entry[]> {
  validateManifest(manifest);
  if (raw.length > 4000000) throw new Error("ملف البيانات أكبر من المسموح");
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== manifest.snapshotSha256)
    throw new Error("تعذر التأكد من سلامة ملف البيانات");
  const data = JSON.parse(raw);
  if (
    data.schemaVersion !== 1 ||
    data.season !== SEASON ||
    !Array.isArray(data.codes) ||
    data.codes.length !== manifest.codeCount ||
    new Set(data.codes.map((c: Entry) => c.code)).size !== data.codes.length ||
    !data.codes.every(
      (c: Entry) =>
        /^NG-[A-Za-z0-9]{8}$/.test(c.code) &&
        c.status === "community_submitted_unverified" &&
        [
          "facebook.com",
          "services.nusuk.sa",
          "script.google.com",
          "hisham-nusuk.hisham-nusuk.workers.dev",
        ].includes(c.source) &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.observedAt) &&
        Number.isFinite(Date.parse(`${c.observedAt}T00:00:00Z`)) &&
        new Date(`${c.observedAt}T00:00:00Z`).toISOString().slice(0, 10) ===
          c.observedAt,
    )
  )
    throw new Error("ملف الأكواد غير متوافق");
  return data.codes;
}
const CACHE_KEY = "nusuk:last-good:v1";
export async function loadFeed(): Promise<Feed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("/data/manifest.json", {
      signal: controller.signal,
      cache: "no-cache",
    });
    if (!response.ok) throw new Error("manifest");
    const manifest: Manifest = await response.json();
    validateManifest(manifest);
    const res = await fetch(manifest.snapshotUrl, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("snapshot");
    const raw = await res.text();
    const codes = await verifySnapshot(manifest, raw);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ manifest, raw }));
    } catch {
      /* Browsing works without persistent storage. */
    }
    return { manifest, codes, cached: false };
  } catch {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (saved)
        return {
          manifest: saved.manifest,
          codes: await verifySnapshot(saved.manifest, saved.raw),
          cached: true,
        };
    } catch {
      /* Never use an invalid cached snapshot. */
    }
    throw new Error("تعذر تحميل الأكواد. اتأكد من اتصالك وجرب تاني.");
  } finally {
    clearTimeout(timeout);
  }
}
export function moveForward(
  history: History,
  current: string | undefined,
  order: Entry[],
  action: "next" | "tried" | "skipped",
) {
  const next = order.find((entry) => !history.seen.includes(entry.code));
  return {
    current: next?.code,
    history: {
      ...history,
      seen: next ? [...history.seen, next.code] : history.seen,
      ...(action !== "next" && current
        ? { [action]: [...new Set([...history[action], current])] }
        : {}),
    },
  };
}
