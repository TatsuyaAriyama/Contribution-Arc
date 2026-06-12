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
        <defs>
          <linearGradient id="logo-border-gradient" x1="22" y1="134" x2="138" y2="24">
            <stop offset="0" stopColor="#103d2a" />
            <stop offset="0.48" stopColor="#1f6f4a" />
            <stop offset="1" stopColor="#a7c978" />
          </linearGradient>
        </defs>
        <rect className="logo-icon-base" x="10" y="10" width="140" height="140" rx="35" />
        <rect className="logo-icon-border" x="13" y="13" width="134" height="134" rx="32" />
        <rect className="logo-icon-inner-border" x="25" y="25" width="110" height="110" rx="27" />
        <g className="logo-contribution-arc" aria-hidden="true">
          <rect className="arc-block block-1" x="34" y="109" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-2" x="46" y="105" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-3" x="58" y="98" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-4" x="70" y="88" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-5" x="82" y="76" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-6" x="94" y="63" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-7" x="106" y="51" width="10" height="10" rx="2.4" />
          <rect className="arc-block block-8" x="118" y="42" width="10" height="10" rx="2.4" />
        </g>
      </svg>
    </div>
  );
}
