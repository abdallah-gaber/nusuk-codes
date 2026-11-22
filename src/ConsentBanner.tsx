import { useLocale } from "./LocaleProvider";
import type { Consent } from "./analytics";

export function ConsentBanner({ onChoose }: { onChoose: (value: Consent) => void }) {
  const { t } = useLocale();
  return (
    <section className="consent-banner" aria-labelledby="consent-banner-title" aria-describedby="consent-banner-body">
      <div>
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
