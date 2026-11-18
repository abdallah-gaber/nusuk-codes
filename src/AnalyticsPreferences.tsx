import { useEffect, useRef, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { analytics, CONSENT_KEY, type Consent } from "./analytics";
import { loadConsent, persistConsent, saveSessionConsent, storageConsent, syncSessionConsent } from "./consentStorage";
import { ConsentBanner } from "./ConsentBanner";

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
  const [consent, setConsent] = useState<Consent | undefined>(() => loadConsent());
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  useEffect(() => {
    analytics.setPage(language);
    if (consent) analytics.setConsent(consent);
  }, [language, consent]);
  useEffect(() => {
    const apply = (next: Consent | undefined) => {
      analytics.setConsent(next || "denied");
      setConsent(next);
    };
    const sync = (event: StorageEvent) => {
      const change = storageConsent(event);
      if (!change) return;
      saveSessionConsent(undefined);
      apply(change.value);
    };
    try {
      channel.current = new BroadcastChannel(CONSENT_KEY);
      channel.current.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data !== "granted" && event.data !== "denied") return;
        // Also synchronize tabs when localStorage is blocked; no echo/broadcast loop.
        syncSessionConsent(event.data);
        apply(event.data);
      };
    } catch { /* Native storage events remain available when BroadcastChannel is unsupported. */ }
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      channel.current?.close();
      channel.current = undefined;
    };
  }, []);
  function choose(value: Consent) {
    // Apply withdrawal immediately, before any rerender.
    analytics.setConsent(value);
    persistConsent(value);
    setConsent(value);
    try { channel.current?.postMessage(value); } catch { /* No effect on local choice. */ }
  }
  return (
    <><details id="analytics-preferences" className="analytics-preferences">
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
    {analytics.eligible && !consent && <ConsentBanner onChoose={choose} />}
    </>
  );
}
