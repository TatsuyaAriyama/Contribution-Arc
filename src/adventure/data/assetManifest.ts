// アセットのキー→パス対応。
// Pages(/Contribution-Arc/) と Electron(./) の両対応のため、
// 必ず import.meta.env.BASE_URL を前置する（Phaser の load パスにハードコード禁止）。

// 実画像が未調達のため、初期はプレースホルダ矩形で描画する。
// 実ファイルを public/adventure/ に置いたら false にしてパスを書き換える。
export const USE_PLACEHOLDER = true;

const base = import.meta.env.BASE_URL;

/** キー → 実ファイルパス（USE_PLACEHOLDER=false のときに使用） */
export const ASSET_MANIFEST = {
  battleBackground: `${base}adventure/battle-bg.png`,
  player: `${base}adventure/player.png`,
  // 敵スプライトは enemyId をキーにする
  "enemy-slime-dusk": `${base}adventure/enemy-slime-dusk.png`,
  "enemy-golem-procrast": `${base}adventure/enemy-golem-procrast.png`,
  "enemy-wyrm-distraction": `${base}adventure/enemy-wyrm-distraction.png`,
  "enemy-lord-burnout": `${base}adventure/enemy-lord-burnout.png`,
} as const;

export type AssetKey = keyof typeof ASSET_MANIFEST;
