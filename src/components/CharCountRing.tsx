export // Visual char counter — circular ring that fills as you type and
// switches to a remaining-count number in the danger zone.
function CharCountRing({ value, max }: { value: number; max: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, value / max);
  const isNearLimit = value >= max - 20;
  const isOverLimit = value >= max;
  const remaining = max - value;
  const strokeColor = isOverLimit
    ? "var(--accent-warm, #d3573b)"
    : isNearLimit
    ? "#c8a95b"
    : "var(--green, #1f6f4a)";
  return (
    <span className="char-count-ring" aria-label={`${value} / ${max} 文字`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="var(--line-strong, rgba(0,0,0,0.12))"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 12 12)"
          style={{ transition: "stroke-dashoffset 240ms ease, stroke 240ms ease" }}
        />
      </svg>
      {isNearLimit ? <small>{remaining}</small> : null}
    </span>
  );
}
