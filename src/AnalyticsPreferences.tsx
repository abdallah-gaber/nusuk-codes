import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { analytics, CONSENT_KEY, readConsent, saveConsent, type Consent } from "./analytics";

export function AnalyticsPreferencesLink() {
  const { t } = useLocale();
  return <a className="privacy-link" href="#analytics-preferences" onClick={(event) => {
    const preferences = document.getElementById("analytics-preferences") as HTMLDetailsElement | null;
    if (preferences) {
      event.preventDefault();
      preferences.open = true;
      preferences.querySelector("summary")?.focus();
      preferences.scrollIntoView({ block: "start" });
    }
  }}>{t("analyticsTitle")}</a>;
}

export function AnalyticsPreferences() {
  const { t, language } = useLocale();
  const [consent, setConsent] = useState<Consent | undefined>(() => {
    try { return readConsent(localStorage); } catch { return undefined; }
  });
  useEffect(() => {
    analytics.setPage(language);
    if (consent) analytics.setConsent(consent);
  }, [language, consent]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== CONSENT_KEY && event.key !== null) return;
      const next = event.newValue === "granted" || event.newValue === "denied" ? event.newValue : undefined;
      analytics.setConsent(next || "denied");
      setConsent(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function choose(value: Consent) {
    // Apply withdrawal immediately, before any rerender.
    analytics.setConsent(value);
    try { saveConsent(localStorage, value); } catch { /* Session-only choice. */ }
    setConsent(value);
  }
  return (
    <details id="analytics-preferences" className="analytics-preferences" open={analytics.eligible && !consent ? true : undefined}>
      <summary>{t("analyticsTitle")}</summary>
      <p>{t("analyticsDisclosure")}</p>
      {analytics.eligible ? <>
        <p role="status">{t(consent === "granted" ? "analyticsGranted" : consent === "denied" ? "analyticsDenied" : "analyticsChoice")}</p>
        <div className="preference-actions">
          <button type="button" className="secondary" onClick={() => choose("granted")}>{t("analyticsAccept")}</button>
          <button type="button" className="secondary" onClick={() => choose("denied")}>{t("analyticsReject")}</button>
        </div>
      </> : <p>{t("analyticsUnavailable")}</p>}
    </details>
  );
}
