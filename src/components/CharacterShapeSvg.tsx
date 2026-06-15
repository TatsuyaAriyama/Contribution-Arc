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
