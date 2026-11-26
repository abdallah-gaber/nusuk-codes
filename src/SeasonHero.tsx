import { archiveLabels } from "./archiveLabels";
import { useLocale } from "./LocaleProvider";
import { formatDate } from "./presentation";
import { season } from "./season";

export function SeasonHero() {
  const { language } = useLocale();
  const labels = archiveLabels[language];
  const dates = season.verifiedDates;
  return (
    <section className="season-hero" aria-labelledby="season-title">
      <p className="season-status"><span aria-hidden="true">✦</span> {labels.status}</p>
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
      <nav aria-label={labels.status}>
        <a className="primary" href="#winners-history">{labels.winners}</a>
        <a href="#browser">{labels.codes}</a>
      </nav>
    </section>
  );
}
