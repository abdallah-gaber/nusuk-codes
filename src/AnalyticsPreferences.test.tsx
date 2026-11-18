import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsPreferences, AnalyticsPreferencesLink } from "./AnalyticsPreferences";
import { LocaleProvider } from "./LocaleProvider";
import { languages, translate } from "./i18n";

vi.mock("./analytics", async (importOriginal) => ({
  ...await importOriginal<typeof import("./analytics")>(),
  analytics: { eligible: true, setPage: vi.fn(), setConsent: vi.fn(), track: vi.fn() },
}));

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
    expect(html.match(/type="button" class="secondary"/g)).toHaveLength(2);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal');
  });
});
