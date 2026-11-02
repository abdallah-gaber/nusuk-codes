import type { Entry, History } from "./core";

export type CodeFilter = "all" | "unseen" | "tried" | "skipped";

// Derived views only: never write history, storage, or a network resource.
export function filterCodes(
  entries: readonly Entry[],
  history: History,
  query: string,
  filter: CodeFilter,
): Entry[] {
  const needle = query.trim().toLowerCase();
  const marked = new Set(
    filter === "unseen" ? history.seen : filter === "all" ? [] : history[filter],
  );
  return entries.filter(
    (entry) =>
      (!needle || entry.code.toLowerCase().includes(needle)) &&
      (filter === "all" ||
        (filter === "unseen" ? !marked.has(entry.code) : marked.has(entry.code))),
  );
}

export function getProgress(entries: readonly Entry[], history: History) {
  const codes = new Set(entries.map((entry) => entry.code));
  const count = (items: string[]) =>
    [...new Set(items)].filter((code) => codes.has(code)).length;
  const total = codes.size;
  const seen = count(history.seen);
  return {
    total,
    seen,
    remaining: total - seen,
    tried: count(history.tried),
    skipped: count(history.skipped),
    percentage: total ? (seen / total) * 100 : 0,
  };
}
