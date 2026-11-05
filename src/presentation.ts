const dateOptions: Intl.DateTimeFormatOptions = {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
};

// Render release and observation dates consistently, regardless of device timezone.
export function formatDate(value?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "غير متاح";
  return new Date(value).toLocaleDateString("ar-EG", dateOptions);
}

// The manifest identifies a dataset month, not official challenge start/end dates.
export function formatSeason(value?: string): string {
  const match = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{4})$/.exec(value || "");
  if (!match) return "بيانات الموسم غير متاحة";
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const date = new Date(`${match[2]}-${String(months.indexOf(match[1]) + 1).padStart(2, "0")}-01T00:00:00Z`);
  return `بيانات ${date.toLocaleDateString("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" })}`;
}
