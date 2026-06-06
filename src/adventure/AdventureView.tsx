import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { AdventureEvents, eventBus, type SyncPayload } from "./game/eventBus";
import { ENEMIES, FIRST_ENEMY, getEnemyById } from "./data/enemies";
import { getTrophyById } from "./data/trophies";
import type { AdventureProgress, OwnedTrophy } from "./types";

// Phaser 本体はここから動的 import（lazy 境界は更に上の App 側）。
const PhaserGame = lazy(() => import("./PhaserGame"));

// App 側の StudyLog の最小形（依存を断つためローカル定義）。
type StudyLogLike = { minutes: number; createdAt: string };

export type AdventureViewProps = {
  adventureProgress: AdventureProgress | null;
  setAdventureProgress: (next: AdventureProgress) => void;
  ownedTrophyItems: OwnedTrophy[];
  setOwnedTrophyItems: (updater: (prev: OwnedTrophy[]) => OwnedTrophy[]) => void;
  studyLogs: StudyLogLike[];
  /** 在室中の見込み時間(分)。表示専用で確定ダメージとは別。 */
  currentStayMinutes: number;
  /** プレイヤーキャラの色(CSS hex) */
  playerCharacterColor: string;
  onBack: () => void;
};

function hexToNumber(hex: string, fallback = 0xb18cff): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1], 16) : fallback;
}

function makeFreshProgress(): AdventureProgress {
  return {
    currentEnemyId: FIRST_ENEMY.id,
    enemyIndex: 0,
    battleStartAt: new Date().toISOString(),
    defeatedEnemyIds: [],
  };
}

export default function AdventureView(props: AdventureViewProps) {
  const {
    adventureProgress,
    setAdventureProgress,
    setOwnedTrophyItems,
    studyLogs,
    currentStayMinutes,
    playerCharacterColor,
    onBack,
  } = props;

  // 進行が無ければ最初の敵で初期化（最初の冒険）。
  useEffect(() => {
    if (!adventureProgress) setAdventureProgress(makeFreshProgress());
  }, [adventureProgress, setAdventureProgress]);

  const progress = adventureProgress;
  const enemy = useMemo(
    () => (progress ? getEnemyById(progress.currentEnemyId) ?? FIRST_ENEMY : FIRST_ENEMY),
    [progress],
  );

  // 確定ダメージ: battleStartAt 以降の studyLogs(分)を合算。
  // closeWorkspaceSession が workspace 時間も studyLogs に積むため、
  // これだけで「作業部屋＋学習ログ」両方をカバー（二重計上しない）。
  const damageDealt = useMemo(() => {
    if (!progress) return 0;
    const start = new Date(progress.battleStartAt).getTime();
    return studyLogs
      .filter((l) => new Date(l.createdAt).getTime() >= start)
      .reduce((sum, l) => sum + (l.minutes || 0), 0);
  }, [studyLogs, progress]);

  // 在室見込みを足した表示用ダメージ（確定ダメージとは別）。
  const projectedDamage = damageDealt + Math.max(0, currentStayMinutes);

  const playerColor = useMemo(
    () => hexToNumber(playerCharacterColor),
    [playerCharacterColor],
  );

  const buildSync = (): SyncPayload => ({
    enemyId: enemy.id,
    enemyName: enemy.name,
    enemyColor: enemy.color,
    enemyMaxHp: enemy.hp,
    damageDealt,
    projectedDamage,
    playerColor,
  });

  // Phaser シーン準備完了 → 初期 sync。
  useEffect(() => {
    const onReady = () => eventBus.emit(AdventureEvents.SYNC, buildSync());
    eventBus.on(AdventureEvents.SCENE_READY, onReady);
    return () => {
      eventBus.off(AdventureEvents.SCENE_READY, onReady);
    };
    // buildSync は最新値をクロージャで掴むため依存は下の sync effect 側で扱う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemy.id, damageDealt, projectedDamage, playerColor]);

  // ダメージ/敵が変わるたびに Phaser へ反映。
  useEffect(() => {
    eventBus.emit(AdventureEvents.DAMAGE, buildSync());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [damageDealt, projectedDamage, enemy.id, playerColor]);

  // 撃破判定（確定ダメージのみで判定）。一度だけ処理。
  const defeatHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!progress) return;
    if (damageDealt < enemy.hp) return;
    if (defeatHandledRef.current === enemy.id) return;
    defeatHandledRef.current = enemy.id;

    // ① 撃破演出を依頼
    eventBus.emit(AdventureEvents.DEFEATED);

    // ② 報酬付与（重複防止）
    const trophy = getTrophyById(enemy.rewardTrophyId);
    if (trophy) {
      setOwnedTrophyItems((prev) => {
        if (prev.some((t) => t.enemyId === enemy.id)) return prev;
        const owned: OwnedTrophy = {
          id: `${trophy.id}-${Date.now()}`,
          enemyId: enemy.id,
          trophyId: trophy.id,
          acquiredAt: new Date().toISOString(),
        };
        return [...prev, owned];
      });
    }

    // ③ 次の敵へ（battleStartAt 更新で前の敵の稼ぎを持ち越さない）
    const nextIndex = progress.enemyIndex + 1;
    const nextEnemy = ENEMIES[nextIndex];
    const defeatedEnemyIds = progress.defeatedEnemyIds.includes(enemy.id)
      ? progress.defeatedEnemyIds
      : [...progress.defeatedEnemyIds, enemy.id];

    // 撃破演出を見せてから遷移
    const timer = window.setTimeout(() => {
      if (nextEnemy) {
        setAdventureProgress({
          currentEnemyId: nextEnemy.id,
          enemyIndex: nextIndex,
          battleStartAt: new Date().toISOString(),
          defeatedEnemyIds,
        });
        defeatHandledRef.current = null;
      } else {
        // 全敵撃破: 進行は最後の敵のまま、defeated に記録だけ残す
        setAdventureProgress({
          ...progress,
          defeatedEnemyIds,
        });
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [damageDealt, enemy, progress, setAdventureProgress, setOwnedTrophyItems]);

  const remaining = Math.max(0, enemy.hp - damageDealt);
  const allDefeated =
    progress?.enemyIndex === ENEMIES.length - 1 &&
    progress?.defeatedEnemyIds.includes(enemy.id);

  return (
    <div className="adventure-view">
      <div className="adventure-topbar">
        <button type="button" className="adventure-back" onClick={onBack}>
          ← 作業部屋へ戻る
        </button>
        <div className="adventure-progress-label">
          {allDefeated
            ? "全ての敵を撃破！"
            : `${enemy.name}（残り ${Math.round(remaining)} 分）`}
        </div>
      </div>

      <div className="adventure-stage">
        <Suspense
          fallback={<div className="adventure-loading">冒険を準備中…</div>}
        >
          <PhaserGame />
        </Suspense>
      </div>

      <div className="adventure-hint">
        学習を記録すると、その時間ぶん敵にダメージが入ります。
        {currentStayMinutes > 0
          ? `（在室中の見込み +${Math.round(currentStayMinutes)} 分）`
          : ""}
      </div>
    </div>
  );
}
