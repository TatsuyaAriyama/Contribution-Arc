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

/** 宵 (Yoi) — 元のスクショで使われていた「丸い茶色のフクロウ」を
 *  忠実に再現する自己完結 SVG。
 *  - くすんだベージュ/タン色の本体 (#c8a96b 系) + 翼でわずかに暗い陰影
 *  - 大きな琥珀の目 (白の眼球 → 琥珀虹彩 → 黒瞳 → 白ハイライト)
 *  - 2 本の耳房 (tuft)
 *  - 中央の腹部に縦線パターン (羽の流れ)
 *  - 小さな三角くちばし + 2 本のオレンジの足
 *  CSS sprite に依存せず、avatar / preview / stage どこでも同じ絵が出る。
 */
export function renderOwlSvg(_color: string) {
  // _color はインタフェース維持用 (他 shape と signature を揃える)。
  // 旧 sprite owl は固定のベージュ配色だったので、ここも色は固定する。
  const body = "#c9a96d";     // ベージュ/タン本体
  const wing = "#a98952";     // 翼 (本体より暗い)
  const belly = "#b0905a";    // 腹部の地色 (本体よりわずかに暗い)
  const bellyStripe = "#9a7c4a"; // 腹部の縦線パターン
  const tuft = "#a98952";     // 耳房
  const beak = "#e89a3c";     // くちばし & 足
  const eyeWhite = "#f8f1e1"; // 眼球
  const eyeIris = "#c8851a";  // 琥珀虹彩
  const eyePupil = "#2a2036"; // 瞳
  return (
    <svg
      className="owl-svg"
      viewBox="0 0 128 140"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 床影 */}
      <ellipse cx="64" cy="130" rx="36" ry="5" fill="#000" fillOpacity={0.16} />

      {/* 足 (本体の手前、くちばしと同色のオレンジ) */}
      <g stroke={beak} strokeWidth={4.2} strokeLinecap="round">
        <path d="M52 122 L50 128 M52 122 L54 128" />
        <path d="M76 122 L74 128 M76 122 L78 128" />
      </g>

      {/* 耳房 (本体より先に描いて根元が body の裏に回る) */}
      <path d="M32 36 L40 12 L52 30 Z" fill={tuft} />
      <path d="M96 36 L88 12 L76 30 Z" fill={tuft} />

      {/* 翼 (奥) ─ 本体より大きめの楕円で両肩から下に */}
      <ellipse cx="22" cy="80" rx="18" ry="34" fill={wing} />
      <ellipse cx="106" cy="80" rx="18" ry="34" fill={wing} />

      {/* 本体 (たまご型) */}
      <ellipse cx="64" cy="76" rx="42" ry="50" fill={body} />

      {/* 腹部のパネル (内側の卵型、わずかに暗いベージュ) */}
      <ellipse cx="64" cy="92" rx="22" ry="22" fill={belly} />

      {/* 腹部の縦線パターン (羽の流れ表現) */}
      <g stroke={bellyStripe} strokeWidth={2.4} strokeLinecap="round" opacity={0.7}>
        <line x1="54" y1="82" x2="52" y2="104" />
        <line x1="62" y1="80" x2="62" y2="106" />
        <line x1="70" y1="80" x2="70" y2="106" />
        <line x1="78" y1="82" x2="80" y2="104" />
      </g>

      {/* 眼球 (白の大きな円) */}
      <circle cx="48" cy="62" r="14" fill={eyeWhite} />
      <circle cx="80" cy="62" r="14" fill={eyeWhite} />

      {/* 琥珀虹彩 */}
      <circle cx="48" cy="62" r="7.5" fill={eyeIris} />
      <circle cx="80" cy="62" r="7.5" fill={eyeIris} />

      {/* 黒瞳 */}
      <circle cx="48" cy="62" r="3.8" fill={eyePupil} />
      <circle cx="80" cy="62" r="3.8" fill={eyePupil} />

      {/* 白ハイライト */}
      <circle cx="49.6" cy="60" r="1.4" fill="#fff" />
      <circle cx="81.6" cy="60" r="1.4" fill="#fff" />

      {/* くちばし (小さな三角) */}
      <path d="M64 72 L58 84 L70 84 Z" fill={beak} />
    </svg>
  );
}

/** 煌 (Kō) — ネオン灯の M エンブレムを胸に灯した夜型ロボ。アンテナ +
 *  バイザー + 黄金縁の M ロゴ + 短い 2 本脚。色は固定 (navy + gold +
 *  neon) でユーザーの characterColor は無視する。 */
export function renderRoboSvg(_color: string) {
  const navyDeep = "#0f1428";
  const navy = "#1c2444";
  const navyLight = "#2b3666";
  const gold = "#c7a24e";
  const goldDim = "#7a611f";
  const neon = "#6fa7ff";
  return (
    <svg
      className="robo-svg"
      viewBox="0 0 128 140"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 床影 */}
      <ellipse cx="64" cy="132" rx="34" ry="4.5" fill="#000" fillOpacity={0.22} />

      {/* アンテナ + 先端 LED */}
      <line x1="64" y1="8" x2="64" y2="22" stroke={navyLight} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="64" cy="7" r={3.4} fill={neon} stroke={navyDeep} strokeWidth={1} />

      {/* 頭部の上面 (台形 brim) */}
      <path d="M22 30 L106 30 L114 40 L14 40 Z" fill={navyDeep} />

      {/* 頭部 (ボックス) */}
      <rect x={22} y={38} width={84} height={46} rx={10} fill={navy} />

      {/* 上面のゴールドアクセント (左右) */}
      <rect x={26} y={31} width={14} height={3} rx={1.2} fill={gold} />
      <rect x={88} y={31} width={14} height={3} rx={1.2} fill={gold} />

      {/* バイザー (黒い帯) */}
      <rect x={28} y={46} width={72} height={14} rx={4} fill={navyDeep} opacity={0.95} />

      {/* 胸 - 黒い M エンブレムパネル + 金縁 */}
      <rect x={42} y={66} width={44} height={22} rx={6} fill="#06091a" stroke={gold} strokeWidth={2.2} />
      <path
        d="M50 84 L56 72 L64 80 L72 72 L78 84"
        fill="none"
        stroke={neon}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 胴体 (M の下に続くボディプレート) */}
      <rect x={40} y={88} width={48} height={18} rx={5} fill={navyDeep} />

      {/* 脚 (2 本) */}
      <rect x={48} y={106} width={11} height={14} rx={3} fill={goldDim} opacity={0.85} />
      <rect x={69} y={106} width={11} height={14} rx={3} fill={goldDim} opacity={0.85} />
      <ellipse cx="53.5" cy="122" rx="6.5" ry="1.8" fill="#000" fillOpacity={0.4} />
      <ellipse cx="74.5" cy="122" rx="6.5" ry="1.8" fill="#000" fillOpacity={0.4} />
    </svg>
  );
}

/** 環 (Tamaki) — 頭上に輪 (halo) を浮かべた金色キューブ。穏やかな
 *  表情のスクリーンを胸に持ち、2 本の丸い脚で着地する。色は固定
 *  (olive + gold) でユーザーの characterColor は無視する。
 *  名前は "天使の輪" (halo) からの由来で「環」。 */
export function renderAngelSvg(_color: string) {
  const body = "#a99440";       // olive cube body
  const bodyDark = "#7a661a";   // right-side shadow
  const top = "#bda752";        // top brim (lighter)
  const screenFrame = "#7a682a";
  const screen = "#f7e6a6";
  const halo = "#e7c87a";
  const haloHi = "#fff4b4";
  const foot = "#2a2410";
  return (
    <svg
      className="angel-svg"
      viewBox="0 0 128 140"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 床影 */}
      <ellipse cx="64" cy="132" rx="34" ry="4.5" fill="#000" fillOpacity={0.22} />

      {/* halo (輪) */}
      <ellipse cx="64" cy="14" rx="22" ry="4" fill="none" stroke={halo} strokeWidth={3} />
      <ellipse cx="64" cy="13" rx="22" ry="4" fill="none" stroke={haloHi} strokeWidth={1.2} opacity={0.7} />

      {/* 頭/体の上面 (台形 brim) */}
      <path d="M22 30 L106 30 L114 38 L14 38 Z" fill={top} />

      {/* キューブ本体 */}
      <rect x={22} y={36} width={84} height={70} rx={10} fill={body} />

      {/* 右側面の陰影 */}
      <path d="M106 36 L114 38 L114 102 L106 106 Z" fill={bodyDark} />

      {/* 胸のスクリーン */}
      <rect
        x={40}
        y={52}
        width={48}
        height={40}
        rx={9}
        fill={screenFrame}
        stroke="#c7a24e"
        strokeWidth={2}
      />
      <rect x={46} y={58} width={36} height={28} rx={7} fill={screen} />

      {/* 2 本の丸い脚 (本体の下に少し覗く) */}
      <circle cx="50" cy="118" r={9} fill={foot} />
      <circle cx="78" cy="118" r={9} fill={foot} />
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
