// 報酬トロフィーのマスター。静的定義。
// 撃破時に対応する trophy が ownedTrophyItems に追加され、作業部屋に飾れる（配置は後段）。

export type TrophyDef = {
  id: string;
  name: string;
  /** プレースホルダ描画の色 */
  color: number;
  /** 一言説明 */
  description: string;
};

export const TROPHIES: TrophyDef[] = [
  {
    id: "trophy-slime",
    name: "まどろみの雫",
    color: 0x6c8cff,
    description: "最初の眠気を退けた証。",
  },
  {
    id: "trophy-golem",
    name: "不動の核石",
    color: 0x8a7d6b,
    description: "先延ばしを打ち砕いた一撃の名残。",
  },
  {
    id: "trophy-wyrm",
    name: "静寂の翼",
    color: 0x5fbf8f,
    description: "散漫を断ち切り集中を取り戻した勲章。",
  },
  {
    id: "trophy-lord",
    name: "継続の王冠",
    color: 0xb55b6b,
    description: "燃え尽きをも越えた者にのみ授けられる。",
  },
];

export function getTrophyById(id: string): TrophyDef | undefined {
  return TROPHIES.find((t) => t.id === id);
}
