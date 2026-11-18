import { describe, expect, it, vi } from "vitest";
import { AnalyticsClient, CONSENT_KEY, eventPayload, productionTracking, readConsent, saveConsent, sanitizedAnalyticsUrl, type AnalyticsEvents } from "./analytics";
import { languages } from "./i18n";

function fixture(overrides = {}, id: string | undefined = "G-TEST123456") {
  const runtime = { send: vi.fn(), load: vi.fn(), disable: vi.fn(), clearCookies: vi.fn(),
    search: () => "?code=NG-dX626jFL&email=private@example.com",
    referrer: () => "https://example.com/private?code=NG-dX626jFL" };
  const client = new AnalyticsClient(id, { production: true, hostname: "nusuk.abdallahgaber.dev", deployment: "production", manualEventsOnly: true, ...overrides }, runtime);
  return { client, runtime };
}
describe("consent-gated production analytics", () => {
  it.each([undefined, "", "bad", "UA-12345"])("sends and loads nothing without a valid measurement ID (%s)", (id) => {
    const { client, runtime } = fixture({}, id === undefined ? "" : id);
    client.setPage("en"); client.setConsent("granted"); client.track("next_code", { locale: "en" });
    expect(client.eligible).toBe(false);
    expect(runtime.load).not.toHaveBeenCalled(); expect(runtime.send).not.toHaveBeenCalled();
  });
  it.each([{ production: false }, { hostname: "localhost" }, { hostname: "branch.vercel.app" },
    { deployment: "preview" }, { deployment: "development" }])("blocks non-production contexts %j", (env) => {
    const { client, runtime } = fixture(env);
    client.setConsent("granted"); client.setPage("ur");
    expect(runtime.load).not.toHaveBeenCalled(); expect(runtime.send).not.toHaveBeenCalled();
    expect(productionTracking({ production: true, hostname: "nusuk.abdallahgaber.dev", ...env })).toBe(false);
  });
  it("requires the owner to acknowledge manual-event-only stream setup", () => {
    const { client, runtime } = fixture({ manualEventsOnly: false });
    client.setConsent("granted");
    expect(client.eligible).toBe(false); expect(runtime.load).not.toHaveBeenCalled();
  });
  it("does not queue pre-consent activity or denied-consent network commands", () => {
    const { client, runtime } = fixture();
    client.setPage("ur"); client.track("mark_tried", { locale: "ur" }); client.setConsent("denied");
    expect(runtime.send).not.toHaveBeenCalled(); expect(runtime.load).not.toHaveBeenCalled();
  });
  it("initializes once and deduplicates Strict Mode, consent effects and same-locale URLs", () => {
    const { client, runtime } = fixture();
    client.setPage("ur"); client.setConsent("granted"); client.setConsent("granted"); client.setPage("ur");
    client.setPage("en"); client.setPage("en");
    expect(runtime.load).toHaveBeenCalledTimes(1);
    const views = runtime.send.mock.calls.filter(([kind, event]) => kind === "event" && event === "page_view");
    expect(views).toHaveLength(2);
    expect(views[0][2]).toMatchObject({ locale: "ur", page_location: "https://nusuk.abdallahgaber.dev/ur/", page_referrer: "https://example.com" });
    const config = runtime.send.mock.calls.find(([kind]) => kind === "config")![2];
    expect(config).toMatchObject({ send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, cookie_expires: 0, cookie_domain: "none" });
    expect(JSON.stringify(runtime.send.mock.calls)).not.toContain("NG-dX626jFL");
    expect(JSON.stringify(runtime.send.mock.calls)).not.toContain("private@example.com");
    expect(JSON.stringify(runtime.send.mock.calls)).not.toContain("/private");
  });
  it("withdraws immediately, clears session cookies and only resumes after renewed consent", () => {
    const { client, runtime } = fixture();
    client.setConsent("granted"); client.setConsent("denied");
    const count = runtime.send.mock.calls.length;
    client.track("copy_code", { locale: "en", source: "browser" }); client.setPage("en");
    expect(runtime.send).toHaveBeenCalledTimes(count);
    expect(runtime.disable).toHaveBeenLastCalledWith("G-TEST123456", true);
    expect(runtime.clearCookies).toHaveBeenCalledTimes(1);
    client.setConsent("granted");
    expect(runtime.load).toHaveBeenCalledTimes(1);
    expect(runtime.send.mock.calls.filter(([, event]) => event === "page_view")).toHaveLength(2);
  });
  it("keeps opt-out active during delayed tag loading, repeated withdrawal and locale effects", () => {
    const { client, runtime } = fixture();
    client.setConsent("granted"); // load requested; real tag need not have finished.
    client.setConsent("denied");
    const count = runtime.send.mock.calls.length;
    for (const locale of languages) {
      client.setPage(locale);
      client.track("copy_code", { locale, source: "browser" });
      client.track("open_nusuk", { locale, source: "creator" });
      client.setConsent("denied");
    }
    expect(runtime.send).toHaveBeenCalledTimes(count);
    expect(runtime.disable).toHaveBeenLastCalledWith("G-TEST123456", true);
    expect(runtime.load).toHaveBeenCalledTimes(1);
    client.setConsent("granted");
    expect(runtime.disable).toHaveBeenLastCalledWith("G-TEST123456", false);
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });
  it("allows browsing when tag loading or send is blocked", () => {
    const { client, runtime } = fixture();
    runtime.load.mockImplementation(() => { throw new Error("network"); });
    runtime.send.mockImplementation(() => { throw new Error("blocked"); });
    expect(() => { client.setConsent("granted"); client.track("next_code", { locale: "en" }); }).not.toThrow();
  });
  it("keeps only a consent preference, with safe corrupt/blocked storage handling", () => {
    const storage = { getItem: vi.fn(() => "bad"), setItem: vi.fn() };
    expect(readConsent(storage)).toBeUndefined();
    saveConsent(storage, "denied");
    expect(storage.setItem).toHaveBeenCalledWith(CONSENT_KEY, "denied");
    storage.getItem.mockImplementation(() => { throw new Error("blocked"); });
    storage.setItem.mockImplementation(() => { throw new Error("full"); });
    expect(readConsent(storage)).toBeUndefined();
    expect(() => saveConsent(storage, "granted")).not.toThrow();
  });
});
describe("bounded non-sensitive events", () => {
  const samples: { [N in keyof AnalyticsEvents]: AnalyticsEvents[N] } = {
    copy_code: { locale: "en", source: "browser" }, next_code: { locale: "en" },
    skip_code: { locale: "en" }, mark_tried: { locale: "en" }, undo_tried: { locale: "en" },
    open_nusuk: { locale: "en", source: "intro" }, language_change: { locale: "ur", previous_locale: "en" },
    share_website: { locale: "en", share_method: "whatsapp" }, history_export: { locale: "en" },
    history_import: { locale: "en" },
  };
  it("strips query strings, fragments and preview hosts from Vercel page URLs", () => {
    expect(sanitizedAnalyticsUrl("https://branch.vercel.app/ur/?code=NG-dX626jFL#private"))
      .toBe("https://nusuk.abdallahgaber.dev/ur/");
  });
  it("accepts the ten documented events and strips every unexpected payload field", () => {
    for (const [name, payload] of Object.entries(samples)) {
      expect(eventPayload(name as keyof AnalyticsEvents, { ...payload, code: "NG-dX626jFL",
        seed: 12345, history: ["secret"], email: "private@example.com" })).toEqual(payload);
    }
  });
  it("rejects unbounded names, invalid locales and sensitive values in allowed fields", () => {
    expect(eventPayload("copy_code", { locale: "en", source: "NG-dX626jFL" })).toBeUndefined();
    expect(eventPayload("copy_code", { locale: "en", source: "footer" })).toBeUndefined();
    expect(eventPayload("next_code", { locale: "somebody@example.com" })).toBeUndefined();
    expect(eventPayload("unknown" as keyof AnalyticsEvents, { locale: "en" })).toBeUndefined();
    for (const locale of languages) expect(eventPayload("next_code", { locale })).toEqual({ locale });
  });
});
