import { languages, languagePath, pathLanguage, SITE_URL, translate, type Language } from "./i18n";
import { campaignParameters } from "./sharing";

export const CONSENT_KEY = "nusuk:analytics-consent:v1";
export type Consent = "granted" | "denied";
type Base = { locale: Language };
type Source = "browser" | "search" | "creator" | "intro" | "footer" | "error" | "empty";
export type AnalyticsEvents = {
  copy_code: Base & { source: "browser" | "search" | "creator" };
  next_code: Base;
  skip_code: Base;
  mark_tried: Base;
  undo_tried: Base;
  open_nusuk: Base & { source: Source };
  language_change: Base & { previous_locale: Language };
  share_website: Base & { share_method: "native" | "clipboard" };
  code_browser_view: Base;
  creator_support_view: Base;
  secondary_feature_open: Base & { feature: "search" | "progress" | "help" };
  history_export: Base;
  history_import: Base;
};
export type TrackingEnvironment = { production: boolean; hostname: string; deployment?: string; manualEventsOnly?: boolean };
export function productionTracking(env: TrackingEnvironment) {
  return env.production && env.hostname === new URL(SITE_URL).hostname &&
    env.deployment !== "preview" && env.deployment !== "development";
}
const fields = {
  locale: languages, previous_locale: languages,
  source: ["browser", "search", "creator", "intro", "footer", "error", "empty"],
  share_method: ["native", "clipboard"],
  feature: ["search", "progress", "help"],
} as const;
const eventFields: Record<keyof AnalyticsEvents, readonly (keyof typeof fields)[]> = {
  copy_code: ["locale", "source"], next_code: ["locale"], skip_code: ["locale"],
  mark_tried: ["locale"], undo_tried: ["locale"], open_nusuk: ["locale", "source"],
  language_change: ["locale", "previous_locale"], share_website: ["locale", "share_method"],
  history_export: ["locale"], history_import: ["locale"],
  code_browser_view: ["locale"], creator_support_view: ["locale"], secondary_feature_open: ["locale", "feature"],
};
export function eventPayload(name: keyof AnalyticsEvents, input: object): Record<string, string> | undefined {
  if (!Object.hasOwn(eventFields, name)) return;
  const payload: Record<string, string> = {};
  for (const key of eventFields[name]) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value !== "string" || !(fields[key] as readonly string[]).includes(value)) return;
    if (name === "copy_code" && key === "source" && !["browser", "search", "creator"].includes(value)) return;
    payload[key] = value;
  }
  return payload; // Ignore every property outside the explicit event schema.
}
type Runtime = {
  send: (...command: unknown[]) => void;
  load: (id: string) => void;
  disable: (id: string, disabled: boolean) => void;
  clearCookies: () => void;
  search: () => string;
  referrer: () => string;
};
const denied = { analytics_storage: "denied", ad_storage: "denied",
  ad_user_data: "denied", ad_personalization: "denied" };

export class AnalyticsClient {
  readonly eligible: boolean;
  private active = false;
  private initialized = false;
  private language: Language = "ar";
  private lastPage?: string;
  constructor(private id: string | undefined, env: TrackingEnvironment, private runtime: Runtime) {
    this.eligible = env.manualEventsOnly === true && productionTracking(env) && /^G-[A-Z0-9]{4,20}$/.test(id || "");
  }
  setPage(language: Language) {
    this.language = language;
    if (!this.active || this.lastPage === language) return;
    this.lastPage = language;
    this.safeSend("set", { page_location: sharePage(language), page_title: translate(language, "pageTitle") });
    this.safeSend("event", "page_view", { locale: language, page_location: sharePage(language),
      page_title: translate(language, "pageTitle"), page_referrer: safeReferrer(this.runtime.referrer()) });
  }
  setConsent(consent: Consent) {
    if (!this.eligible || !this.id) return;
    if (consent === "denied") {
      this.active = false;
      this.lastPage = undefined;
      this.runtime.disable(this.id, true);
      this.runtime.clearCookies();
      return;
    }
    this.runtime.disable(this.id, false);
    if (!this.initialized) {
      this.initialized = true;
      this.safeSend("consent", "default", denied);
      this.safeSend("consent", "update", { ...denied, analytics_storage: "granted" });
      this.safeSend("js", new Date());
      this.safeSend("config", this.id, { send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_domain: "none", cookie_expires: 0,
        cookie_flags: "SameSite=Lax;Secure", page_location: sharePage(this.language),
        page_referrer: safeReferrer(this.runtime.referrer()),
        page_title: translate(this.language, "pageTitle"), ...campaignParameters(this.runtime.search()) });
      try { this.runtime.load(this.id); } catch { /* Blocked tags must never break browsing. */ }
    } else if (!this.active) {
      this.safeSend("consent", "update", { ...denied, analytics_storage: "granted" });
    }
    this.active = true;
    this.setPage(this.language);
  }
  track<N extends keyof AnalyticsEvents>(name: N, input: AnalyticsEvents[N]) {
    if (!this.active) return false;
    const payload = eventPayload(name, input);
    if (!payload) return false;
    this.safeSend("event", name, payload);
    return true;
  }
  private safeSend(...command: unknown[]) {
    try { this.runtime.send(...command); } catch { /* Analytics is optional. */ }
  }
}
const sharePage = (language: Language) => SITE_URL + languagePath(language);
function safeReferrer(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch { return ""; }
}
export function readConsent(storage: Pick<Storage, "getItem">): Consent | undefined {
  try {
    const value = storage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : undefined;
  } catch { return undefined; }
}
export function saveConsent(storage: Pick<Storage, "setItem">, consent: Consent) {
  try { storage.setItem(CONSENT_KEY, consent); return true; } catch { return false; }
}
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...command: unknown[]) => void; }
}
export function sendGoogleCommand(...command: unknown[]) {
  window.dataLayer ||= [];
  // gtag.js dispatches Arguments objects as commands. Arrays are interpreted as
  // data-layer method calls instead, silently dropping config/consent/events.
  // eslint-disable-next-line prefer-rest-params -- Google requires Arguments, not a rest array.
  window.gtag ||= function () { window.dataLayer!.push(arguments); };
  window.gtag(...command);
}
const browserRuntime: Runtime = {
  send: sendGoogleCommand,
  load(id) {
    if (document.getElementById("nusuk-google-tag")) return;
    const script = document.createElement("script");
    script.id = "nusuk-google-tag"; script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.append(script);
  },
  disable(id, disabled) { (window as unknown as Record<string, unknown>)["ga-disable-" + id] = disabled; },
  clearCookies() {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_"))
        document.cookie = name + "=; Max-Age=0; Path=/; Secure; SameSite=Lax";
    }
  },
  search: () => location.search,
  referrer: () => document.referrer,
};
export const trackingEnvironment: TrackingEnvironment = {
  production: import.meta.env.PROD,
  hostname: typeof location === "undefined" ? "" : location.hostname,
  deployment: import.meta.env.VITE_DEPLOYMENT_ENV,
  manualEventsOnly: import.meta.env.VITE_GA_MANUAL_EVENTS_ONLY === "true",
};
export const analytics = new AnalyticsClient(import.meta.env.VITE_GA_MEASUREMENT_ID, trackingEnvironment, browserRuntime);

export function sanitizedAnalyticsUrl(value: string) {
  try { return SITE_URL + languagePath(pathLanguage(new URL(value).pathname) || "ar"); }
  catch { return SITE_URL + "/ar/"; }
}
