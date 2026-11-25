import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { CodeList } from "./CodeList";
import { OfficialAppIntro, CreatorSupport } from "./CommunityLinks";
import { getProgress } from "./discovery";
import { formatDate, formatSeason } from "./presentation";
import { LocaleProvider, LanguageSelector, useLocale } from "./LocaleProvider";
import { LocalizedError, type TranslationKey } from "./i18n";
import { analytics, productionTracking, trackingEnvironment, sanitizedAnalyticsUrl } from "./analytics";
import { AnalyticsPreferences, AnalyticsPreferencesLink, useAnalyticsConsent } from "./AnalyticsPreferences";
import { ConsentBanner } from "./ConsentBanner";
import { copyText } from "./clipboard";
import { shareWebsite, whatsappUrl } from "./sharing";

const Winners = __WINNERS_ENABLED__ ? lazy(() => import("./winners/Winners")) : null;

function initialHistory() {
  try {
    return readHistory(localStorage);
  } catch {
    return newHistory();
  }
}
function App() {
  const { language, locale, t, n } = useLocale();
  const { consent, choose } = useAnalyticsConsent();
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
  const codeControls = useRef<HTMLDivElement>(null);
  const viewedLocales = useRef(new Set<string>());
  const helpSummary = useRef<HTMLElement>(null);
  const [codeNotice, setCodeNotice] = useState<TranslationKey | "">("");
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
          setCodeNotice("");
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
  useEffect(() => {
    if (!codeNotice) return;
    const timer = setTimeout(() => setCodeNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [codeNotice]);
  const entry = feed?.codes.find((e) => e.code === history.current);
  const current = entry?.code;
  const browserReady = !loading && !error && !!current;
  useEffect(() => {
    const target = codeControls.current;
    if (!browserReady || !target || consent !== "granted" || !analytics.eligible ||
        viewedLocales.current.has(language) || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 1 || document.hidden) return;
      viewedLocales.current.add(language);
      analytics.track("code_browser_view", { locale: language });
      observer.disconnect();
    }, { threshold: 1 });
    const watch = () => {
      observer.disconnect();
      if (!document.hidden && !viewedLocales.current.has(language)) observer.observe(target);
    };
    watch();
    document.addEventListener("visibilitychange", watch);
    return () => {
      document.removeEventListener("visibilitychange", watch);
      observer.disconnect();
    };
  }, [browserReady, consent, language]);
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
    setCodeNotice(
      action === "tried"
        ? "triedNotice"
        : action === "skipped"
          ? "skippedNotice"
          : "nextNotice",
    );
    requestAnimationFrame(() => codeFocus.current?.focus());
  }
  async function copy(text: string, message: TranslationKey, source: "browser" | "search" | "creator" = "browser") {
    const showNotice = source === "browser" ? setCodeNotice : setNotice;
    try {
      await copyText(text);
      analytics.track("copy_code", { locale: language, source });
      showNotice(message);
    } catch {
      showNotice("copyFailed");
    }
  }
  async function share() {
    try {
      const method = await shareWebsite(language, t("brand"), t("shareText"), {
        share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
        copy: copyText,
      });
      analytics.track("share_website", { locale: language, share_method: method });
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
  function undoButton() {
    return (
      <button disabled={!undo} onClick={() => {
        if (!undo) return;
        if (undoAction.current === "tried") analytics.track("undo_tried", { locale: language });
        undoAction.current = undefined;
        setHistory(undo);
        setUndo(undefined);
        setCodeNotice("undoNotice");
        requestAnimationFrame(() => codeFocus.current?.focus());
      }}>{t("undo")}</button>
    );
  }
  return (
    <>
      <a className="skip-link" href="#browser">
        {t("skipToCodes")}</a>
      <header className="header">
        <a className="brand" href="#">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <h1>{t("brand")}</h1>
        </a>
        <nav aria-label={t("siteSettings")}>
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
            <span aria-hidden="true">{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</span>
          </button>
          <AnalyticsPreferencesLink />
        </nav>
      </header>
      <main>
        {Winners && <div className="winners-slot">
          <Suspense fallback={null}><Winners now={now} /></Suspense>
        </div>}
        <section id="browser" className="code-card" aria-labelledby="browser-title" tabIndex={-1}>
          <h2 id="browser-title">{t("communityCodes")}</h2>
          {loading ? (
            <div className="state" role="status">
              <div className="skeleton" />
              <p>{t("loadingCodes")}</p>
            </div>
          ) : error ? (
            <div className="state">
              <h3>{t("connectionTitle")}</h3>
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
              <h3>{t("emptyCodes")}</h3>
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
              <h3>{t("exhaustedTitle")}</h3>
              <p>{t("exhaustedHelp")}</p>
              <button className="primary" onClick={() => setReset(true)}>
                {t("newRound")}</button>
            </div>
          ) : (
            <>
              <div className="code-controls" ref={codeControls}>
                <h3 ref={codeFocus} tabIndex={-1} dir="ltr" className="code">
                  {current}
                </h3>
                <div className="browse-actions">
                  <button className="primary copy-code" onClick={() => void copy(current, "codeCopied")}>
                    {t("copy")}
                  </button>
                  <button className="secondary next-code" onClick={() => advance("next")}>
                    {t("nextCode")}
                  </button>
                </div>
              </div>
              <div className="local-actions">
                <button onClick={() => advance("tried")}>{t("tried")}</button>
                <button onClick={() => advance("skipped")}>{t("skip")}</button>
                {undoButton()}
              </div>
              <a
                className="official-action"
                aria-describedby="official-help"
                href={officialUrl(current)} onClick={() => analytics.track("open_nusuk", { locale: language, source: "browser" })}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("officialLink")} <span aria-hidden="true">↗</span>
                <span className="sr-only"> {t("newWindow")}</span>
              </a>
              <p id="official-help" className="official-help">{t("officialHelp")}</p>
              <p className="code-notice" role="status">{codeNotice && t(codeNotice)}</p>
            </>
          )}
          {!browserReady && undo && <div className="local-actions">{undoButton()}</div>}
        </section>
        {(!online || feed?.cached || stale || storageWarning || feed?.manifest.maintenance) && (
          <div className="banner" role="status">
            {!online && <p>{t("offline")}</p>}
            {feed?.cached && <p>{t("cachedNotice")}</p>}
            {stale && <p>{t("staleNotice")}</p>}
            {storageWarning && <p>{t("storageWarning")}</p>}
            {feed?.manifest.maintenance && <p>{t("maintenance")}</p>}
          </div>
        )}
        <details className="progress-card" onToggle={(event) => {
          if (event.currentTarget.open) analytics.track("secondary_feature_open", { locale: language, feature: "progress" });
        }}>
          <summary>
            <strong>{t("yourJourney")}</strong>
            {feed && <span className="progress-count">{n(progress.remaining)} {t("remaining")}</span>}
          </summary>
          <div className="progress-panel">
            <p>{t("localHistory")} {t("progressDisclaimer")}</p>
            <p className="progress-summary">
              {t("progressReadout", { seen: n(progress.seen), total: n(progress.total), percent: percentage })}
            </p>
            <progress aria-label={t("progressLabel")}
              value={progress.seen} max={progress.total || 1} />
            <div className="local-counts">
              <span>{t("tried")} <b>{n(progress.tried)}</b></span>
              <span>{t("skipped")} <b>{n(progress.skipped)}</b></span>
            </div>
            <h3>{t("manageHistory")}</h3>
            <div className="history-actions">
              <button onClick={exportHistory}>{t("exportHistory")}</button>
              <button onClick={() => file.current?.click()}>{t("importHistory")}</button>
              <button onClick={() => setReset(true)}>{t("resetHistory")}</button>
            </div>
            <input ref={file} hidden type="file" accept="application/json,.json"
              onChange={(e) => void importHistory(e.target.files?.[0])} />
            <p>{t("privacyNote")}</p>
          </div>
        </details>
        <CodeList entries={feed?.codes || []} history={history} loading={loading} error={!!error}
          onCopy={(code) => void copy(code, "listCopied", "search")} />
        {analytics.eligible && !consent && <ConsentBanner onChoose={(value) => {
          choose(value);
          helpSummary.current?.focus({ preventScroll: true });
        }} />}
        <details id="how" className="how" onToggle={(event) => {
          if (event.currentTarget.open) analytics.track("secondary_feature_open", { locale: language, feature: "help" });
        }}>
          <summary ref={helpSummary}><h2>{t("howNav")}</h2></summary>
          <div className="help-panel">
            <ol className="steps">
              {[
                [t("step1Title"), t("step1Body")],
                [t("step2Title"), t("step2Body")],
                [t("step3Title"), t("step3Body")],
              ].map(([title, text]) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
            <OfficialAppIntro />
          </div>
        </details>
        <div className="freshness">
          <p>{feed ? formatSeason(feed.manifest.season, language) : loading ? t("seasonLoading") : t("seasonUnavailable")}</p>
          <p>{feed?.cached ? t("cachedDate") : t("releaseDate")}: {formatDate(feed?.manifest.generatedAt, language)}</p>
          <a href="#sources">{t("sourceNav")}</a>
        </div>
        <section id="sources" className="source-box">
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
          <a href={whatsappUrl(language, t("shareText"))} target="_blank" rel="noopener noreferrer">{t("shareWhatsApp")} <span className="sr-only">{t("newWindow")}</span></a></div>
        </section>
        <CreatorSupport consent={consent} onCopy={(code) => void copy(code, "creatorCopied", "creator")} />
        <AnalyticsPreferences consent={consent} onChoose={choose} />
      </main>
      <footer>
        <a className="brand" href="#">
          {t("footerBrand")}</a>
        <p>
          {t("footerDisclaimer")}<br />
          {t("footerPrivacy")}</p>
        <nav className="footer-nav" aria-label={t("navigation")}>
          <a href="#browser">{t("browseCodes")}</a>
          <a href="#how" onClick={() => {
            const help = document.getElementById("how") as HTMLDetailsElement;
            help.open = true;
          }}>{t("howNav")}</a>
          <a href="#faq">{t("faqNav")}</a>
        </nav>
      </footer>
      <div className="toast" role="status">
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
              setCodeNotice("");
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
