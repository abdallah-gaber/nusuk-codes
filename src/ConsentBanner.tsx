import { useLayoutEffect, useRef } from "react";
import { useLocale } from "./LocaleProvider";
import type { Consent } from "./analytics";

export function ConsentBanner({ onChoose }: { onChoose: (value: Consent) => void }) {
  const { t, language } = useLocale();
  const banner = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      const bounds = banner.current!.getBoundingClientRect();
      root.style.setProperty("--consent-banner-space",
        Math.ceil(bounds.height + Math.max(0, window.innerHeight - bounds.bottom) + 16) + "px");
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(banner.current!);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--consent-banner-space");
    };
  }, [language]);
  return (
    <section ref={banner} className="consent-banner" aria-labelledby="consent-banner-title" aria-describedby="consent-banner-body">
      <div aria-live="polite">
        <h2 id="consent-banner-title">{t("analyticsTitle")}</h2>
        <p id="consent-banner-body">{t("consentBannerBody")}</p>
      </div>
      <div className="consent-banner-actions">
        <button type="button" className="secondary" onClick={() => onChoose("granted")}>{t("consentAccept")}</button>
        <button type="button" className="secondary" onClick={() => onChoose("denied")}>{t("consentDecline")}</button>
      </div>
    </section>
  );
}
