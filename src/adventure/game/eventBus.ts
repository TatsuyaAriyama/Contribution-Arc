import Phaser from "phaser";

// React ⇄ Phaser を一方向で橋渡しするシングルトン。
// React 側が状態の唯一の真実。Phaser には「描画してほしい状態」を流し込み、
// Phaser からは撃破などの演出完了通知だけを返す。
export const eventBus = new Phaser.Events.EventEmitter();

// イベント名の定数（typo 防止）
export const AdventureEvents = {
  /** React→Phaser: 現在の敵・HP状況を反映 */
  SYNC: "adventure:sync",
  /** React→Phaser: ダメージ確定（HPバー更新＋ヒット演出） */
  DAMAGE: "adventure:damage",
  /** React→Phaser: 撃破演出を依頼 */
  DEFEATED: "adventure:defeated",
  /** Phaser→React: シーン準備完了（初期 sync を投げてよい合図） */
  SCENE_READY: "adventure:sceneReady",
} as const;

/** SYNC ペイロード */
export type SyncPayload = {
  enemyId: string;
  enemyName: string;
  enemyColor: number;
  enemyMaxHp: number;
  /** 確定済みダメージ（分） */
  damageDealt: number;
  /** 在室見込みを含めた表示用ダメージ（分） */
  projectedDamage: number;
  playerColor: number;
};
