export function ContributionArcLogo() {
  return (
    <div className="brand-logo-stage" aria-label="Contribution Arc logo">
      <svg
        className="brand-logo-mark"
        viewBox="0 0 160 160"
        role="img"
        aria-labelledby="contribution-arc-logo-title"
      >
        <title id="contribution-arc-logo-title">Contribution Arc</title>
        {/* 3 層に積層された緑のひし形 (isometric) のサービスアイコン。
            上から: 薄緑 → 中緑 → 濃緑。 ふわっと浮いた階層感を出すため
            各層を縦に少しずつ重ねる。 */}
        <g aria-hidden="true">
          {/* Bottom layer (濃緑) */}
          <polygon
            points="80,90 138,116 80,142 22,116"
            fill="#1f4a32"
          />
          {/* Middle layer (中緑) */}
          <polygon
            points="80,60 138,86 80,112 22,86"
            fill="#3fa15c"
          />
          {/* Top layer (薄緑) */}
          <polygon
            points="80,30 138,56 80,82 22,56"
            fill="#8fcfa7"
          />
        </g>
      </svg>
    </div>
  );
}
