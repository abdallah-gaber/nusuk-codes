import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import {
  HISTORY_KEY,
  SEASON,
  loadFeed,
  moveForward,
  newHistory,
  officialUrl,
  parseHistory,
  readHistory,
  restoreCurrent,
  writeHistory,
  shuffled,
  type Feed,
  type History,
} from "./core";
import "./style.css";
import { TipsTicker } from "./TipsTicker";
import { CodeList } from "./CodeList";
import { OfficialAppIntro, CreatorSupport } from "./CommunityLinks";
import { getProgress } from "./discovery";
import { formatDate, formatSeason } from "./presentation";
import { LocaleProvider, LanguageSelector, useLocale } from "./LocaleProvider";
import { LocalizedError, type TranslationKey } from "./i18n";
import { analytics, productionTracking, trackingEnvironment, sanitizedAnalyticsUrl } from "./analytics";
import { AnalyticsPreferences, AnalyticsPreferencesLink } from "./AnalyticsPreferences";
import { copyText } from "./clipboard";
import { shareWebsite, whatsappUrl } from "./sharing";

function initialHistory() {
  try {
    return readHistory(localStorage);
  } catch {
    return newHistory();
  }
}
function App() {
  const { language, locale, dir, t, n } = useLocale();
  const [history, setHistory] = useState<History>(initialHistory);
  const [now, setNow] = useState(Date.now);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState<TranslationKey | "">("");
  const [loading, setLoading] = useState(true);
  const [undo, setUndo] = useState<History>();
  const undoAction = useRef<"next" | "skipped" | "tried" | undefined>(undefined);
  const [notice, setNotice] = useState<TranslationKey | "">("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("nusuk:theme") || "system";
    } catch {
      return "system";
    }
  });
  const [reset, setReset] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelReset = useRef<HTMLButtonElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const codeFocus = useRef<HTMLHeadingElement>(null);
  const order = useMemo(
    () => shuffled(feed?.codes || [], history.seed),
    [feed, history.seed],
  );
  async function reload() {
    setLoading(true);
    setError("");
    try {
      setFeed(await loadFeed());
    } catch (e) {
      setError(e instanceof LocalizedError ? e.key : "loadError");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    if (feed && restoreCurrent(history, order) !== history) return;
    try {
      writeHistory(localStorage, history);
    } catch {
      setStorageWarning(true);
    }
  }, [history, feed, order]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nusuk:theme", theme);
    } catch {
      /* Theme remains available in memory. */
    }
  }, [theme]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === HISTORY_KEY) {
        try {
          setHistory(e.newValue ? parseHistory(e.newValue) : newHistory());
          setUndo(undefined);
          setNotice("historySynced");
        } catch {
          setStorageWarning(true);
        }
      }
    };
    const net = () => setOnline(navigator.onLine);
    window.addEventListener("storage", sync);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, []);
  useEffect(() => {
    if (feed) setHistory((h) => restoreCurrent(h, order));
  }, [feed, order, history]);
  useEffect(() => {
    if (reset) {
      dialog.current?.showModal();
      cancelReset.current?.focus();
    } else dialog.current?.close();
  }, [reset]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const entry = feed?.codes.find((e) => e.code === history.current);
  const current = entry?.code;
  const progress = useMemo(
    () => getProgress(feed?.codes || [], history),
    [feed, history],
  );
  const percentage = progress.percentage > 0 && progress.percentage < 0.1
    ? t("tinyProgress")
    : (Math.min(progress.percentage, progress.remaining ? 99.9 : 100) / 100).toLocaleString(locale, { style: "percent", maximumFractionDigits: 1 });
  function advance(action: "next" | "skipped" | "tried") {
    setUndo(history);
    undoAction.current = action;
    const next = moveForward(history, current, order, action);
    setHistory(next.history);
    if (action === "tried") analytics.track("mark_tried", { locale: language });
    else if (action === "skipped") analytics.track("skip_code", { locale: language });
    else if (next.current) analytics.track("next_code", { locale: language });
    setNotice(
      action === "tried"
        ? "triedNotice"
        : action === "skipped"
          ? "skippedNotice"
          : "nextNotice",
    );
    requestAnimationFrame(() => codeFocus.current?.focus());
  }
  async function copy(text: string, message: TranslationKey, source: "browser" | "search" | "creator" = "browser") {
    try {
      await copyText(text);
      analytics.track("copy_code", { locale: language, source });
      setNotice(message);
    } catch {
      setNotice("copyFailed");
    }
  }
  async function share() {
    analytics.track("share_website", { locale: language, share_method: typeof navigator.share === "function" ? "native" : "clipboard" });
    try {
      const method = await shareWebsite(language, t("brand"), t("shareText"), {
        share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
        copy: copyText,
      });
      if (method === "clipboard") setNotice("siteCopied");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNotice("shareFailed");
    }
  }
  function exportHistory() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(history, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nusuk-history-${SEASON}.json`;
    a.click();
    analytics.track("history_export", { locale: language });
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importHistory(f?: File) {
    if (!f) return;
    try {
      if (f.size > 2000000) throw new LocalizedError("fileTooLarge");
      const h = parseHistory(await f.text());
      setHistory((old) => ({
        ...old,
        seen: [...new Set([...old.seen, ...h.seen])],
        tried: [...new Set([...old.tried, ...h.tried])],
        skipped: [...new Set([...old.skipped, ...h.skipped])],
      }));
      setUndo(undefined);
      setNotice("historyImported");
      analytics.track("history_import", { locale: language });
    } catch (e) {
      setNotice(e instanceof LocalizedError ? e.key : "invalidHistory");
    }
    if (file.current) file.current.value = "";
  }
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const stale =
    feed && now - Date.parse(feed.manifest.generatedAt) > 7 * 86400000;
  return (
    <>
      <a className="skip-link" href="#browser">
        {t("skipToCodes")}</a>
      <header className="header">
        <a className="brand" href="#">
          <span className="brand-mark">✦</span>
          <div>
            <h1 className="brand-title">{t("brand")}</h1>
            <small>{t("tagline")}</small>
          </div>
        </a>
        <nav aria-label={t("navigation")}>
          <a href="#how">{t("howNav")}</a>
          <a href="#faq">{t("faqNav")}</a>
          <AnalyticsPreferencesLink />
          <LanguageSelector />
          <button
            className="icon-button"
            aria-label={`${t("changeTheme")}: ${t(theme === "system" ? "themeSystem" : theme === "dark" ? "themeDark" : "themeLight")}`}
            onClick={() =>
              setTheme(
                theme === "system"
                  ? "dark"
                  : theme === "dark"
                    ? "light"
                    : "system",
              )
            }
          >
            {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
            <span className="theme-label">
              {theme === "system"
                ? t("themeSystem")
                : theme === "dark"
                  ? t("themeDark")
                  : t("themeLight")}
            </span>
          </button>
        </nav>
      </header>
      <main>
        <div className="season-bar">
          <span>{t("independent")}</span>
          <span>{feed ? formatSeason(feed.manifest.season, language) : loading ? t("seasonLoading") : t("seasonUnavailable")}</span>
        </div>
        <OfficialAppIntro />
        <TipsTicker />
        {(!online || feed?.cached || stale || storageWarning) && (
          <div className="banner" role="status">
            {!online ? t("offline") : ""}
            {feed?.cached
              ? t("cachedNotice")
              : ""}
            {stale
              ? t("staleNotice")
              : ""}
            {storageWarning
              ? t("storageWarning")
              : ""}
          </div>
        )}
        {feed?.manifest.maintenance && (
          <div className="banner">
            {t("maintenance")}</div>
        )}
        <section
          id="browser"
          className="browse-layout"
          aria-label={t("browseCodes")}
        >
          <div className="code-card">
            <div className="card-top">
              <span>
                <span className="dot" /> {t("communityCodes")}</span>
              <span className="badge">{t("unverified")}</span>
            </div>
            {loading ? (
              <div className="state" role="status">
                <div className="skeleton" />
                <p>{t("loadingCodes")}</p>
              </div>
            ) : error ? (
              <div className="state">
                <h2>{t("connectionTitle")}</h2>
                <p>{error && t(error)}</p>
                <button className="primary" onClick={() => void reload()}>
                  {t("retry")}</button>
                <a
                  href={"https://services.nusuk.sa/app"} onClick={() => analytics.track("open_nusuk", { locale: language, source: "error" })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("openOfficial")}</a>
              </div>
            ) : !order.length ? (
              <div className="state">
                <h2>{t("emptyCodes")}</h2>
                <p>{t("emptyHelp")}</p>
                <a
                  href={"https://services.nusuk.sa/app"} onClick={() => analytics.track("open_nusuk", { locale: language, source: "empty" })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("openOfficialAlt")}</a>
              </div>
            ) : !current ? (
              <div className="state">
                <span className="state-symbol">✓</span>
                <h2>{t("exhaustedTitle")}</h2>
                <p>{t("exhaustedHelp")}</p>
                <button className="primary" onClick={() => setReset(true)}>
                  {t("newRound")}</button>
              </div>
            ) : (
              <>
                <div className="code-area">
                  <p className="mini-label">{t("codeIntro")}</p>
                  <h2 ref={codeFocus} tabIndex={-1} dir="ltr" className="code">
                    {current}
                  </h2>
                  <span className="code-caption">
                    {t("caseSensitive")}</span>
                </div>
                <div className="browse-actions">
                  <button
                    className="primary copy-code"
                    onClick={() =>
                      void copy(
                        current,
                        "codeCopied",
                      )
                    }
                  >
                    <span aria-hidden="true">▣</span> {t("copyCode")}</button>
                  <button
                    className="secondary next-code"
                    onClick={() => advance("next")}
                  >
                    {t("nextCode")}<span aria-hidden="true">{dir === "rtl" ? "←" : "→"}</span>
                  </button>
                  <div className="local-actions">
                    <button onClick={() => advance("skipped")}>{t("skip")}</button>
                    <button onClick={() => advance("tried")}>
                      {t("markTried")}</button>
                  </div>
                </div>
                <p className="manual-flow">
                  {t("manualFlow")}</p>
                <div className="official-action">
                  <a
                    href={officialUrl(current)} onClick={() => analytics.track("open_nusuk", { locale: language, source: "browser" })}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-describedby="official-link-help"
                  >
                    {t("officialLink")}<span aria-hidden="true">↗</span>
                  </a>
                  <p id="official-link-help">
                    {t("officialHelp")}</p>
                </div>
              </>
            )}
            <div className="card-bottom">
              <span>{t("noRepeat")}</span>
              <button
                disabled={!undo}
                onClick={() => {
                  if (undo) {
                    if (undoAction.current === "tried") analytics.track("undo_tried", { locale: language });
                    undoAction.current = undefined;
                    setHistory(undo);
                    setUndo(undefined);
                    setNotice("undoNotice");
                  }
                }}
              >
                {t("undo")}</button>
            </div>
          </div>
          <aside className="progress-card">
            <span className="mini-label">{t("stepByStep")}</span>
            <h2>{t("yourJourney")}</h2>
            <p>
              {t("localHistory")}<br />
              {t("progressDisclaimer")}</p>
            <div className="progress-summary">
              <span>{t("total")}{" "}<b>{progress.total.toLocaleString(locale)}</b> {t("codeUnit")}</span>
              <strong>{percentage}</strong>
            </div>
            <progress
              aria-label={t("progressLabel")}
              aria-valuetext={t("progressReadout", { seen: n(progress.seen), total: n(progress.total), percent: percentage })}
              value={progress.seen}
              max={progress.total || 1}
            />
            <div className="stats">
              <div>
                <strong>{progress.remaining.toLocaleString(locale)}</strong>
                <span>{t("remaining")}</span>
              </div>
              <div>
                <strong>{progress.seen.toLocaleString(locale)}</strong>
                <span>{t("seen")}</span>
              </div>
            </div>
            <div className="local-counts">
              <span>{t("tried")}<b>{progress.tried.toLocaleString(locale)}</b></span>
              <span>
                {t("skipped")}<b>{progress.skipped.toLocaleString(locale)}</b>
              </span>
            </div>
            <details>
              <summary>{t("manageHistory")}</summary>
              <div className="history-actions">
                <button onClick={exportHistory}>{t("exportHistory")}</button>
                <button onClick={() => file.current?.click()}>
                  {t("importHistory")}</button>
                <button onClick={() => setReset(true)}>{t("resetHistory")}</button>
              </div>
            </details>
            <input
              ref={file}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(e) => void importHistory(e.target.files?.[0])}
            />
            <div className="privacy-note">
              {t("privacyNote")}</div>
          </aside>
        </section>
        <CodeList entries={feed?.codes || []} history={history} loading={loading} error={!!error}
          onCopy={(code) => void copy(code, "listCopied", "search")} />
        <div className="freshness">
          <span>
            ◷ {feed?.cached ? t("cachedDate") : t("releaseDate")}:{" "}
            {formatDate(feed?.manifest.generatedAt, language)} ·{" "}
            {feed ? feed.codes.length.toLocaleString(locale) : "—"} {t("candidateUnit")}</span>
          <a href="#sources">{t("sourceNav")}</a>
        </div>
        <section id="how" className="how">
          <div className="section-heading">
            <span className="mini-label">{t("simply")}</span>
            <h2>{t("howTitle")}</h2>
          </div>
          <div className="steps">
            {[
              [
                "01",
                t("step1Title"),
                t("step1Body"),
              ],
              [
                "02",
                t("step2Title"),
                t("step2Body"),
              ],
              [
                "03",
                t("step3Title"),
                t("step3Body"),
              ],
            ].map(([n, title, text]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="sources" className="source-box">
          <span className="source-icon" aria-hidden="true">
            ◇
          </span>
          <div>
            <h2>{t("transparencyTitle")}</h2>
            <p>
              {t("transparencyBody")}</p>
            {entry && (
              <p className="source-detail">
                {t("observedSource")}{" "}<bdi dir="ltr">{entry.source}</bdi> {t("observedDate")}{" "}
                {formatDate(`${entry.observedAt}T00:00:00Z`, language)}
              </p>
            )}
            <p className="source-detail">
              {t("sourceDisclaimer")}</p>
          </div>
        </section>
        <section id="faq" className="faq">
          <h2>{t("faqTitle")}</h2>
          {[
            [
              t("faq1Question"),
              t("faq1Answer"),
            ],
            [
              t("faq2Question"),
              t("faq2Answer"),
            ],
            [
              t("faq3Question"),
              t("faq3Answer"),
            ],
            [
              t("faq4Question"),
              t("faq4Answer"),
            ],
            [
              t("faq5Question"),
              t("faq5Answer"),
            ],
            [
              t("faq6Question"),
              t("faq6Answer"),
            ],
          ].map(([q, a], index) => (
            <details key={index}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="closing">
          <span aria-hidden="true">✦</span>
          <h2>{t("continueNusuk")}</h2>
          <p>{t("officialTerms")}</p>
          <a
            className="primary"
            href={"https://services.nusuk.sa/app"} onClick={() => analytics.track("open_nusuk", { locale: language, source: "footer" })}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("openOfficial")}</a>
          <div className="share-actions"><button onClick={() => void share()}>{t("shareSite")}</button>
          <a href={whatsappUrl(language, t("shareText"))} target="_blank" rel="noopener noreferrer" onClick={() => analytics.track("share_website", { locale: language, share_method: "whatsapp" })}>{t("shareWhatsApp")} <span className="sr-only">{t("newWindow")}</span></a></div>
        </section>
        <CreatorSupport onCopy={(code) => void copy(code, "creatorCopied", "creator")} />
        <AnalyticsPreferences />
      </main>
      <footer>
        <a className="brand" href="#">
          {t("footerBrand")}</a>
        <p>
          {t("footerDisclaimer")}<br />
          {t("footerPrivacy")}</p>
        <span>{t("madeTogether")}</span>
      </footer>
      <div className="toast" role="status" aria-live="polite" key={notice}>
        {notice && t(notice)}
      </div>
      <dialog
        aria-labelledby="reset-heading"
        ref={dialog}
        onCancel={() => setReset(false)}
        onClose={() => setReset(false)}
      >
        <h2 id="reset-heading">{t("resetTitle")}</h2>
        <p>
          {t("resetHelp")}</p>
        <div className="main-actions">
          <button
            className="primary"
            onClick={() => {
              setHistory(newHistory());
              setUndo(undefined);
              setReset(false);
              setNotice("resetNotice");
            }}
          >
            {t("confirmReset")}</button>
          <button
            className="secondary"
            ref={cancelReset}
            onClick={() => setReset(false)}
          >
            {t("cancel")}</button>
        </div>
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
      {productionTracking(trackingEnvironment) && <Analytics beforeSend={(event) => ({ ...event, url: sanitizedAnalyticsUrl(event.url) })} />}
    </LocaleProvider>
  </React.StrictMode>,
);
