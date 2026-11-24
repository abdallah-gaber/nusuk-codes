import { useEffect, useRef } from "react";
import { officialUrl } from "./core";
import { useLocale } from "./LocaleProvider";
import { analytics, type Consent } from "./analytics";

const CREATOR_CODE = "NG-dX626jFL";

export function OfficialAppIntro() {
  const { t, language } = useLocale();
  return (
    <section className="app-intro" aria-labelledby="app-intro-heading">
      <div>
        <h2 id="app-intro-heading">{t("officialIntroTitle")}</h2>
        <p>
          {t("officialIntroBody")}</p>
      </div>
      <a className="secondary" href="https://services.nusuk.sa/app" onClick={() => analytics.track("open_nusuk", { locale: language, source: "intro" })}
        target="_blank" rel="noopener noreferrer">
        {t("officialIntroAction")}<span aria-hidden="true">↗</span>
        <span className="sr-only"> {t("newWindow")}</span>
      </a>
    </section>
  );
}

export function CreatorSupport({ consent, onCopy }: {
  consent?: Consent;
  onCopy: (code: string) => void;
}) {
  const { t, language } = useLocale();
  const section = useRef<HTMLElement>(null);
  const viewed = useRef(false);
  useEffect(() => {
    const target = section.current;
    if (!target || consent !== "granted" || !analytics.eligible ||
        viewed.current || typeof IntersectionObserver === "undefined") return;

    const threshold = 0.25;
    let observer: IntersectionObserver | undefined;
    const watch = () => {
      observer?.disconnect();
      observer = undefined;
      if (document.hidden || viewed.current) return;

      observer = new IntersectionObserver((entries, currentObserver) => {
        const entry = entries.at(-1);
        if (currentObserver !== observer || document.hidden || viewed.current ||
            !entry?.isIntersecting || entry.intersectionRatio < threshold) return;

        if (analytics.track("creator_support_view", { locale: language })) {
          viewed.current = true;
          currentObserver.disconnect();
          document.removeEventListener("visibilitychange", watch);
        }
      }, { threshold });
      observer.observe(target);
    };

    watch();
    document.addEventListener("visibilitychange", watch);
    return () => {
      document.removeEventListener("visibilitychange", watch);
      observer?.disconnect();
      observer = undefined;
    };
  }, [consent, language]);

  return (
    <section ref={section} className="creator-support" aria-labelledby="creator-support-heading">
      <h2 id="creator-support-heading">{t("creatorTitle")}</h2>
      <p>
        {t("creatorBody")}</p>
      <div className="creator-code">
        <span>{t("creatorCodeLabel")}</span>
        <code dir="ltr">{CREATOR_CODE}</code>
      </div>
      <div className="support-actions">
        <button className="secondary" type="button" onClick={() => onCopy(CREATOR_CODE)}>
          {t("copyCode")}</button>
        <a href={officialUrl(CREATOR_CODE)} onClick={() => analytics.track("open_nusuk", { locale: language, source: "creator" })} target="_blank" rel="noopener noreferrer">
          {t("creatorLink")}<span aria-hidden="true">↗</span>
          <span className="sr-only"> {t("newWindow")}</span>
        </a>
      </div>
      <p className="support-disclaimer">
        {t("creatorDisclaimer")}</p>
    </section>
  );
}
