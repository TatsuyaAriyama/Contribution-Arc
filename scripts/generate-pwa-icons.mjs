// Re-render the brand image into the raster icon sizes iOS / Android /
// browsers each insist on. Re-run after editing the source image with:
//   node scripts/generate-pwa-icons.mjs
//
// Outputs land in /public so the manifest + index.html can reference
// them directly. The maskable variant adds an inset safe zone so the
// icon survives Android's circular / squircle cropping.
//
// Source: contribution-arc-icon.png (1024×1024 recommended). We switched
// from SVG to PNG so designers can drop a finished rendering straight
// in without touching SVG paths.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
const sourceImagePath = resolve(publicDir, "contribution-arc-icon.png");

mkdirSync(publicDir, { recursive: true });
const sourceBuffer = readFileSync(sourceImagePath);

const APPLE_BG = "#0f0f10";
const MASKABLE_INSET = 0.18;

const targets = [
  { file: "icon-192.png", size: 192, background: null, inset: 0 },
  { file: "icon-512.png", size: 512, background: null, inset: 0 },
  { file: "icon-maskable-512.png", size: 512, background: APPLE_BG, inset: MASKABLE_INSET },
  { file: "apple-touch-icon.png", size: 180, background: APPLE_BG, inset: 0 },
];

for (const target of targets) {
  const out = resolve(publicDir, target.file);
  const innerSize = Math.round(target.size * (1 - target.inset * 2));
  const inner = await sharp(sourceBuffer)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  let pipeline = sharp({
    create: {
      width: target.size,
      height: target.size,
      channels: 4,
      background: target.background || { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: inner, gravity: "center" }]);

  await pipeline.png({ compressionLevel: 9 }).toFile(out);
  console.log("→", target.file, `${target.size}×${target.size}`);
}
