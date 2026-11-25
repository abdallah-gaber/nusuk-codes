import { useEffect, useState } from "react";
import { useLocale } from "../LocaleProvider";
import { formatDate } from "../presentation";
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
const recent = history.slice(0, 5);
const campaign = data.ramadanUmrah;
const newestDate = history[0]?.announcedOn;

function flag(country: string) {
  return String.fromCodePoint(...[...country].map((letter) => letter.charCodeAt(0) + 127397));
}

export default function Winners({ now }: { now: number }) {
  const { language, locale, n, t } = useLocale();
  const labels = winnersLabels[language];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualWinner, setManualWinner] = useState<Winner>();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia(motionQuery).matches);
  const winner = recent[index];
  const canRotate = recent.length > 1;

  useEffect(() => {
    const preference = window.matchMedia(motionQuery);
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!canRotate || paused || hovered || focused || open || reducedMotion) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % recent.length), rotationMs);
    return () => window.clearInterval(timer);
  }, [canRotate, paused, hovered, focused, open, reducedMotion]);

  if (!data.presentationEnabled || !winner || !data.updatedAt) return null;

  const displayNames = new Intl.DisplayNames([locale], { type: "region" });
  const old = newestDate && now - Date.parse(newestDate) > weekMs;
  function prizeLabel(record: Winner) {
    return isRamadanWinner(record, campaign) ? labels.ramadan : labels.umrah;
  }

  function winnerMeta(record: Winner, showOrdinal = false) {
    const ramadan = isRamadanWinner(record, campaign);
    return (
      <span className="winner-meta">
        <span className={ramadan ? "winner-prize winner-prize--ramadan" : "winner-prize"}>
          {ramadan ? labels.ramadan : labels.umrah}
        </span>
        {record.country && <span>
          <span aria-hidden="true">{flag(record.country)} </span>{displayNames.of(record.country)}
        </span>}
        {record.announcedOn && <time dateTime={record.announcedOn}>{formatDate(record.announcedOn, language)}</time>}
        {(showOrdinal || !record.announcedOn) && record.winnerOrdinal &&
          <span>{labels.winnerNumber.replace("{number}", n(record.winnerOrdinal))}</span>}
      </span>
    );
  }

  return (
    <section className="winners" aria-labelledby="winners-title"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)} onFocus={() => setFocused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="winners-heading">
        <h2 id="winners-title">{labels.title}</h2>
        <button type="button" className="winners-history-toggle" aria-expanded={open}
          aria-controls="winners-history" onClick={() => setOpen(!open)}>
          {open ? labels.closeHistory : labels.history}
        </button>
      </div>
      <div className="winners-ticker">
        <div className="winner-current" key={winner.id} aria-live="off">
          <strong><bdi>{winner.displayName}</bdi></strong>
          {winnerMeta(winner)}
        </div>
        {canRotate && <div className="winner-controls">
          {!reducedMotion && <button type="button" aria-label={paused ? labels.resume : labels.pause}
            onClick={() => setPaused(!paused)}>
            <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          </button>}
          <button type="button" aria-label={labels.next} onClick={() => {
            const next = (index + 1) % recent.length;
            setIndex(next);
            setManualWinner(recent[next]);
          }}>
            <span className="winner-next-icon" aria-hidden="true">›</span>
          </button>
        </div>}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {manualWinner && <><bdi>{manualWinner.displayName}</bdi>, {prizeLabel(manualWinner)}</>}
        </span>
      </div>
      <div id="winners-history" className="winners-history" hidden={!open}>
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
          <ul role="list">
            {history.map((record) => <li key={record.id}>
              <div>
                <strong><bdi>{record.displayName}</bdi></strong>
                {winnerMeta(record, true)}
              </div>
              <a href={record.announcementUrl} target="_blank" rel="noopener noreferrer"
                aria-label={`${labels.source} · ${record.displayName} ${t("newWindow")}`}>
                {labels.source} <span aria-hidden="true">↗</span>
              </a>
            </li>)}
          </ul>
        </>}
      </div>
    </section>
  );
}
