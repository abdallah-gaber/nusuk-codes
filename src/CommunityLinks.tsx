import { officialUrl } from "./core";

const CREATOR_CODE = "NG-dX626jFL";

export function OfficialAppIntro() {
  return (
    <section className="app-intro" aria-labelledby="app-intro-heading">
      <div>
        <h2 id="app-intro-heading">أول مرة تستخدم تحدي نسك؟</h2>
        <p>
          افتح تطبيق نسك الرسمي، وتعرّف على التحدي وشروط المشاركة، وبعدها ارجع هنا لتصفح أكواد المجتمع.
        </p>
      </div>
      <a className="secondary" href="https://services.nusuk.sa/app"
        target="_blank" rel="noopener noreferrer">
        فتح تطبيق نسك الرسمي <span aria-hidden="true">↗</span>
        <span className="sr-only"> (يفتح في نافذة جديدة)</span>
      </a>
    </section>
  );
}

export function CreatorSupport({ onCopy }: { onCopy: (code: string) => void }) {
  return (
    <section className="creator-support" aria-labelledby="creator-support-heading">
      <h2 id="creator-support-heading">حابب تدعم صاحب الموقع؟ 🤍</h2>
      <p>
        الموقع مجاني ومتاح للجميع. لو حابب تشكر صاحب الموقع، تقدر تستخدم كود الدعوة الخاص بيه داخل تطبيق نسك.
      </p>
      <div className="creator-code">
        <span>كود دعوة صاحب الموقع</span>
        <code dir="ltr">{CREATOR_CODE}</code>
      </div>
      <div className="support-actions">
        <button className="secondary" type="button" onClick={() => onCopy(CREATOR_CODE)}>
          نسخ الكود
        </button>
        <a href={officialUrl(CREATOR_CODE)} target="_blank" rel="noopener noreferrer">
          فتح رابط الدعوة <span aria-hidden="true">↗</span>
          <span className="sr-only"> (يفتح في نافذة جديدة)</span>
        </a>
      </div>
      <p className="support-disclaimer">
        استخدام الكود اختياري، واحتساب أي مكافآت يخضع لشروط نسك الرسمية.
      </p>
    </section>
  );
}
