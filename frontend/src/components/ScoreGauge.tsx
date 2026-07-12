import { useMemo } from "react";

type Props = {
  score: number;
  size?: number;
};

/**
 * 270° circular gauge used on the dashboard.
 * Uses two overlaid stroked circles rotated 135° clockwise (like the original
 * react-native-svg version) so it looks like a speedometer.
 */
export default function ScoreGauge({ score, size = 220 }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const filled = arcLength * (clamped / 100);

  const color = useMemo(() => {
    if (clamped >= 80) return "var(--c-brand)";
    if (clamped >= 60) return "var(--c-brand-secondary)";
    if (clamped >= 40) return "var(--c-warning)";
    return "var(--c-error)";
  }, [clamped]);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--c-surface-tertiary)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 60, fontWeight: 800, lineHeight: 1, color: "var(--c-on-surface)" }}>
          {clamped}
        </span>
        <span style={{ fontSize: 13, color: "var(--c-on-surface-secondary)", marginTop: 4, fontWeight: 500 }}>
          / 100
        </span>
      </div>
    </div>
  );
}
