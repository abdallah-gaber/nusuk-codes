import { officialUrl } from "./core";
import { useLocale } from "./LocaleProvider";

const CREATOR_CODE = "NG-dX626jFL";

export function OfficialAppIntro() {
  const { t } = useLocale();
  return (
    <section className="app-intro" aria-labelledby="app-intro-heading">
      <div>
        <h2 id="app-intro-heading">{t("officialIntroTitle")}</h2>
        <p>
          {t("officialIntroBody")}</p>
      </div>
      <a className="secondary" href="https://services.nusuk.sa/app"
        target="_blank" rel="noopener noreferrer">
        {t("officialIntroAction")}<span aria-hidden="true">↗</span>
        <span className="sr-only"> {t("newWindow")}</span>
      </a>
    </section>
  );
}

export function CreatorSupport({ onCopy }: { onCopy: (code: string) => void }) {
  const { t } = useLocale();
  return (
    <section className="creator-support" aria-labelledby="creator-support-heading">
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
        <a href={officialUrl(CREATOR_CODE)} target="_blank" rel="noopener noreferrer">
          {t("creatorLink")}<span aria-hidden="true">↗</span>
          <span className="sr-only"> {t("newWindow")}</span>
        </a>
      </div>
      <p className="support-disclaimer">
        {t("creatorDisclaimer")}</p>
    </section>
  );
}
