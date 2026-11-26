import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from "react";
import { useLocale } from "../LocaleProvider";
import { formatDate } from "../presentation";
import { archiveLabels } from "../archiveLabels";
import { isRamadanWinner, orderedWinners, type Winner, type WinnersArchive } from "./data";
import archive from "./data.json";
import { winnersLabels } from "./labels";
import "./winners.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const rotationMs = 8_000;
const weekMs = 7 * 86_400_000;
// The same input is validated before Vite builds the application.
const data = archive as WinnersArchive;
const history = orderedWinners(data.records);
const campaign = data.ramadanUmrah;
const newestDate = history[0]?.announcedOn;
const canRotate = history.length > 1;

type Direction = "newer" | "older";
type Celebration = "initial" | "automatic" | "manual";
type Interaction = "blocking" | "resumed" | null;
type WinnerView = { index: number; direction: Direction; previous?: number; celebration?: Celebration };

const confettiShapes = ["ribbon", "rectangle", "sparkle"] as const;
const confettiColors = ["#ffcf71", "#68dfae", "#fff0cb"] as const;
const confettiPieces = Array.from({ length: 32 }, (_, index) => ({
  shape: confettiShapes[index % confettiShapes.length],
  style: {
    "--piece-color": confettiColors[(index + Math.floor(index / 3)) % confettiColors.length],
    "--piece-x": `${(index + 0.3 + (index % 5) * 0.12) * 100 / 32}%`,
    "--piece-y": `${-14 + (index * 11) % 30}px`,
    "--piece-size": `${4 + index % 4}px`,
    "--piece-drift": `${(index * 17) % 49 - 24}px`,
    "--piece-fall": `${97 + (index * 19) % 67}px`,
    "--piece-spin": `${(index % 2 ? -1 : 1) * (135 + (index * 37) % 250)}deg`,
    "--piece-delay": `${(index * 13) % 8 * 50}ms`,
    "--piece-duration": `${2600 + index % 5 * 90}ms`,
  } as CSSProperties,
}));

const automaticPieces = confettiPieces.filter((_, index) => index % 3 !== 2);

function changeWinner(view: WinnerView, direction: Direction, celebration?: Celebration): WinnerView {
  const step = direction === "older" ? 1 : -1;
  return {
    index: (view.index + step + history.length) % history.length,
    previous: celebration ? view.index : undefined,
    direction,
    celebration,
  };
}

function WinnerCelebration({ kind }: { kind: Celebration }) {
  const [finished, setFinished] = useState(false);
  if (finished) return null;

  function finish(event: AnimationEvent<HTMLElement>) {
    if (event.target === event.currentTarget) setFinished(true);
  }

  if (kind === "manual") {
    return <span className="winners-manual-sparkle" aria-hidden="true" onAnimationEnd={finish}>✦</span>;
  }

  const automatic = kind === "automatic";
  return (
    <div className={automatic ? "winners-confetti winners-confetti--automatic" : "winners-confetti"}
      aria-hidden="true" onAnimationEnd={finish}>
      {(automatic ? automaticPieces : confettiPieces).map(({ shape, style }, index) => (
        <span className={`winners-confetti-piece winners-confetti-piece--${shape}`} style={style} key={index} />
      ))}
    </div>
  );
}

function flag(country: string) {
  return String.fromCodePoint(...[...country].map((letter) => letter.charCodeAt(0) + 127397));
}

function useWinnerPresentation() {
  const { language, locale, n } = useLocale();
  const labels = winnersLabels[language];
  const displayNames = new Intl.DisplayNames([locale], { type: "region" });

  function winnerNumber(record: Winner) {
    if (record.winnerOrdinal === undefined) return undefined;
    return labels.winnerNumber.replace("{number}", n(record.winnerOrdinal));
  }

  function winnerName(record: Winner) {
    const number = winnerNumber(record);
    return (
      <div className="winner-name">
        {number && <span className="winner-number">{number}</span>}
        <strong><bdi>{record.displayName}</bdi></strong>
      </div>
    );
  }

  function winnerDetails(record: Winner, compact = false) {
    const ramadan = isRamadanWinner(record, campaign);
    return (
      <span className="winner-meta">
        <span className={ramadan ? "winner-prize winner-prize--ramadan" : "winner-prize"}>
          {ramadan ? labels.ramadan : labels.umrah}
        </span>
        {record.country && <span>
          <span aria-hidden="true">{flag(record.country)} </span>{displayNames.of(record.country)}
        </span>}
        {record.announcedOn && <time dateTime={record.announcedOn}>{formatDate(record.announcedOn, language, compact ? "short" : "long")}</time>}
      </span>
    );
  }

  return { language, labels, winnerNumber, winnerName, winnerDetails };
}

function WinnerList({ records }: { records: readonly Winner[] }) {
  const { t } = useLocale();
  const { labels, winnerName, winnerDetails } = useWinnerPresentation();
  return (
    <ul role="list">
      {records.map((record) => <li key={record.id}>
        <div>
          {winnerName(record)}
          {winnerDetails(record)}
        </div>
        <a href={record.announcementUrl} target="_blank" rel="noopener noreferrer"
          aria-label={`${labels.source} · ${record.displayName} ${t("newWindow")}`}>
          {labels.source} <span aria-hidden="true">↗</span>
        </a>
      </li>)}
    </ul>
  );
}

const latestWinnerCount = 5;

export function ArchivedWinners() {
  const { language, n } = useLocale();
  const labels = archiveLabels[language];
  return (
    <>
      <h2 id="winners-history-title">{labels.winners} <span>{n(history.length)}</span></h2>
      {history.length ? <>
        <p>{winnersLabels[language].partial}</p>
        <WinnerList records={history.slice(0, latestWinnerCount)} />
        {history.length > latestWinnerCount && <details className="season-winners-more">
          <summary>
            <span className="season-winners-expand">{labels.viewAll}</span>
            <span className="season-winners-collapse">{labels.showFewer}</span>
          </summary>
          <WinnerList records={history.slice(latestWinnerCount)} />
        </details>}
      </> : <p>{labels.noWinners}</p>}
    </>
  );
}

export default function Winners({ now }: { now: number }) {
  const { t } = useLocale();
  const { language, labels, winnerNumber, winnerName, winnerDetails } = useWinnerPresentation();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia(motionQuery).matches);
  const [view, setView] = useState<WinnerView>({
    index: 0,
    direction: "older",
    celebration: reducedMotion ? undefined : "initial",
  });
  const [paused, setPaused] = useState(false);
  const [pointer, setPointer] = useState<Interaction>(null);
  const [focus, setFocus] = useState<Interaction>(null);
  const [open, setOpen] = useState(false);
  const [manualWinner, setManualWinner] = useState<Winner>();
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const archiveButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const preference = window.matchMedia(motionQuery);
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setView(({ index, direction }) => ({ index, direction }));
    };
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  const rotating = canRotate && !paused && pointer !== "blocking" && focus !== "blocking" && !open && !reducedMotion;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      setView((current) => changeWinner(current, "older", "automatic"));
    }, rotationMs);
    return () => window.clearTimeout(timer);
  }, [rotating, view.index]);

  if (!data.presentationEnabled || !history.length || !data.updatedAt) return null;

  const old = newestDate && now - Date.parse(newestDate) > weekMs;

  function toggleRotation() {
    setPaused(!paused);
    if (paused) {
      // Resume releases the current interaction. A new pointer entry or focus still pauses rotation.
      setPointer((current) => current === "blocking" ? "resumed" : current);
      setFocus((current) => current === "blocking" ? "resumed" : current);
    }
  }

  function navigate(direction: Direction) {
    const selected = changeWinner(view, direction, reducedMotion ? undefined : "manual");
    setView(selected);
    setPaused(true);
    setManualWinner(history[selected.index]);
  }

  const manualNumber = manualWinner && winnerNumber(manualWinner);
  return (
    <>
      <section className="winners-banner" aria-labelledby="winners-title"
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setPointer("blocking"); }}
        onPointerLeave={() => setPointer(null)} onFocus={() => setFocus("blocking")}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocus(null); }}>
        {!reducedMotion && view.celebration && <WinnerCelebration key={view.index} kind={view.celebration} />}
        <div className="winners-heading">
          <h2 id="winners-title" className="sr-only">{labels.title}</h2>
          <button type="button" className="winners-archive-button" ref={archiveButton}
            aria-haspopup="dialog" aria-controls="winners-history" onClick={() => {
              archiveDialog.current?.showModal();
              setOpen(true);
            }}>
            <svg className="winners-trophy" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3m-5 3v5m-4 0h8" />
            </svg>
            <span>{labels.allWinners}</span>
            <span aria-hidden="true">↗</span>
          </button>
          <div className="winners-actions">
            {canRotate && !reducedMotion && <button type="button" className="winners-pause"
              aria-label={paused ? labels.resume : labels.pause} onClick={toggleRotation}>
              <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
            </button>}
            {canRotate && <div className="winner-controls">
              <button type="button" aria-label={labels.newer} onClick={() => navigate("newer")}>
                <span className="winner-arrow" aria-hidden="true">‹</span>
              </button>
              <button type="button" aria-label={labels.older} onClick={() => navigate("older")}>
                <span className="winner-arrow" aria-hidden="true">›</span>
              </button>
            </div>}
          </div>
        </div>
        <div className="winners-slides" data-direction={view.direction} aria-live="off">
          {history.map((record, index) => (
            <div key={record.id} className="winners-slide"
              data-state={index === view.index ? (view.previous === undefined ? "initial" : "active") : index === view.previous ? "outgoing" : "inactive"}
              aria-hidden={index !== view.index}>
              {winnerName(record)}
              {winnerDetails(record, true)}
            </div>
          ))}
        </div>
        <p className="winners-encouragement">{labels.encouragement} <span aria-hidden="true">🤲</span></p>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {manualWinner && <>
            <bdi>{manualWinner.displayName}</bdi>{manualNumber && ` · ${manualNumber}`}
            {" · "}{isRamadanWinner(manualWinner, campaign) ? labels.ramadan : labels.umrah}
          </>}
        </span>
      </section>
      <dialog id="winners-history" className="winners-history" aria-labelledby="winners-history-title" ref={archiveDialog}
        onClose={() => {
          setOpen(false);
          archiveButton.current?.focus();
        }}>
        <div className="winners-history-heading">
          <h2 id="winners-history-title">{labels.history}</h2>
          <button type="button" onClick={() => archiveDialog.current?.close()} aria-label={labels.closeHistory}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {open && <>
          <p>{labels.partial} {labels.updated} <time dateTime={data.updatedAt}>{formatDate(data.updatedAt, language)}</time>.
            {old && <> {labels.old}</>}
          </p>
          {campaign && <a className="winners-campaign" href={campaign.announcementUrl} target="_blank" rel="noopener noreferrer">
            {labels.ramadanDates
              .replace("{start}", formatDate(campaign.startsOn, language))
              .replace("{end}", formatDate(campaign.endsOn, language))}
            <span aria-hidden="true">↗</span><span className="sr-only"> {t("newWindow")}</span>
          </a>}
          <WinnerList records={history} />
        </>}
      </dialog>
    </>
  );
}
