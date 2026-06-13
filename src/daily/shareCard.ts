/**
 * 日報を「見栄えする画像カード」として書き出して共有/保存する。
 *
 * iOS/Android のネイティブなホーム画面ウィジェットは Web からは作れない
 * ため、その代替として日報を 1 枚の PNG にレンダリングする。ユーザーは
 * 共有シートから写真に保存 → iOS の「写真」ウィジェットやショートカット
 * でホーム画面に置ける、という導線を取れる。
 *
 * 依存ゼロ（Canvas 2D を直接描画）。html2canvas 等を足すと bundle と
 * ネットワーク（CI の npm install）に影響するため、あえて手描きにする。
 * 配色は DESIGN.md のトークン（ink / green / surface）に合わせたリテラル。
 */

export type DailyShareItem = { text: string; done: boolean };

export type DailyShareData = {
  /** "6月11日(水)" のような表示用日付。 */
  dateLabel: string;
  authorName: string;
  /** 連続日数。0 なら非表示。 */
  streakDays?: number;
  planItems: DailyShareItem[];
  reflection: string;
};

export type ShareResult = "shared" | "downloaded" | "cancelled";

const COLOR = {
  paper: "#f3f1ea",
  card: "#ffffff",
  ink: "#1f1f28",
  sub: "#8a8a98",
  hair: "rgba(31, 31, 40, 0.10)",
  green: "#1f6f4a",
  greenSoft: "rgba(31, 111, 74, 0.12)",
  ring: "rgba(31, 31, 40, 0.26)",
  done: "rgba(31, 31, 40, 0.42)",
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Segoe UI", sans-serif';

// 論理ピクセルでレイアウトし、書き出し時に SCALE 倍して高精細にする。
const SCALE = 2;
const W = 540; // 論理幅
const PAD = 26; // 用紙の余白
const CARD_PAD = 30; // カード内側の余白
const CARD_W = W - PAD * 2;
const CONTENT_W = CARD_W - CARD_PAD * 2;
const CHECK_GAP = 16; // チェック丸とテキストの間
const CHECK_R = 9;

const MAX_PLAN_ITEMS = 8;
const MAX_REFLECTION_LINES = 8;

/** 日本語対応の文字単位ワードラップ。明示的な改行も尊重する。 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const ch of Array.from(para)) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, done: boolean) {
  if (done) {
    ctx.beginPath();
    ctx.arc(cx, cy, CHECK_R, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.green;
    ctx.fill();
    // 白いチェックマーク
    ctx.beginPath();
    ctx.moveTo(cx - 4.2, cy + 0.3);
    ctx.lineTo(cx - 1.3, cy + 3.2);
    ctx.lineTo(cx + 4.4, cy - 3.6);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, CHECK_R, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR.ring;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

/**
 * 日報を 1 枚の PNG（Blob）にレンダリングして返す純粋関数。共有/保存/
 * プレビューのいずれにも使えるよう、書き出しと UI を分離している。
 */
export async function createDailyReportImageBlob(data: DailyShareData): Promise<Blob> {
  // 測定用の使い捨て context（measureText はキャンバスサイズに依らない）。
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) throw new Error("canvas-unsupported");

  const planItems = data.planItems.slice(0, MAX_PLAN_ITEMS);
  const planTextW = CONTENT_W - (CHECK_R * 2 + CHECK_GAP);

  // --- レイアウト（行の折返しを先に確定し、総高さを算出） ---
  const planWrapped: string[][] = planItems.map((item) => {
    mctx.font = `500 14px ${FONT}`;
    return wrapText(mctx, item.text.trim() || "（無題）", planTextW);
  });

  mctx.font = `400 15px ${FONT}`;
  let reflectionLines = data.reflection.trim()
    ? wrapText(mctx, data.reflection.trim(), CONTENT_W)
    : [];
  let reflectionTruncated = false;
  if (reflectionLines.length > MAX_REFLECTION_LINES) {
    reflectionLines = reflectionLines.slice(0, MAX_REFLECTION_LINES);
    reflectionTruncated = true;
  }

  const PLAN_LINE_H = 21;
  const PLAN_ROW_GAP = 12;
  const REFL_LINE_H = 23;

  let contentH = 0;
  contentH += 14; // kicker
  contentH += 8;
  contentH += 32; // date row
  contentH += 22; // gap + hairline area
  // セクション: 今日やること
  contentH += 22; // section title
  contentH += 10;
  if (planItems.length > 0) {
    for (const lines of planWrapped) {
      contentH += Math.max(CHECK_R * 2, lines.length * PLAN_LINE_H) + PLAN_ROW_GAP;
    }
  } else {
    contentH += 24; // placeholder
  }
  contentH += 18; // gap before reflection
  // セクション: 振り返り
  contentH += 22; // section title
  contentH += 10;
  if (reflectionLines.length > 0) {
    contentH += reflectionLines.length * REFL_LINE_H;
    if (reflectionTruncated) contentH += REFL_LINE_H;
  } else {
    contentH += 24; // placeholder
  }
  contentH += 22; // gap
  contentH += 1; // footer hairline
  contentH += 16;
  contentH += 18; // footer text

  const cardH = contentH + CARD_PAD * 2;
  const totalH = cardH + PAD * 2;

  // --- 実描画 ---
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = Math.ceil(totalH) * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unsupported");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "top";

  // 用紙背景
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, 0, W, totalH);

  // カード（影付き）
  ctx.save();
  ctx.shadowColor = "rgba(31, 31, 40, 0.14)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, PAD, PAD, CARD_W, cardH, 22);
  ctx.fillStyle = COLOR.card;
  ctx.fill();
  ctx.restore();

  const x = PAD + CARD_PAD;
  let y = PAD + CARD_PAD;

  // kicker
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = COLOR.sub;
  ctx.fillText("DAILY REPORT", x, y);
  y += 14 + 8;

  // 日付（左） + ストリーク（右）
  ctx.font = `800 24px ${FONT}`;
  ctx.fillStyle = COLOR.ink;
  ctx.fillText(data.dateLabel, x, y);
  if (data.streakDays && data.streakDays > 0) {
    const label = `🔥 ${data.streakDays}日連続`;
    ctx.font = `700 13px ${FONT}`;
    const tw = ctx.measureText(label).width;
    const pillW = tw + 22;
    const pillH = 24;
    const pillX = PAD + CARD_W - CARD_PAD - pillW;
    const pillY = y - 1;
    roundRect(ctx, pillX, pillY, pillW, pillH, 12);
    ctx.fillStyle = COLOR.greenSoft;
    ctx.fill();
    ctx.fillStyle = COLOR.green;
    ctx.fillText(label, pillX + 11, pillY + 5);
  }
  y += 32 + 11;

  // hairline
  ctx.strokeStyle = COLOR.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(PAD + CARD_W - CARD_PAD, y);
  ctx.stroke();
  y += 11;

  // セクション: 今日やること
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = COLOR.ink;
  ctx.fillText("今日やること", x, y);
  y += 22 + 10;

  if (planItems.length > 0) {
    planItems.forEach((item, i) => {
      const lines = planWrapped[i];
      const rowH = Math.max(CHECK_R * 2, lines.length * PLAN_LINE_H);
      const cy = y + CHECK_R;
      drawCheck(ctx, x + CHECK_R, cy, item.done);
      ctx.font = `500 14px ${FONT}`;
      ctx.fillStyle = item.done ? COLOR.done : COLOR.ink;
      let ty = y;
      const tx = x + CHECK_R * 2 + CHECK_GAP;
      for (const line of lines) {
        ctx.fillText(line, tx, ty + 2);
        // 完了項目には控えめな取り消し線
        if (item.done) {
          const lw = ctx.measureText(line).width;
          ctx.strokeStyle = COLOR.done;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tx, ty + 2 + 9);
          ctx.lineTo(tx + lw, ty + 2 + 9);
          ctx.stroke();
        }
        ty += PLAN_LINE_H;
      }
      y += rowH + PLAN_ROW_GAP;
    });
  } else {
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = COLOR.sub;
    ctx.fillText("（まだありません）", x, y);
    y += 24;
  }

  y += 18;

  // セクション: 振り返り
  ctx.font = `800 15px ${FONT}`;
  ctx.fillStyle = COLOR.ink;
  ctx.fillText("振り返り", x, y);
  y += 22 + 10;

  if (reflectionLines.length > 0) {
    ctx.font = `400 15px ${FONT}`;
    ctx.fillStyle = COLOR.ink;
    for (const line of reflectionLines) {
      ctx.fillText(line, x, y);
      y += REFL_LINE_H;
    }
    if (reflectionTruncated) {
      ctx.fillStyle = COLOR.sub;
      ctx.fillText("…", x, y);
      y += REFL_LINE_H;
    }
  } else {
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = COLOR.sub;
    ctx.fillText("（まだありません）", x, y);
    y += 24;
  }

  y += 22;

  // footer hairline
  ctx.strokeStyle = COLOR.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(PAD + CARD_W - CARD_PAD, y);
  ctx.stroke();
  y += 16;

  // footer: 著者（左） + ブランド（右）。称号は付けず名前だけにする。
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = COLOR.ink;
  ctx.fillText(data.authorName, x, y);
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = COLOR.sub;
  const brand = "Contribution Arc";
  const brandW = ctx.measureText(brand).width;
  ctx.fillText(brand, PAD + CARD_W - CARD_PAD - brandW, y + 1);

  // --- 書き出し ---
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("export-failed");
  return blob;
}

/** 共有用のファイル名（日付ラベルから生成、ファイル名に使えない文字を除去）。 */
export function dailyShareFilename(dateLabel: string): string {
  return `daily-${dateLabel}.png`.replace(/[\\/:*?"<>|()]/g, "");
}

/**
 * 画像を生成し、Web Share API（ファイル共有対応）が使える環境では共有
 * シートを開く。非対応（多くの PC ブラウザ）ではダウンロード保存に倒す。
 */
export async function shareDailyReportImage(data: DailyShareData): Promise<ShareResult> {
  const blob = await createDailyReportImageBlob(data);
  const filename = dailyShareFilename(data.dateLabel);
  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${data.dateLabel}の日報` });
      return "shared";
    } catch (err) {
      // ユーザーがキャンセルした場合はそこで終わり。それ以外は保存に倒す。
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  // フォールバック：ダウンロード保存。
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
