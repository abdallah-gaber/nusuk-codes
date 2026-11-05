import { locales, translate, type Language } from "./i18n";

const dateOptions: Intl.DateTimeFormatOptions = {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
};

// Render release and observation dates consistently, regardless of device timezone.
export function formatDate(value?: string, language: Language = "ar"): string {
  if (!value || !Number.isFinite(Date.parse(value))) return translate(language, "unavailable");
  return new Date(value).toLocaleDateString(locales[language], dateOptions);
}

// The manifest identifies a dataset month, not official challenge start/end dates.
export function formatSeason(value?: string, language: Language = "ar"): string {
  const match = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{4})$/.exec(value || "");
  if (!match) return translate(language, "seasonUnavailable");
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const date = new Date(`${match[2]}-${String(months.indexOf(match[1]) + 1).padStart(2, "0")}-01T00:00:00Z`);
  return translate(language, "seasonData", { date: date.toLocaleDateString(locales[language], { month: "long", year: "numeric", timeZone: "UTC" }) });
}
