/**
 * キャラクター shape の SVG renderers — App.tsx と
 * components/SilentWorkspaceRoom.tsx の両方から再利用する。
 *
 * 設計:
 *   - shape ごとに viewBox はコンテンツに密着させる
 *     (preview / atelier どちらに置いても枠を最大限使える)
 *   - 色はユーザー選択 (characterColor) を front として、
 *     shadeHex で top/right/face/legs を派生
 *   - アニメ class (.morph-float / .morph-gild / .morph-eyes /
 *     .default-char-float) は App.css に定義済み
 */

/** HSL を使わない簡易の明度シフト。percent>0 で白寄せ、<0 で黒寄せ。 */
export function shadeHex(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = (v: number) =>
    Math.round(percent < 0 ? v * (1 + percent) : v + (255 - v) * percent);
  const to2 = (v: number) =>
    Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
  return `#${to2(f(r))}${to2(f(g))}${to2(f(b))}`;
}

export function renderMorphCubeSvg(color: string, options?: { showEdges?: boolean }) {
  const showEdges = options?.showEdges !== false; // 既定で表示 (preview)
  const front = color;
  const top = shadeHex(color, 0.18);
  const right = shadeHex(color, -0.28);
  const edge = "#C7A24E";
  const x0 = 372;
  const y0 = 424;
  const S = 288;
  const OX = 78;
  const OY = 78;
  const x1 = x0 + S;
  const y1 = y0 + S;
  const edges: [number, number, number, number][] = [
    [x0, y0, x1, y0],
    [x1, y0, x1 + OX, y0 - OY],
    [x0 + OX, y0 - OY, x1 + OX, y0 - OY],
    [x0, y0, x0 + OX, y0 - OY],
    [x1, y0, x1, y1],
    [x1 + OX, y0 - OY, x1 + OX, y1 - OY],
  ];
  return (
    <svg
      className="morph-svg"
      viewBox="320 320 480 460"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <ellipse cx="516" cy="742" rx="176" ry="22" fill="#000" fillOpacity="0.16" />
      <g className="morph-float">
        <polygon
          points={`${x0},${y0} ${x1},${y0} ${x1 + OX},${y0 - OY} ${x0 + OX},${y0 - OY}`}
          fill={top}
        />
        <polygon
          points={`${x1},${y0} ${x1 + OX},${y0 - OY} ${x1 + OX},${y1 - OY} ${x1},${y1}`}
          fill={right}
        />
        <rect x={x0} y={y0} width={S} height={S} rx={18} fill={front} />
        {showEdges
          ? edges.map(([ax, ay, bx, by], i) => (
              <line
                key={i}
                x1={ax}
                y1={ay}
                x2={bx}
                y2={by}
                stroke={edge}
                strokeWidth={3}
                strokeLinecap="round"
                className="morph-gild"
              />
            ))
          : null}
        <g className="morph-eyes">
          {[-1, 1].map((s) => (
            <line
              key={s}
              x1={516 + s * 46 - 20}
              y1={556}
              x2={516 + s * 46 + 20}
              y2={556}
              stroke={showEdges ? edge : shadeHex(color, -0.5)}
              strokeWidth={6}
              strokeLinecap="round"
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** 朧 (Oboro) — 半透明オーラに浮かぶ霊体。avatar / preview / stage
 *  すべてで使い回せるよう、色は引数で受け取って fill を直接指定。 */
export function renderGhostSvg(color: string) {
  const aura = color;
  return (
    <svg
      className="ghost-svg"
      viewBox="0 0 128 140"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <ellipse cx="62" cy="78" rx="52" ry="54" fill={aura} fillOpacity={0.26} />
      <path
        d="M18 86 q-12 2 -16 9 q9 1 17 -2 Z"
        fill="#fcfbf9"
        stroke="#43332b"
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path
        d="M110 86 q12 2 16 9 q-9 1 -17 -2 Z"
        fill="#fcfbf9"
        stroke="#43332b"
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path
        d="M64 14 C40 14 18 32 17 60 C16 74 16 86 19 98 C21 107 24 116 31 116 C37 116 39 108 45 108 C51 108 53 118 60 118 C66 118 68 107 75 109 C90 113 104 120 116 108 C124 100 121 86 112 88 C106 89 106 96 100 94 C109 86 113 73 112 60 C110 32 88 14 64 14 Z"
        fill="#fcfbf9"
        stroke="#43332b"
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx="48" cy="64" rx="5.2" ry="7.4" fill="#2a2036" />
      <ellipse cx="78" cy="64" rx="5.2" ry="7.4" fill="#2a2036" />
      <path
        d="M52 80 q4 -6 8 0 t8 0"
        fill="none"
        stroke="#2a2036"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="rotate(20 96 30)">
        <path d="M80 40 h36 v5 h-36 Z" fill="#2a2036" />
        <path d="M88 14 h20 v26 h-20 Z" fill="#2a2036" />
        <rect x={88} y={33} width={20} height={4} fill="#c7a24e" />
      </g>
    </svg>
  );
}

/** 宵 (Yoi) — 朧 (ghost) と同じ語彙のフクロウ。
 *  - 半透明オーラ (色は引数の actor color)
 *  - クリーム白 (#fcfbf9) の本体 + ダーク (#43332b) のアウトライン
 *  - 琥珀 (#c8851a) の差し色
 *  これで朧と並べた時に同じ「線画 + 紙」シリーズに見える。 */
export function renderOwlSvg(color: string) {
  const ink = "#43332b";
  const body = "#fcfbf9";
  const amber = "#c8851a";
  const pupil = "#2a2036";
  return (
    <svg
      className="owl-svg"
      viewBox="0 0 128 140"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 後光のオーラ — 朧と同じトリックで color を背景に置く */}
      <ellipse cx="62" cy="78" rx="52" ry="54" fill={color} fillOpacity={0.26} />

      {/* 耳房 (tuft) — 本体より先に描き、根元が body 内に隠れる */}
      <path
        d="M32 38 L36 12 L52 32 Z"
        fill={body}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path
        d="M96 38 L92 12 L76 32 Z"
        fill={body}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />

      {/* 本体 (egg shape) */}
      <path
        d="M64 22 C36 22 18 44 18 76 C18 104 38 122 64 122 C90 122 110 104 110 76 C110 44 92 22 64 22 Z"
        fill={body}
        stroke={ink}
        strokeWidth={6}
        strokeLinejoin="round"
      />

      {/* 翼のフォールド (subtle 線だけ、肩のあたり) */}
      <path
        d="M28 86 Q22 102 32 116"
        fill="none"
        stroke={ink}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d="M100 86 Q106 102 96 116"
        fill="none"
        stroke={ink}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.55}
      />

      {/* 目 (大きな丸 + 琥珀 + 黒瞳 + 白ハイライト) */}
      <circle cx="48" cy="62" r="12" fill={body} stroke={ink} strokeWidth={4} />
      <circle cx="80" cy="62" r="12" fill={body} stroke={ink} strokeWidth={4} />
      <circle cx="48" cy="62" r="6.4" fill={amber} />
      <circle cx="80" cy="62" r="6.4" fill={amber} />
      <circle cx="48" cy="61" r="3.2" fill={pupil} />
      <circle cx="80" cy="61" r="3.2" fill={pupil} />
      <circle cx="50" cy="59" r="1.2" fill="#fff" />
      <circle cx="82" cy="59" r="1.2" fill="#fff" />

      {/* くちばし (小さな三角) */}
      <path
        d="M64 76 L57 88 L71 88 Z"
        fill={amber}
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* 足 (小さな琥珀の爪) */}
      <path
        d="M52 122 L50 132 M58 122 L60 132"
        stroke={amber}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <path
        d="M68 122 L70 132 M74 122 L76 132"
        stroke={amber}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function renderDefaultCharacterSvg(color: string, options?: { showEdges?: boolean }) {
  const showEdges = options?.showEdges !== false; // 既定で表示 (preview)
  const front = color;
  const top = shadeHex(color, 0.18);
  const right = shadeHex(color, -0.28);
  const face = shadeHex(color, 0.5);
  const legs = shadeHex(color, -0.42);
  const edge = "#C7A24E";
  const x0 = 372;
  const y0 = 440;
  const S = 288;
  const OX = 78;
  const OY = 78;
  const x1 = x0 + S;
  const y1 = y0 + S;
  const edges: [number, number, number, number][] = [
    [x0, y0, x1, y0],
    [x1, y0, x1 + OX, y0 - OY],
    [x0 + OX, y0 - OY, x1 + OX, y0 - OY],
    [x0, y0, x0 + OX, y0 - OY],
    [x1, y0, x1, y1],
    [x1 + OX, y0 - OY, x1 + OX, y1 - OY],
  ];
  const fpSize = 132;
  const fpX = 516 - fpSize / 2;
  const fpY = y0 + (S - fpSize) / 2 + 8;
  const legR = 30;
  const legY = y1 + legR + 6;
  const legGap = 42;
  return (
    <svg
      className="default-char-svg"
      viewBox="320 320 480 540"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="516"
        cy={legY + legR + 18}
        rx="170"
        ry="16"
        fill="#000"
        fillOpacity="0.16"
      />
      <g className="default-char-float">
        <circle cx={516 - legGap} cy={legY} r={legR} fill={legs} />
        <circle cx={516 + legGap} cy={legY} r={legR} fill={legs} />
        <polygon
          points={`${x0},${y0} ${x1},${y0} ${x1 + OX},${y0 - OY} ${x0 + OX},${y0 - OY}`}
          fill={top}
        />
        <polygon
          points={`${x1},${y0} ${x1 + OX},${y0 - OY} ${x1 + OX},${y1 - OY} ${x1},${y1}`}
          fill={right}
        />
        <rect x={x0} y={y0} width={S} height={S} rx={22} fill={front} />
        {showEdges
          ? edges.map(([ax, ay, bx, by], i) => (
              <line
                key={i}
                x1={ax}
                y1={ay}
                x2={bx}
                y2={by}
                stroke={edge}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeOpacity={0.85}
              />
            ))
          : null}
        <rect
          x={fpX}
          y={fpY}
          width={fpSize}
          height={fpSize}
          rx={24}
          fill={face}
          stroke={showEdges ? edge : "none"}
          strokeWidth={1.8}
          strokeOpacity={0.85}
        />
        <ellipse
          cx={fpX + fpSize * 0.38}
          cy={fpY + fpSize * 0.32}
          rx={fpSize * 0.32}
          ry={fpSize * 0.16}
          fill="#fff"
          fillOpacity={0.4}
        />
      </g>
    </svg>
  );
}
