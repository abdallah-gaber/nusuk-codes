import { useMemo, useState } from "react";
import type { Entry, History } from "./core";
import { filterCodes, type CodeFilter } from "./discovery";

const PAGE_SIZE = 24;
const FILTERS: { value: CodeFilter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "unseen", label: "لم أشاهدها" },
  { value: "tried", label: "جرّبت" },
  { value: "skipped", label: "تخطّيت" },
];

export function CodeList({ entries, history, loading, error, onCopy }: {
  entries: readonly Entry[];
  history: History;
  loading: boolean;
  error: boolean;
  onCopy: (code: string) => void;
}) {
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
    ? "مفيش أكواد مطابقة. جرّب جزءًا من الكود أو غيّر التصفية."
    : !entries.length ? "لا توجد أكواد في القائمة حاليًا."
      : filter === "unseen" ? "شاهدت كل الأكواد في القائمة. تقدر تراجع «الكل»."
        : filter === "tried" ? "لسه ما علّمتش أي كود كـ«جرّبت»."
          : "مفيش أكواد متخطّية في سجلك.";

  return (
    <details className="code-list" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="code-list-title">ابحث في الأكواد</span>
        <span className="code-list-subtitle">بحث وتصفية القائمة</span>
      </summary>
      {open && <div className="code-list-panel">
        <div role="search">
          <label htmlFor="code-search">ابحث عن كود</label>
          <input id="code-search" type="search" dir="ltr" placeholder="NG-…"
            value={query} maxLength={80} autoComplete="off" spellCheck={false}
            aria-describedby="code-list-help" aria-controls="code-results"
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} />
        </div>
        <p id="code-list-help">بحث محلي في القائمة المحمّلة. النسخ هنا لا يسجّل مشاهدة أو تجربة.</p>
        <fieldset className="code-filters">
          <legend className="sr-only">تصفية الأكواد</legend>
          {FILTERS.map((item) => <label key={item.value}>
            <input className="sr-only" type="radio" name="code-filter" value={item.value}
              checked={filter === item.value}
              onChange={() => { setFilter(item.value); setLimit(PAGE_SIZE); }} />
            <span>{item.label}</span>
          </label>)}
        </fieldset>
        <p className="code-list-count" role="status" aria-live="polite" aria-atomic="true">
          {loading ? "جارٍ تحميل القائمة…" : error ? "القائمة غير متاحة حاليًا. استخدم زر إعادة المحاولة بالأعلى."
            : `النتائج: ${matches.length.toLocaleString("ar-EG")} · المعروض: ${shown.length.toLocaleString("ar-EG")}`}
        </p>
        <ul id="code-results" className="code-results" aria-label="نتائج البحث">
          {!loading && !error && shown.map((entry) => <li key={entry.code}>
            <code dir="ltr">{entry.code}</code>
            <button type="button" aria-label={`نسخ ${entry.code}`} onClick={() => onCopy(entry.code)}>نسخ</button>
          </li>)}
        </ul>
        {!loading && !error && !shown.length && <p className="code-list-empty">{empty}</p>}
        {!loading && !error && matches.length > limit && <button className="load-more secondary"
          onClick={() => setLimit((value) => value + PAGE_SIZE)} aria-controls="code-results">
          عرض {Math.min(PAGE_SIZE, matches.length - limit).toLocaleString("ar-EG")} كود إضافي
        </button>}
        <p className="code-list-disclaimer">أكواد مجتمعية غير متحقق من تفعيلها داخل نسك.</p>
      </div>}
    </details>
  );
}
