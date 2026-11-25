export type Winner = {
  id: string;
  displayName: string;
  country?: string;
  prize: "umrah";
  announcedOn: string | null;
  winnerOrdinal?: number;
  announcementUrl: string;
  verifiedAt: string;
};

export type RamadanCampaign = {
  startsOn: string;
  endsOn: string;
  announcementUrl: string;
};

export type WinnersArchive = {
  schemaVersion: 1;
  presentationEnabled: boolean;
  updatedAt: string | null;
  ramadanUmrah: RamadanCampaign | null;
  records: Winner[];
};

// ISO 3166-1 alpha-2 assignments. Intl accepts additional, unassigned regions.
const countries = new Set((
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" "));

const archiveKeys = new Set(["schemaVersion", "presentationEnabled", "updatedAt", "ramadanUmrah", "records"]);
const recordKeys = new Set(["id", "displayName", "country", "prize", "announcedOn", "winnerOrdinal", "announcementUrl", "verifiedAt"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace(/Z$/, ".000Z");
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && isTimestamp(value + "T00:00:00Z");
}

function isAnnouncementUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("https://") || /[\s\\]/.test(value)) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || url.search) return false;
  const { hostname, pathname } = url;
  if (hostname === "x.com" || hostname === "twitter.com") {
    return /^\/MyNusuk\/status\/[0-9]+$/i.test(pathname);
  }
  if (hostname === "www.facebook.com") {
    return /^\/MyNusuk\/(posts|videos)\/[a-z\d]+\/?$/i.test(pathname);
  }
  if (hostname === "www.instagram.com") {
    return /^\/(p|reel)\/[\w-]+\/?$/.test(pathname);
  }
  return ["nusuk.sa", "www.nusuk.sa", "haj.gov.sa", "www.haj.gov.sa"].includes(hostname) && pathname !== "/";
}

function isCampaign(value: unknown): value is RamadanCampaign {
  return isObject(value) && Object.keys(value).length === 3 &&
    isDate(value.startsOn) && isDate(value.endsOn) && value.startsOn <= value.endsOn &&
    isAnnouncementUrl(value.announcementUrl);
}

function isWinner(record: unknown): record is Winner {
  return isObject(record) && Object.keys(record).every((key) => recordKeys.has(key)) &&
    typeof record.id === "string" && /^winner-\d{4,}$/.test(record.id) &&
    typeof record.displayName === "string" && Boolean(record.displayName.trim()) &&
    (record.country === undefined || (typeof record.country === "string" && countries.has(record.country))) &&
    record.prize === "umrah" &&
    (record.announcedOn === null || isDate(record.announcedOn)) &&
    (record.winnerOrdinal === undefined ||
      (typeof record.winnerOrdinal === "number" && Number.isSafeInteger(record.winnerOrdinal) && record.winnerOrdinal > 0)) &&
    isAnnouncementUrl(record.announcementUrl) && isTimestamp(record.verifiedAt);
}

export function validateWinners(value: unknown): WinnersArchive {
  if (!isObject(value) || Object.keys(value).some((key) => !archiveKeys.has(key)) ||
      value.schemaVersion !== 1 || typeof value.presentationEnabled !== "boolean" || !Array.isArray(value.records)) {
    throw new Error("Invalid winners archive structure");
  }
  const { updatedAt, ramadanUmrah } = value;
  if (ramadanUmrah !== null && !isCampaign(ramadanUmrah)) {
    throw new Error("Invalid Ramadan Umrah campaign dates or announcement URL");
  }
  if (value.records.length ? !isTimestamp(updatedAt) : updatedAt !== null || value.presentationEnabled) {
    throw new Error("Winners archive update timestamp and presentation state must match its records");
  }
  const ids = new Set<string>();
  const ordinals = new Set<number>();
  const entries = new Set<string>();
  const records = value.records.map((record, index) => {
    if (!isWinner(record)) throw new Error(`Invalid winner at records[${index}]`);
    const { id, displayName, announcedOn, winnerOrdinal, announcementUrl, verifiedAt } = record;
    // A Saudi announcement date can begin three hours before its UTC date.
    const verificationDay = new Date(Date.parse(verifiedAt) + 3 * 3600000).toISOString().slice(0, 10);
    if ((typeof updatedAt === "string" && verifiedAt > updatedAt) || (announcedOn && announcedOn > verificationDay)) {
      throw new Error(`${id} has inconsistent announcement or verification dates`);
    }
    if (ids.has(id)) throw new Error(`Duplicate winner ID: ${id}`);
    ids.add(id);
    if (winnerOrdinal) {
      if (ordinals.has(winnerOrdinal)) throw new Error(`Duplicate winner number: ${winnerOrdinal}`);
      ordinals.add(winnerOrdinal);
    }
    const name = displayName.normalize("NFC").trim().replace(/\s+/g, " ");
    const permalink = announcementUrl.replace(/^https:\/\/twitter\.com\//, "https://x.com/").replace(/\/$/, "");
    const keys = [`url:${permalink}`];
    if (announcedOn) keys.push(`date:${announcedOn}`);
    for (const key of keys) {
      const entry = JSON.stringify([name, key]);
      if (entries.has(entry)) throw new Error(`Possible duplicate winner: ${id}`);
      entries.add(entry);
    }
    return record;
  });
  return {
    schemaVersion: 1,
    presentationEnabled: value.presentationEnabled,
    updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    ramadanUmrah,
    records,
  };
}

export function orderedWinners(records: readonly Winner[]) {
  return [...records].sort((a, b) =>
    (b.announcedOn ?? "").localeCompare(a.announcedOn ?? "") ||
    (b.winnerOrdinal ?? 0) - (a.winnerOrdinal ?? 0) ||
    a.id.localeCompare(b.id));
}

export function isRamadanWinner(record: Winner, campaign: RamadanCampaign | null): boolean {
  return Boolean(campaign && record.announcedOn &&
    record.announcedOn >= campaign.startsOn && record.announcedOn <= campaign.endsOn);
}
