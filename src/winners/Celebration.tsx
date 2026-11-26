import { useState, type AnimationEvent, type CSSProperties } from "react";
import "./celebration.css";

export const motionQuery = "(prefers-reduced-motion: reduce)";
export type Celebration = "initial" | "automatic" | "manual";

const confettiShapes = ["ribbon", "rectangle", "sparkle"] as const;
const confettiColors = ["#ffcf71", "#68dfae", "#fff0cb"] as const;
const makeConfetti = (count: number) => Array.from({ length: count }, (_, index) => ({
  shape: confettiShapes[index % confettiShapes.length],
  style: {
    "--piece-color": confettiColors[(index + Math.floor(index / 3)) % confettiColors.length],
    "--piece-x": `${(index + 0.3 + (index % 5) * 0.12) * 100 / count}%`,
    "--piece-y": `${-14 + (index * 11) % 30}px`,
    "--piece-size": `${4 + index % 4}px`,
    "--piece-drift": `${(index * 17) % 49 - 24}px`,
    "--piece-fall": `${97 + (index * 19) % 67}px`,
    "--piece-spin": `${(index % 2 ? -1 : 1) * (135 + (index * 37) % 250)}deg`,
    "--piece-delay": `${(index * 13) % 8 * 50}ms`,
    "--piece-duration": `${2600 + index % 5 * 90}ms`,
  } as CSSProperties,
}));

const confettiPieces = makeConfetti(32);
const finalePieces = makeConfetti(56);
const automaticPieces = confettiPieces.filter((_, index) => index % 3 !== 2);

export function WinnerCelebration({ kind }: { kind: Celebration | "finale" }) {
  const [finished, setFinished] = useState(false);
  if (finished) return null;

  function finish(event: AnimationEvent<HTMLElement>) {
    if (event.target === event.currentTarget) setFinished(true);
  }

  if (kind === "manual") {
    return <span className="winners-manual-sparkle" aria-hidden="true" onAnimationEnd={finish}>✦</span>;
  }

  const automatic = kind === "automatic";
  const className = automatic ? "winners-confetti winners-confetti--automatic"
    : kind === "finale" ? "winners-confetti winners-confetti--finale" : "winners-confetti";
  const pieces = automatic ? automaticPieces : kind === "finale" ? finalePieces : confettiPieces;
  return (
    <div className={className}
      aria-hidden="true" onAnimationEnd={finish}>
      {pieces.map(({ shape, style }, index) => (
        <span className={`winners-confetti-piece winners-confetti-piece--${shape}`} style={style} key={index} />
      ))}
    </div>
  );
}
