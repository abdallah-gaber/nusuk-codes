import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";



export function TipsTicker() {
  const { t, n, dir } = useLocale();
  const tips = [
    [
      t("tip1Title"),
      t("tip1Body"),
    ],
    [
      t("tip2Title"),
      t("tip2Body"),
    ],
    [
      t("tip3Title"),
      t("tip3Body"),
    ],
    [
      t("tip4Title"),
      t("tip4Body"),
    ],
    [
      t("tip5Title"),
      t("tip5Body"),
    ],
  ];
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
  }, [rotating, tips.length]);
  function move(delta: number) {
    setPaused(true);
    setIndex((i) => (i + delta + tips.length) % tips.length);
  }
  return (
    <section
      className="tips-ticker"
      aria-label={t("tipsLabel")}
      aria-roledescription={t("carousel")}
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
          move((event.key === "ArrowLeft") === (dir === "rtl") ? 1 : -1);
        }
      }}
    >
      <div
        className="ticker-content"
        aria-live={rotating ? "off" : "polite"}
        aria-atomic="true"
      >
        <span className="ticker-label">
          {t("tipPosition", { current: n(index + 1), total: n(tips.length) })}
        </span>
        <p>
          <strong>{tips[index][0]}.</strong> {tips[index][1]}
        </p>
      </div>
      <div className="ticker-controls">
        <button aria-label={t("previousTip")} onClick={() => move(-1)}>
          {dir === "rtl" ? "→" : "←"}
        </button>
        <button
          aria-label={paused ? t("playTips") : t("pauseTips")}
          aria-pressed={paused}
          disabled={reducedMotion}
          title={
            reducedMotion
              ? t("reducedMotion")
              : undefined
          }
          onClick={() => setPaused((value) => !value)}
        >
          {paused || reducedMotion ? "▷" : "Ⅱ"}
        </button>
        <button aria-label={t("nextTip")} onClick={() => move(1)}>
          {dir === "rtl" ? "←" : "→"}
        </button>
      </div>
    </section>
  );
}
