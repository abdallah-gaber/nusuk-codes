export type SeasonStatus = "active" | "archived";

export type VerifiedSeasonDates = {
  startsOn: string;
  endsOn: string;
  evidenceUrl: string;
};

// Populate only after owner review of the full challenge dates in an official source.
export const season: { verifiedDates: VerifiedSeasonDates | null } = {
  verifiedDates: null,
};

export function resolveSeasonStatus(value: string | undefined): SeasonStatus {
  if (value === undefined || value === "active") return "active";
  if (value === "archived") return "archived";
  throw new Error("NUSUK_SEASON_STATUS must be active or archived");
}

export function validateSeasonDates(dates: VerifiedSeasonDates | null) {
  if (!dates) return;
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!valid(dates.startsOn) || !valid(dates.endsOn) || dates.startsOn > dates.endsOn ||
      !dates.evidenceUrl.startsWith("https://") || !URL.canParse(dates.evidenceUrl)) {
    throw new Error("Verified season dates require an ordered ISO date range and HTTPS evidence URL");
  }
}
