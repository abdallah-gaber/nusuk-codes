import { useEffect, useState } from "react";
import { archiveLabels } from "./archiveLabels";
import { useLocale } from "./LocaleProvider";
import { formatDate } from "./presentation";
import { season } from "./season";
import { WinnerCelebration, motionQuery } from "./winners/Celebration";

export function SeasonHero({ stats }: { stats: { winners: number; countries: number } }) {
  const { language, n } = useLocale();
  const labels = archiveLabels[language];
  const dates = season.verifiedDates;
  const [celebrate, setCelebrate] = useState(() =>
    typeof window !== "undefined" && !window.matchMedia(motionQuery).matches,
  );
  useEffect(() => {
    const preference = window.matchMedia(motionQuery);
    const stop = (event: MediaQueryListEvent) => {
      if (event.matches) setCelebrate(false);
    };
    preference.addEventListener("change", stop);
    return () => preference.removeEventListener("change", stop);
  }, []);

  return (
    <section className="season-hero" aria-labelledby="season-title">
      {celebrate && <WinnerCelebration kind="finale" />}
      <div className="season-emblem" aria-hidden="true">
        <span>✦</span>
        <div className="season-trophy">
          <svg viewBox="0 0 32 32" focusable="false">
            <path d="M10 5h12v8a6 6 0 0 1-12 0V5Zm0 3H5v3a5 5 0 0 0 5 5m12-8h5v3a5 5 0 0 1-5 5m-6 3v7m-5 1h10" />
          </svg>
        </div>
        <span>✦</span>
      </div>
      <p className="season-status">{labels.status}</p>
      <h2 id="season-title">{labels.title}</h2>
      {dates && <p className="season-dates">
        <time dateTime={dates.startsOn}>{formatDate(dates.startsOn, language)}</time>
        {" — "}
        <time dateTime={dates.endsOn}>{formatDate(dates.endsOn, language)}</time>
        {" · "}
        <a href={dates.evidenceUrl}>{labels.datesSource}</a>
      </p>}
      <p>{labels.thanks}</p>
      <p className="season-farewell">{labels.farewell}</p>
      <dl className="season-stats">
        <div><dt>{labels.verifiedWinners}</dt><dd>{n(stats.winners)}</dd></div>
        <div><dt>{labels.countries}</dt><dd>{n(stats.countries)}</dd></div>
      </dl>
      <nav aria-label={labels.status}>
        <a className="primary" href="#winners-history">{labels.winners}</a>
        <a href="#browser">{labels.codes}</a>
      </nav>
    </section>
  );
}
