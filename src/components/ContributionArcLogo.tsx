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
        {/* 3 層に積層されたひし形 (isometric) のサービスアイコン。
            白黒ミニマル (DESIGN.md): 緑ではなく ink の濃度 3 段で層を表現。
            透過だと重なり部分で輪郭が消えるため color-mix で不透明な
            中間調にする。dark テーマでは --ink / --surface の反転に追従。 */}
        <g aria-hidden="true">
          {/* Bottom layer (濃) */}
          <polygon
            points="80,90 138,116 80,142 22,116"
            style={{ fill: "var(--ink, #1a1817)" }}
          />
          {/* Middle layer (中) */}
          <polygon
            points="80,60 138,86 80,112 22,86"
            style={{
              fill: "color-mix(in srgb, var(--ink, #1a1817) 55%, var(--surface, #ffffff))",
            }}
          />
          {/* Top layer (淡) */}
          <polygon
            points="80,30 138,56 80,82 22,56"
            style={{
              fill: "color-mix(in srgb, var(--ink, #1a1817) 26%, var(--surface, #ffffff))",
            }}
          />
        </g>
      </svg>
    </div>
  );
}
