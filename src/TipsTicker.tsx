import { useEffect, useState } from "react";

const tips = [
  [
    "النسخ واللصق أوثق",
    "أفضل طريقة: انسخ الكود والصقه يدويًا في خانة الرمز داخل نسك.",
  ],
  [
    "العداد ممكن يتأخر",
    "لو المفتاح ما ظهرش فورًا، اقفل تطبيق نسك وافتحه تاني، أو ارجع لشاشة المفاتيح.",
  ],
  [
    "الرابط مش مضمون",
    "الفتح المباشر ممكن ما يفتحش الشاشة المطلوبة أو يملأ الكود تلقائيًا.",
  ],
  [
    "من غير تكرار",
    "الأكواد اللي جرّبتها بنخفيها على نفس المتصفح؛ مسح بياناته أو تغيير الجهاز بيبدأ سجل جديد.",
  ],
  [
    "من المجتمع، غير متحقق منها",
    "صلاحية أكواد المجتمع مش مؤكدة، ومفيش ضمان للتفعيل أو الأهلية.",
  ],
];

export function TipsTicker() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const rotating = !paused && !hovered && !focused && !hidden && !reducedMotion;
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % tips.length),
      8000,
    );
    return () => window.clearInterval(timer);
  }, [rotating]);
  function move(delta: number) {
    setPaused(true);
    setIndex((i) => (i + delta + tips.length) % tips.length);
  }
  return (
    <section
      className="tips-ticker"
      aria-label="نصائح استخدام الأكواد"
      aria-roledescription="عرض شرائح"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? 1 : -1);
        }
      }}
    >
      <div
        className="ticker-content"
        aria-live={rotating ? "off" : "polite"}
        aria-atomic="true"
      >
        <span className="ticker-label">
          نصيحة سريعة · {(index + 1).toLocaleString("ar-EG")} من{" "}
          {tips.length.toLocaleString("ar-EG")}
        </span>
        <p>
          <strong>{tips[index][0]}.</strong> {tips[index][1]}
        </p>
      </div>
      <div className="ticker-controls">
        <button aria-label="النصيحة السابقة" onClick={() => move(-1)}>
          →
        </button>
        <button
          aria-label={paused ? "تشغيل تبديل النصائح" : "إيقاف تبديل النصائح"}
          aria-pressed={paused}
          disabled={reducedMotion}
          title={
            reducedMotion
              ? "التبديل التلقائي متوقف لتفضيل تقليل الحركة"
              : undefined
          }
          onClick={() => setPaused((value) => !value)}
        >
          {paused || reducedMotion ? "▷" : "Ⅱ"}
        </button>
        <button aria-label="النصيحة التالية" onClick={() => move(1)}>
          ←
        </button>
      </div>
    </section>
  );
}
