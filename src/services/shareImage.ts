// Generates a 1200x630 PNG (X / OGP standard) summarizing the user's
// "today's study time", and the matching pre-filled tweet text.
//
// Pure Canvas API — no third-party libraries — so this runs entirely in
// the browser. The generated Blob is handed to the share modal, which
// offers download / clipboard-copy / open-on-X actions.

export type ShareImageInput = {
  displayName: string; // e.g. "Ari"
  minutes: number; // e.g. 187
  subject: string; // e.g. "開発" — may be empty
  date: string; // e.g. "2026-05-25"
  streak: number; // e.g. 12
};

const SERVICE_NAME = "Contribution Arc";
const SERVICE_URL = "https://tatsuyaariyama.github.io/Contribution-Arc/";
const BRAND_PURPLE = "#7C5CFF";
const BRAND_PURPLE_SOFT = "#A78BFA";
const INK = "#1B1B2E";
const SUB_INK = "#5B5B73";

const FONT_STACK =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, -apple-system, "Segoe UI", sans-serif';

/** "3時間7分" / "47分" — natural Japanese duration formatting. */
function formatDurationJa(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}時間${rest}分` : `${hours}時間`;
}

/** "2026年5月25日 (月)" — long-form date for the share image. */
function formatDateLabel(isoDate: string) {
  // Accepts "YYYY-MM-DD" or full ISO. Falls back to raw string on parse fail.
  const parsed = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][parsed.getDay()];
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日 (${weekday})`;
}

/** Rounded-rect path helper (Canvas roundRect isn't on every browser). */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Render the share image to a 1200x630 PNG blob. */
export async function generateShareImagePng(input: ShareImageInput): Promise<Blob> {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable in this browser.");
  }

  // ── Background: soft off-white with a subtle purple corner glow.
  ctx.fillStyle = "#FBFAFF";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width - 80, 60, 40, width - 80, 60, 520);
  glow.addColorStop(0, "rgba(124, 92, 255, 0.22)");
  glow.addColorStop(1, "rgba(124, 92, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const sideGlow = ctx.createRadialGradient(80, height - 60, 20, 80, height - 60, 380);
  sideGlow.addColorStop(0, "rgba(167, 139, 250, 0.18)");
  sideGlow.addColorStop(1, "rgba(167, 139, 250, 0)");
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, width, height);

  // ── Inner card outline (subtle, gives the layout a "frame").
  ctx.strokeStyle = "rgba(27, 27, 46, 0.06)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, 40, 40, width - 80, height - 80, 28);
  ctx.stroke();

  // ── Top-left: username (small, muted).
  ctx.fillStyle = SUB_INK;
  ctx.font = `600 26px ${FONT_STACK}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const userLabel = (input.displayName || "Anonymous").slice(0, 22);
  ctx.fillText(userLabel, 80, 80);

  // ── Top-right: streak badge (purple pill).
  if (input.streak > 0) {
    const badgeText = `${input.streak}日連続`;
    ctx.font = `800 28px ${FONT_STACK}`;
    const padX = 24;
    const padY = 14;
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + padX * 2;
    const badgeH = 28 + padY * 2;
    const badgeX = width - 80 - badgeW;
    const badgeY = 68;

    const badgeFill = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
    badgeFill.addColorStop(0, BRAND_PURPLE);
    badgeFill.addColorStop(1, BRAND_PURPLE_SOFT);
    ctx.fillStyle = badgeFill;
    roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
  }

  // ── Hero: study time, centered, oversized.
  const heroText = formatDurationJa(input.minutes);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Split the number from the unit so the digits dominate visually.
  // Match contiguous digit runs and label them up.
  const segments: { text: string; size: number }[] = [];
  const heroRegex = /(\d+)([^\d]+)/g;
  let m: RegExpExecArray | null;
  while ((m = heroRegex.exec(heroText)) !== null) {
    segments.push({ text: m[1], size: 220 });
    segments.push({ text: m[2], size: 110 });
  }
  if (segments.length === 0) {
    segments.push({ text: heroText, size: 220 });
  }

  // Measure total width for centering.
  let totalWidth = 0;
  for (const seg of segments) {
    ctx.font = `900 ${seg.size}px ${FONT_STACK}`;
    totalWidth += ctx.measureText(seg.text).width;
  }
  const heroY = 360;
  let cursorX = width / 2 - totalWidth / 2;
  for (const seg of segments) {
    ctx.font = `900 ${seg.size}px ${FONT_STACK}`;
    const segWidth = ctx.measureText(seg.text).width;
    ctx.textAlign = "left";
    ctx.fillStyle = seg.size >= 200 ? INK : SUB_INK;
    ctx.fillText(seg.text, cursorX, heroY);
    cursorX += segWidth;
  }

  // ── Sub-line: subject · date.
  ctx.font = `700 36px ${FONT_STACK}`;
  ctx.fillStyle = SUB_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const subjectPart = input.subject ? `${input.subject} · ` : "";
  ctx.fillText(`${subjectPart}${formatDateLabel(input.date)}`, width / 2, heroY + 50);

  // ── Top-center label above the hero ("今日の作業時間").
  ctx.font = `700 30px ${FONT_STACK}`;
  ctx.fillStyle = BRAND_PURPLE;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("今日の作業時間", width / 2, heroY - 220);

  // ── Bottom-right: brand mark + URL (subtle).
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 28px ${FONT_STACK}`;
  ctx.fillStyle = INK;
  ctx.fillText(SERVICE_NAME, width - 80, height - 90);
  ctx.font = `500 22px ${FONT_STACK}`;
  ctx.fillStyle = SUB_INK;
  ctx.fillText(SERVICE_URL.replace(/^https?:\/\//, ""), width - 80, height - 60);

  // ── Tiny brand mark to the left of the service name (purple arc).
  const markX = width - 80 - ctx.measureText(SERVICE_NAME).width - 24;
  const markY = height - 100;
  ctx.strokeStyle = BRAND_PURPLE;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(markX, markY, 14, Math.PI * 0.1, Math.PI * 1.1, false);
  ctx.stroke();

  // ── Bottom-left: thin purple accent bar.
  const barFill = ctx.createLinearGradient(80, 0, 280, 0);
  barFill.addColorStop(0, BRAND_PURPLE);
  barFill.addColorStop(1, BRAND_PURPLE_SOFT);
  ctx.fillStyle = barFill;
  roundRectPath(ctx, 80, height - 100, 200, 6, 3);
  ctx.fill();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to encode share image as PNG."));
      }
    }, "image/png");
  });
}

/**
 * Build the prefilled tweet text. Aims for ≤120 chars including the URL
 * (X's t.co shortens links but we still keep the raw text compact).
 */
export function buildShareTweet(input: ShareImageInput): string {
  const duration = formatDurationJa(input.minutes);
  const subjectClause = input.subject ? `${input.subject}を` : "";
  const streakClause = input.streak > 1 ? `（${input.streak}日連続）` : "";
  const body = `今日は${subjectClause}${duration}積み上げました${streakClause}`;
  const tags = "#今日の積み上げ #ContributionArc";
  return `${body}\n${tags}\n${SERVICE_URL}`;
}
