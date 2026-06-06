// 敵マスター。静的定義（Firestore 不要）。
// hp の単位は「分」。戦闘開始後に積んだ学習時間(分)の合計が hp 以上になると撃破。

export type EnemyDef = {
  id: string;
  name: string;
  /** HP（分単位）。学習時間の合計と直接比較する。 */
  hp: number;
  /** プレースホルダ矩形の色（実画像が来るまでの暫定描画） */
  color: number;
  /** 撃破時に付与する報酬定義 id（trophies.ts） */
  rewardTrophyId: string;
  /** 一言フレーバー */
  flavor: string;
};

// 序盤は短く、徐々に長期戦に。最後は数日かけて倒す想定。
export const ENEMIES: EnemyDef[] = [
  {
    id: "slime-dusk",
    name: "まどろみスライム",
    hp: 30,
    color: 0x6c8cff,
    rewardTrophyId: "trophy-slime",
    flavor: "集中の最初の一歩を阻む、眠気の化身。",
  },
  {
    id: "golem-procrast",
    name: "先延ばしゴーレム",
    hp: 120,
    color: 0x8a7d6b,
    rewardTrophyId: "trophy-golem",
    flavor: "「あとでやる」を糧に岩のごとく動かない。",
  },
  {
    id: "wyrm-distraction",
    name: "散漫のワイバーン",
    hp: 300,
    color: 0x5fbf8f,
    rewardTrophyId: "trophy-wyrm",
    flavor: "通知の翼で羽ばたき、集中を奪い去る。",
  },
  {
    id: "lord-burnout",
    name: "燃え尽きの魔王",
    hp: 720,
    color: 0xb55b6b,
    rewardTrophyId: "trophy-lord",
    flavor: "走り続けた者にだけ現れる、最後の試練。",
  },
];

export function getEnemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id);
}

export const FIRST_ENEMY = ENEMIES[0];
