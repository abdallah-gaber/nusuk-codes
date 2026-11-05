import { useMemo, useState } from "react";
import type { Entry, History } from "./core";
import { filterCodes, type CodeFilter } from "./discovery";
import { useLocale } from "./LocaleProvider";

const PAGE_SIZE = 24;


export function CodeList({ entries, history, loading, error, onCopy }: {
  entries: readonly Entry[];
  history: History;
  loading: boolean;
  error: boolean;
  onCopy: (code: string) => void;
}) {
  const { t, n } = useLocale();
  const FILTERS: { value: CodeFilter; label: string }[] = [
    { value: "all", label: t("all") },
    { value: "unseen", label: t("unseen") },
    { value: "tried", label: t("tried") },
    { value: "skipped", label: t("skipped") },
  ];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CodeFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const matches = useMemo(
    () => open ? filterCodes(entries, history, query, filter) : [],
    [open, entries, history, query, filter],
  );
  const shown = matches.slice(0, limit);
  const empty = query.trim()
    ? t("noMatches")
    : !entries.length ? t("emptyList")
      : filter === "unseen" ? t("allSeen")
        : filter === "tried" ? t("noneTried")
          : t("noneSkipped");

  return (
    <details className="code-list" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="code-list-title">{t("searchTitle")}</span>
        <span className="code-list-subtitle">{t("searchSubtitle")}</span>
      </summary>
      {open && <div className="code-list-panel">
        <div role="search">
          <label htmlFor="code-search">{t("searchLabel")}</label>
          <input id="code-search" type="search" dir="ltr" placeholder="NG-…"
            value={query} maxLength={80} autoComplete="off" spellCheck={false}
            aria-describedby="code-list-help" aria-controls="code-results"
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} />
        </div>
        <p id="code-list-help">{t("searchHelp")}</p>
        <fieldset className="code-filters">
          <legend className="sr-only">{t("filterLabel")}</legend>
          {FILTERS.map((item) => <label key={item.value}>
            <input className="sr-only" type="radio" name="code-filter" value={item.value}
              checked={filter === item.value}
              onChange={() => { setFilter(item.value); setLimit(PAGE_SIZE); }} />
            <span>{item.label}</span>
          </label>)}
        </fieldset>
        <p className="code-list-count" role="status" aria-live="polite" aria-atomic="true">
          {loading ? t("listLoading") : error ? t("listError")
            : t("resultCount", { matches: n(matches.length), shown: n(shown.length) })}
        </p>
        <ul id="code-results" className="code-results" aria-label={t("searchResults")}>
          {!loading && !error && shown.map((entry) => <li key={entry.code}>
            <code dir="ltr">{entry.code}</code>
            <button type="button" aria-label={t("copyLabel", { code: entry.code })} onClick={() => onCopy(entry.code)}>{t("copy")}</button>
          </li>)}
        </ul>
        {!loading && !error && !shown.length && <p className="code-list-empty">{empty}</p>}
        {!loading && !error && matches.length > limit && <button className="load-more secondary"
          onClick={() => setLimit((value) => value + PAGE_SIZE)} aria-controls="code-results">
          {t("loadMore", { count: n(Math.min(PAGE_SIZE, matches.length - limit)) })}</button>}
        <p className="code-list-disclaimer">{t("listDisclaimer")}</p>
      </div>}
    </details>
  );
}
