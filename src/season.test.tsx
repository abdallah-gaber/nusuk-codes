import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { archiveLabels } from "./archiveLabels";
import { languages, direction, SITE_URL, translate } from "./i18n";
import { localizedHtml } from "./localeMetadata";
import { LocaleProvider } from "./LocaleProvider";
import { SeasonHero } from "./SeasonHero";
import { winnerStats } from "./winners/data";
import { resolveSeasonStatus, season, validateSeasonDates } from "./season";

const template = readFileSync("index.html", "utf8");

describe("owner-controlled season", () => {
  it("defaults to Active and requires explicit selection of Archived", () => {
    expect(resolveSeasonStatus(undefined)).toBe("active");
    expect(resolveSeasonStatus("active")).toBe("active");
    expect(resolveSeasonStatus("archived")).toBe("archived");
    for (const value of ["", "Archived", "upcoming", "2026-12-20"]) {
      expect(() => resolveSeasonStatus(value)).toThrow("NUSUK_SEASON_STATUS");
    }
  });

  it("counts verified records and only distinct known countries", () => {
    expect(winnerStats([{ country: "EG" }, {}, { country: "ID" }, { country: "EG" }])).toEqual({
      winners: 4, countries: 2,
    });
    expect(winnerStats([])).toEqual({ winners: 0, countries: 0 });
  });

  const sample = { startsOn: "2020-01-01", endsOn: "2020-02-29", evidenceUrl: "https://example.com/announcement" };

  it("accepts an absent or complete verified date range and rejects invalid dates and sources", () => {
    expect(() => validateSeasonDates(null)).not.toThrow();
    expect(() => validateSeasonDates(sample)).not.toThrow();
    expect(() => validateSeasonDates({ ...sample, endsOn: "2020-02-30" })).toThrow();
    expect(() => validateSeasonDates({ ...sample, startsOn: "2021-01-01" })).toThrow();
    expect(() => validateSeasonDates({ ...sample, evidenceUrl: "javascript:alert(1)" })).toThrow();
  });

  it.each(languages)("%s retains localized crawlable pages in both states", (language) => {
    const active = localizedHtml(template, language);
    const archived = localizedHtml(template, language, false, true);
    for (const document of [active, archived]) {
      expect(document).toContain(`<html lang="${language}" dir="${direction(language)}">`);
      expect(document).toContain(`rel="canonical" href="${SITE_URL}/${language}/"`);
      expect(document.match(/hreflang=/g)).toHaveLength(languages.length + 1);
    }
    expect(active).toContain(translate(language, "step1Title"));
    expect(active).not.toContain(archiveLabels[language].title);
    expect(archived).toContain(archiveLabels[language].title);
    expect(archived).toContain(archiveLabels[language].description);
    expect(archived).toContain(archiveLabels[language].farewell);
    expect(archiveLabels[language].title).toMatch(/2026|٢٠٢٦/);
    expect(archived).not.toContain(translate(language, "step1Title"));
  });

  it.each(languages)("%s shows season dates only when the reviewed configuration has them", (language) => {
    const previous = season.verifiedDates;
    const render = () => renderToStaticMarkup(<LocaleProvider initialLanguage={language}><SeasonHero stats={{ winners: 5, countries: 3 }} /></LocaleProvider>);
    try {
      season.verifiedDates = null;
      expect(render()).not.toContain("<time");
      season.verifiedDates = sample;
      const hero = render();
      expect(hero).toContain(`dateTime="${sample.startsOn}"`);
      expect(hero).toContain(`dateTime="${sample.endsOn}"`);
      expect(hero).toContain(`href="${sample.evidenceUrl}"`);
      expect(hero).toContain(archiveLabels[language].thanks);
      expect(hero).toContain(archiveLabels[language].farewell);
    } finally {
      season.verifiedDates = previous;
    }
  });
});
