// 冒険(Adventure)RPG機能の型定義。
// 唯一の真実(state)は React 側。Phaser は描画従属レイヤー。

/** 戦闘の進行状況。Firestore の users doc に相乗りで永続化する。 */
export type AdventureProgress = {
  /** 現在戦っている敵の id（enemies.ts の定義キー） */
  currentEnemyId: string;
  /** 何体目か（0 始まり）。enemies 配列のインデックス。 */
  enemyIndex: number;
  /** この敵との戦闘を開始した時刻(ISO)。これ以降の studyLogs を集計してダメージにする。 */
  battleStartAt: string;
  /** 撃破済みの敵 id 一覧（重複報酬防止・進行表示用） */
  defeatedEnemyIds: string[];
};

/** 獲得した報酬トロフィー。作業部屋に飾れる（配置は後段）。 */
export type OwnedTrophy = {
  /** 一意 id（trophyId + acquiredAt などから生成） */
  id: string;
  /** どの敵を倒して得たか */
  enemyId: string;
  /** 報酬定義 id（trophies.ts） */
  trophyId: string;
  /** 獲得時刻(ISO) */
  acquiredAt: string;
  /** 作業部屋に飾る座標（任意・後段で使用） */
  x?: number;
  y?: number;
};
