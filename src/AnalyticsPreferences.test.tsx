import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPreferences, AnalyticsPreferencesLink } from "./AnalyticsPreferences";
import { LocaleProvider } from "./LocaleProvider";
import { languages, translate } from "./i18n";
import { CONSENT_KEY } from "./analytics";

const eligibility = vi.hoisted(() => ({ value: true }));

vi.mock("./analytics", async (importOriginal) => ({
  ...await importOriginal<typeof import("./analytics")>(),
  analytics: { get eligible() { return eligibility.value; }, setPage: vi.fn(), setConsent: vi.fn(), track: vi.fn() },
}));
afterEach(() => { vi.unstubAllGlobals(); eligibility.value = true; });

describe("discoverable nonblocking analytics preferences", () => {
  it.each(languages)("%s has a translated direct entry point and matching disclosure anchor", (language) => {
    const html = renderToStaticMarkup(<LocaleProvider initialLanguage={language}>
      <AnalyticsPreferencesLink /><AnalyticsPreferences />
    </LocaleProvider>);
    expect(html).toContain('class="privacy-link" href="#analytics-preferences"');
    expect(html).toContain('id="analytics-preferences"');
    expect(html).toContain(translate(language, "analyticsTitle"));
    expect(html).toContain(translate(language, "analyticsDisclosure"));
    expect(html).toContain(translate(language, "analyticsAccept"));
    expect(html).toContain(translate(language, "analyticsReject"));
    const banner = html.split('<section class="consent-banner"')[1];
    expect(banner).toContain(translate(language, "consentBannerBody"));
    expect(banner).toContain(translate(language, "consentAccept"));
    expect(banner).toContain(translate(language, "consentDecline"));
    expect(banner.match(/type="button" class="secondary"/g)).toHaveLength(2);
    expect(banner).toContain('aria-live="polite"');
    expect(banner).not.toContain("autofocus");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal');
  });
  it.each(["granted", "denied"])("does not repeat a banner for saved %s consent", (value) => {
    vi.stubGlobal("localStorage", { getItem: (key: string) => key === CONSENT_KEY ? value : null });
    const html = renderToStaticMarkup(<LocaleProvider initialLanguage="en"><AnalyticsPreferences /></LocaleProvider>);
    expect(html).not.toContain('class="consent-banner"');
    expect(html).toContain('id="analytics-preferences"');
  });
  it("does not prompt on an ineligible preview/development deployment", () => {
    eligibility.value = false;
    const html = renderToStaticMarkup(<LocaleProvider initialLanguage="en"><AnalyticsPreferences /></LocaleProvider>);
    expect(html).not.toContain('class="consent-banner"');
  });
});
