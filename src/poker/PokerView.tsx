import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDeck,
  computePayout,
  evaluateHand,
  PAYTABLE,
  shuffle,
  type Card,
  type HandEval,
} from "./engine";
import {
  isPokerSoundsMuted,
  playChip,
  playDealSequence,
  playFlip,
  playHold,
  playJackpot,
  playLose,
  playShuffle,
  playWin,
  setPokerSoundsMuted,
} from "./sounds";
import { useTranslation } from "../i18n/LanguageContext";

type Phase = "idle" | "dealt" | "settled";
type BetMode = "normal" | "focus";

type PokerViewProps = {
  onBack: () => void;
  arcBalance: number;
  pokerChips: number;
  focusChips: number;
  setArcBalance: (updater: (prev: number) => number) => void;
  setPokerChips: (updater: (prev: number) => number) => void;
  setFocusChips: (updater: (prev: number) => number) => void;
  onOpenShop: () => void;
};

/* Bet ladders. Normal-mode bets are denominated in chips. Focus-mode
   bets count whole Focus Chips spent (each one is worth 100 "stake
   units" vs. normal, then the payout gets a 1.5× boost). */
const NORMAL_BET_STEPS = [10, 25, 50, 100, 250];
const FOCUS_BET_STEPS = [1, 2, 3, 4, 5];

const NORMAL_CHIP_PER_ARC = 100;
const CASHOUT_CHIP_UNIT = 1000; // 1000 chips → 5 Arc
const CASHOUT_ARC_RATE = 5;
const FOCUS_PAYOUT_MULTIPLIER = 1.5; // Focus chip mode pays 150 % of normal.
const FOCUS_STAKE_UNIT = 100; // 1 Focus Chip == 100 chip-equivalent of stake.
const HOT_STREAK_THRESHOLD = 3;
const HOT_STREAK_BONUS = 1.2;
/* Double-up — 勝った直後だけ "倍 or ゼロ" の higher / lower ミニ
   ゲームを提示する。ディーラ札 1 枚に対し、次の山札の値が上か下かを
   当てる。連続で挑戦できるが、安全弁として最大 5 回 (= 最大 32 倍) で
   強制 collect、あと累積 payout が一定額を超えたら自動 collect。
   tie は player loss = ハウスエッジ。 */
const DOUBLE_UP_MAX_ROUNDS = 5;
const DOUBLE_UP_AUTO_COLLECT_CHIPS = 5000;

export default function PokerView({
  onBack,
  arcBalance,
  pokerChips,
  focusChips,
  setArcBalance,
  setPokerChips,
  setFocusChips,
  onOpenShop,
}: PokerViewProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<BetMode>("normal");
  const [normalBetIdx, setNormalBetIdx] = useState(0);
  const [focusBetIdx, setFocusBetIdx] = useState(0);
  const [hand, setHand] = useState<Card[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [deck, setDeck] = useState<Card[]>([]);
  /* One monotonically-incrementing id per card slot. DEAL refreshes all
     five; DRAW refreshes only the slots the player did not HOLD. We
     wire these into the React `key` attribute so the CSS deal-in
     animation fires exactly on the slots that just changed — held
     cards stay still, redrawn cards flip in. */
  const [cardKeys, setCardKeys] = useState<number[]>([0, 0, 0, 0, 0]);
  const cardKeyCounterRef = useRef(0);
  const nextCardKey = () => ++cardKeyCounterRef.current;
  /* Displayed chip balance — animates toward `pokerChips` so wins feel
     like the credits tick up. Updated by an effect below. */
  const [displayChips, setDisplayChips] = useState(pokerChips);
  const [lastResult, setLastResult] = useState<{
    evaluation: HandEval;
    payout: number;
    hotStreakBonus: boolean;
  } | null>(null);
  const [winStreak, setWinStreak] = useState(0);
  /* Set true when the result that JUST settled was eligible for a
     streak bonus. We use it to flash the HOT STREAK chip and the
     bonus was already applied to `lastResult.payout`. */
  const [streakConsumed, setStreakConsumed] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  /* Double-up state machine — only meaningful after a winning DRAW. */
  type DoubleUpState =
    | { kind: "idle" }
    | { kind: "offered" }
    | { kind: "pending"; dealer: Card; guess: "higher" | "lower" }
    | { kind: "result"; dealer: Card; next: Card; guess: "higher" | "lower"; won: boolean };
  const [doubleUp, setDoubleUp] = useState<DoubleUpState>({ kind: "idle" });
  const [doubleUpCount, setDoubleUpCount] = useState(0);
  /* 確定した payout を実際にチップ残高へ振り込むまでの中継口座。
     double-up で wager にもなる。collect で pokerChips に流し込む。 */
  const [pendingPayout, setPendingPayout] = useState(0);
  /* サウンド mute toggle。localStorage に永続化。AudioContext の
     ユーザーゲスチャ起動 (Safari/Chrome の制約) は、最初にクリックされる
     deal / hold / collect 等の handler 内で発火する音で自然に通る。 */
  const [soundsMuted, setSoundsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ca:poker-muted") === "1";
  });
  useEffect(() => {
    setPokerSoundsMuted(soundsMuted);
    try {
      window.localStorage.setItem("ca:poker-muted", soundsMuted ? "1" : "0");
    } catch {
      /* private mode 等で localStorage が使えなくても致命的でない */
    }
  }, [soundsMuted]);
  /* 初期 hydrate 時に既存 setting を sounds モジュールに反映。 */
  useEffect(() => {
    setPokerSoundsMuted(soundsMuted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* 互換: 別ファイルで isPokerSoundsMuted を読みたい場面用 (現状未使用)。 */
  void isPokerSoundsMuted;

  const normalBet = NORMAL_BET_STEPS[normalBetIdx];
  const focusBet = FOCUS_BET_STEPS[focusBetIdx];
  const activeBet = mode === "normal" ? normalBet : focusBet;
  const activeBalance = mode === "normal" ? pokerChips : focusChips;

  const willTriggerStreakBonus =
    !streakConsumed && winStreak >= HOT_STREAK_THRESHOLD;

  const currentEval = useMemo(() => {
    if (hand.length !== 5) return null;
    return evaluateHand(hand);
  }, [hand]);

  /* double-up が pending (guess 待ち) / result (reveal 中) の間は
     deal をブロックする。offered (collect or double up の選択待ち) は
     handleDeal 内で auto-collect 経由で許容。 */
  const canDeal =
    phase !== "dealt" &&
    activeBalance >= activeBet &&
    doubleUp.kind !== "pending" &&
    doubleUp.kind !== "result";
  const canDraw = phase === "dealt";

  /* Count-up animation for the chip balance display. When `pokerChips`
     jumps (deal cost / win payout), tween the visible number over ~600ms
     so it feels like the credit counter is settling. requestAnimationFrame
     keeps it smooth without locking the main thread on a setInterval. */
  useEffect(() => {
    if (displayChips === pokerChips) return;
    const start = displayChips;
    const delta = pokerChips - start;
    const duration = Math.min(900, 350 + Math.abs(delta) * 0.6);
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      // Ease-out cubic.
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + delta * eased);
      setDisplayChips(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokerChips]);

  function handleDeal() {
    if (!canDeal) return;
    if (doubleUp.kind === "offered" && pendingPayout > 0) {
      setPokerChips((c) => c + pendingPayout);
      setPendingPayout(0);
      setDoubleUp({ kind: "idle" });
      setDoubleUpCount(0);
      playChip();
    }
    const fresh = shuffle(buildDeck());
    const newHand = fresh.slice(0, 5);
    setDeck(fresh.slice(5));
    setHand(newHand);
    setHeld([false, false, false, false, false]);
    setCardKeys([nextCardKey(), nextCardKey(), nextCardKey(), nextCardKey(), nextCardKey()]);
    if (mode === "normal") {
      setPokerChips((c) => c - normalBet);
    } else {
      setFocusChips((c) => c - focusBet);
    }
    setLastResult(null);
    setStreakConsumed(false);
    setPhase("dealt");
    /* シャッフルの "ザザッ" → 5 枚連続 deal "コツコツコツコツコツ" */
    playShuffle();
    window.setTimeout(() => playDealSequence(5, 90), 280);
  }

  function handleDraw() {
    if (!canDraw) return;
    const remaining = [...deck];
    const finalHand = hand.map((card, idx) => {
      if (held[idx]) return card;
      return remaining.shift() ?? card;
    });
    setCardKeys((prev) => prev.map((k, i) => (held[i] ? k : nextCardKey())));
    /* 引いた枚数だけ flip 音を staggered で鳴らす。 */
    const drawnCount = held.filter((h) => !h).length;
    playDealSequence(drawnCount, 80);
    const evaluation = evaluateHand(finalHand);

    /* Convert the chosen stake to a per-credit base, then apply the
       focus multiplier and the hot-streak bonus on top. Payout always
       lands in normal chips so the cashout pipeline (chips → Arc)
       stays single-currency on the way out. */
    let payout = 0;
    if (evaluation.payoutPerCredit > 0) {
      if (mode === "normal") {
        payout = computePayout(evaluation, normalBet);
      } else {
        // Per-credit table × 1 (Royal special-case below) × focus stake × 1.5
        const royalMax = evaluation.rank === "royal-flush" && focusBet === 5;
        const perCredit = royalMax ? 800 : evaluation.payoutPerCredit;
        payout = Math.round(
          perCredit * focusBet * FOCUS_STAKE_UNIT * FOCUS_PAYOUT_MULTIPLIER,
        );
      }
    }

    let hotStreakBonus = false;
    if (payout > 0 && willTriggerStreakBonus) {
      payout = Math.round(payout * HOT_STREAK_BONUS);
      hotStreakBonus = true;
    }

    setHand(finalHand);
    setDeck(remaining);
    setLastResult({ evaluation, payout, hotStreakBonus });

    if (payout > 0) {
      setWinStreak((s) => (hotStreakBonus ? 0 : s + 1));
      if (hotStreakBonus) setStreakConsumed(true);
      if (mode === "normal") {
        setPendingPayout(payout);
        setDoubleUp({ kind: "offered" });
        setDoubleUpCount(0);
      } else {
        setPokerChips((c) => c + payout);
      }
      /* 5 枚 reveal の後に勝ち音 → Royal/Straight Flush 級はジャックポット
         ファンファーレ、それ以外は二段の和音。 */
      const isJackpot =
        evaluation.rank === "royal-flush" || evaluation.rank === "straight-flush";
      window.setTimeout(() => {
        if (isJackpot) playJackpot();
        else playWin(payout >= 500 ? "big" : "small");
      }, 520);
    } else {
      setWinStreak(0);
      window.setTimeout(() => playLose(), 520);
    }
    setPhase("settled");
  }

  /* 確定した payout を chip balance に振り込む。double-up を 1 回でも
     通したら積み上がった額がここで一気に入る。
     pendingPayout = 0 のときは no-op (loss / 既に collect 済み)。 */
  function handleCollect() {
    if (pendingPayout <= 0) {
      setDoubleUp({ kind: "idle" });
      return;
    }
    setPokerChips((c) => c + pendingPayout);
    setPendingPayout(0);
    setDoubleUp({ kind: "idle" });
    setDoubleUpCount(0);
    playChip();
  }

  /* Double-up を開始する。山札から 1 枚引いてディーラの face-up カード
     とし、player は次に出る札が "higher" か "lower" かを当てる。 */
  function handleStartDoubleUp() {
    if (pendingPayout <= 0) return;
    if (deck.length < 1) {
      handleCollect();
      return;
    }
    const remaining = [...deck];
    const dealer = remaining.shift()!;
    setDeck(remaining);
    setDoubleUp({ kind: "pending", dealer, guess: "higher" });
    playFlip(440, 0.06);
  }

  /* Higher / Lower の guess を確定して結果を出す。tie は loss
     (ハウスエッジ)。win なら pendingPayout を倍にして、上限内なら
     もう一度 offered に戻す。上限到達なら強制 collect。 */
  function handleDoubleUpGuess(guess: "higher" | "lower") {
    if (doubleUp.kind !== "pending") return;
    const dealer = doubleUp.dealer;
    if (deck.length < 1) {
      // Shouldn't happen but recover by paying out the safe amount.
      handleCollect();
      return;
    }
    const remaining = [...deck];
    const next = remaining.shift()!;
    setDeck(remaining);
    const won = guess === "higher" ? next.value > dealer.value : next.value < dealer.value;
    setDoubleUp({ kind: "result", dealer, next, guess, won });
    /* reveal の "コトッ" → 0.4 秒後に勝敗音 */
    playFlip(380, 0.07);
    window.setTimeout(() => (won ? playWin("big") : playLose()), 380);
    if (won) {
      const doubled = pendingPayout * 2;
      setPendingPayout(doubled);
      const nextCount = doubleUpCount + 1;
      setDoubleUpCount(nextCount);
      const shouldAutoCollect =
        nextCount >= DOUBLE_UP_MAX_ROUNDS || doubled >= DOUBLE_UP_AUTO_COLLECT_CHIPS;
      // 1.4 秒見せてから次の状態へ (offer or 強制 collect)
      window.setTimeout(() => {
        if (shouldAutoCollect) {
          setPokerChips((c) => c + doubled);
          setPendingPayout(0);
          setDoubleUp({ kind: "idle" });
          setDoubleUpCount(0);
        } else {
          setDoubleUp({ kind: "offered" });
        }
      }, 1400);
    } else {
      // 失った reveal を 1.4 秒見せてから idle に戻す。pendingPayout=0。
      window.setTimeout(() => {
        setPendingPayout(0);
        setDoubleUp({ kind: "idle" });
        setDoubleUpCount(0);
      }, 1400);
    }
  }

  function toggleHold(idx: number) {
    if (phase !== "dealt") return;
    setHeld((prev) => prev.map((v, i) => (i === idx ? !v : v)));
    playHold();
  }

  function pickBetIdx(idx: number) {
    if (phase === "dealt") return;
    if (mode === "normal") {
      setNormalBetIdx(Math.max(0, Math.min(NORMAL_BET_STEPS.length - 1, idx)));
    } else {
      setFocusBetIdx(Math.max(0, Math.min(FOCUS_BET_STEPS.length - 1, idx)));
    }
  }

  function switchMode(next: BetMode) {
    if (phase === "dealt") return;
    setMode(next);
  }

  /* Buying chips: spend N Arc → gain N × 100 chips. */
  function buyChipsWithArc(arcAmount: number) {
    if (arcAmount <= 0 || arcAmount > arcBalance) return;
    setArcBalance((v) => v - arcAmount);
    setPokerChips((v) => v + arcAmount * NORMAL_CHIP_PER_ARC);
  }

  /* Cashing out: spend 1000 chips → gain 5 Arc, in units of 1000. */
  function cashOutChipsToArc(chipAmount: number) {
    const units = Math.floor(chipAmount / CASHOUT_CHIP_UNIT);
    if (units <= 0) return;
    const spend = units * CASHOUT_CHIP_UNIT;
    if (spend > pokerChips) return;
    setPokerChips((v) => v - spend);
    setArcBalance((v) => v + units * CASHOUT_ARC_RATE);
  }

  return (
    <div className="poker-root">
      <div className="poker-topbar">
        <button type="button" onClick={onBack} className="poker-back">
          {t("← 作業部屋に戻る")}
        </button>
        <div className="poker-title">
          <p className="poker-kicker">Video Poker · Jacks or Better (6/5)</p>
          <h1>{t("♠ Arc を増やすには集中して稼ぐ。")}</h1>
        </div>
        <button
          type="button"
          className={`poker-mute-toggle${soundsMuted ? " is-muted" : ""}`}
          onClick={() => setSoundsMuted((m) => !m)}
          aria-pressed={soundsMuted}
          aria-label={soundsMuted ? t("サウンドをオン") : t("サウンドをオフ")}
          title={soundsMuted ? t("サウンドをオン") : t("サウンドをオフ")}
        >
          {soundsMuted ? "🔇" : "🔊"}
        </button>
        <div className="poker-balances" aria-label={t("残高")}>
          <div className="poker-meter" title={t("Arc 残高")}>
            <span className="poker-meter-label">Arc</span>
            <span className="poker-meter-value">{arcBalance.toLocaleString()}</span>
          </div>
          <span className="poker-meter-sep" aria-hidden="true" />
          <div className="poker-meter" title={t("ポーカーチップ残高")}>
            <span className="poker-meter-label">Chip</span>
            <span className="poker-meter-value">{displayChips.toLocaleString()}</span>
          </div>
          <span className="poker-meter-sep" aria-hidden="true" />
          <div
            className={`poker-meter is-focus${focusChips > 0 ? " has-charge" : ""}`}
            title={t("今日のFocus Chip残高（集中作業で獲得）")}
          >
            <span className="poker-meter-label">
              <span className="poker-meter-dot" aria-hidden="true" />
              Focus
            </span>
            <span className="poker-meter-value">{focusChips}</span>
          </div>
        </div>
      </div>

      <section className="poker-stage">
        <div className="poker-paytable" aria-label={t("ペイテーブル")}>
          <p className="poker-paytable-title">Paytable (×bet)</p>
          <ul>
            {PAYTABLE.map((row) => {
              const active = currentEval?.rank === row.rank;
              return (
                <li
                  key={row.rank}
                  className={`poker-paytable-row${active ? " is-active" : ""}`}
                >
                  <span>{row.label}</span>
                  <span>{row.perCredit}</span>
                </li>
              );
            })}
          </ul>
          <p className="poker-paytable-note">
            {t("Royal Flush は MAX BET 時 800×bet。")}<br />
            {t("Focus Chip モードは全配当 ×1.5、HOT STREAK は次の当たり配当 +20%。")}
          </p>
        </div>

        <div
          className={`poker-table${
            lastResult && lastResult.payout > 0 ? " is-winning" : ""
          }${winStreak >= HOT_STREAK_THRESHOLD ? " is-armed" : ""}${
            lastResult &&
            (lastResult.evaluation.rank === "royal-flush" ||
              lastResult.evaluation.rank === "straight-flush" ||
              lastResult.evaluation.rank === "four-of-a-kind")
              ? " is-jackpot"
              : ""
          }`}
        >
          {/* Felt highlights — pure CSS, no DOM cost beyond two layers */}
          <div className="poker-table-glow" aria-hidden="true" />
          <div className="poker-table-rim" aria-hidden="true" />

          <div className="poker-streak-row">
            <div
              className={`poker-streak${
                winStreak >= HOT_STREAK_THRESHOLD ? " is-armed" : ""
              }`}
              aria-label={t("連勝カウンタ")}
            >
              {winStreak >= HOT_STREAK_THRESHOLD ? (
                <>
                  <span className="poker-streak-flame">🔥</span>
                  <span>HOT STREAK</span>
                  <span className="poker-streak-bonus">+20%</span>
                </>
              ) : (
                <>
                  <span>WIN STREAK</span>
                  <span className="poker-streak-dots">
                    {Array.from({ length: HOT_STREAK_THRESHOLD }).map((_, i) => (
                      <span
                        key={i}
                        className={`poker-streak-dot${i < winStreak ? " is-lit" : ""}`}
                      />
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="poker-hand">
            {hand.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="poker-card is-placeholder"
                    style={{ ["--deal-delay" as string]: `${i * 70}ms` }}
                  >
                    <div className="poker-card-back" aria-hidden="true">
                      <span>♠</span>
                    </div>
                  </div>
                ))
              : hand.map((card, i) => {
                  const isRed = card.suit === "♥" || card.suit === "♦";
                  return (
                    <button
                      key={cardKeys[i]}
                      type="button"
                      className={`poker-card${held[i] ? " is-held" : ""}${
                        isRed ? " is-red" : ""
                      }${phase === "settled" ? " is-locked" : ""}`}
                      style={{ ["--deal-delay" as string]: `${i * 70}ms` }}
                      onClick={() => toggleHold(i)}
                      disabled={phase !== "dealt"}
                      aria-label={`${card.rank} of ${card.suit}${held[i] ? " HELD" : ""}`}
                    >
                      <span className="poker-card-corner top">
                        <span className="poker-card-rank">{card.rank}</span>
                        <span className="poker-card-suit-mini">{card.suit}</span>
                      </span>
                      <span className="poker-card-suit-center">{card.suit}</span>
                      <span className="poker-card-corner bottom">
                        <span className="poker-card-rank">{card.rank}</span>
                        <span className="poker-card-suit-mini">{card.suit}</span>
                      </span>
                      <span className="poker-card-hold">HOLD</span>
                    </button>
                  );
                })}
          </div>

          <div className="poker-result" aria-live="polite">
            {phase === "idle" ? (
              <p className="poker-result-hint">
                {t("ベットを決めて ")}<strong>DEAL</strong>{t("。")}
              </p>
            ) : phase === "dealt" ? (
              <p className="poker-result-hint">
                {t("残したい札をタップ → ")}<strong>DRAW</strong>{t("。")}
              </p>
            ) : doubleUp.kind === "offered" && pendingPayout > 0 ? (
              <div className="poker-doubleup poker-doubleup-offered">
                <p className="poker-doubleup-title">
                  {lastResult ? lastResult.evaluation.label : ""}
                </p>
                <p className="poker-doubleup-pending">
                  <span className="poker-doubleup-plus">+</span>
                  <span className="poker-doubleup-amount">
                    {pendingPayout.toLocaleString()}
                  </span>
                  <span className="poker-doubleup-unit">chip</span>
                </p>
                <p className="poker-doubleup-meta">
                  {doubleUpCount > 0
                    ? t("{n} 連続成功 → 受け取る or もう一度倍にする", { n: doubleUpCount })
                    : t("受け取る or 2倍に挑戦")}
                </p>
                <div className="poker-doubleup-actions">
                  <button
                    type="button"
                    className="poker-doubleup-collect"
                    onClick={handleCollect}
                  >
                    {t("受け取る +{n}", { n: pendingPayout.toLocaleString() })}
                  </button>
                  <button
                    type="button"
                    className="poker-doubleup-go"
                    onClick={handleStartDoubleUp}
                  >
                    {t("2× DOUBLE UP")}
                  </button>
                </div>
              </div>
            ) : doubleUp.kind === "pending" ? (
              <div className="poker-doubleup poker-doubleup-pending">
                <p className="poker-doubleup-title">{t("Higher or Lower?")}</p>
                <div className="poker-doubleup-cards">
                  <div
                    className={`poker-doubleup-card is-dealer${
                      doubleUp.dealer.suit === "♥" || doubleUp.dealer.suit === "♦"
                        ? " is-red"
                        : ""
                    }`}
                  >
                    <span className="poker-doubleup-card-rank">{doubleUp.dealer.rank}</span>
                    <span className="poker-doubleup-card-suit">{doubleUp.dealer.suit}</span>
                  </div>
                  <span className="poker-doubleup-vs">vs</span>
                  <div className="poker-doubleup-card is-back">
                    <span>?</span>
                  </div>
                </div>
                <p className="poker-doubleup-meta">
                  {t("次の札が dealer ({rank}) より高い / 低い を選ぶ。tie = 負け", {
                    rank: doubleUp.dealer.rank,
                  })}
                </p>
                <div className="poker-doubleup-actions">
                  <button
                    type="button"
                    className="poker-doubleup-guess"
                    onClick={() => handleDoubleUpGuess("lower")}
                    disabled={doubleUp.dealer.value <= 2}
                  >
                    ↓ {t("Lower")}
                  </button>
                  <button
                    type="button"
                    className="poker-doubleup-guess"
                    onClick={() => handleDoubleUpGuess("higher")}
                    disabled={doubleUp.dealer.value >= 14}
                  >
                    ↑ {t("Higher")}
                  </button>
                </div>
              </div>
            ) : doubleUp.kind === "result" ? (
              <div
                className={`poker-doubleup poker-doubleup-reveal${
                  doubleUp.won ? " is-win" : " is-loss"
                }`}
              >
                <div className="poker-doubleup-cards">
                  <div
                    className={`poker-doubleup-card is-dealer${
                      doubleUp.dealer.suit === "♥" || doubleUp.dealer.suit === "♦"
                        ? " is-red"
                        : ""
                    }`}
                  >
                    <span className="poker-doubleup-card-rank">{doubleUp.dealer.rank}</span>
                    <span className="poker-doubleup-card-suit">{doubleUp.dealer.suit}</span>
                  </div>
                  <span className="poker-doubleup-vs">
                    {doubleUp.guess === "higher" ? "↑" : "↓"}
                  </span>
                  <div
                    className={`poker-doubleup-card is-reveal${
                      doubleUp.next.suit === "♥" || doubleUp.next.suit === "♦" ? " is-red" : ""
                    }`}
                  >
                    <span className="poker-doubleup-card-rank">{doubleUp.next.rank}</span>
                    <span className="poker-doubleup-card-suit">{doubleUp.next.suit}</span>
                  </div>
                </div>
                <p className="poker-doubleup-result-text">
                  {doubleUp.won
                    ? t("DOUBLED! → {n} chip", { n: (pendingPayout).toLocaleString() })
                    : t("負け。失効。")}
                </p>
              </div>
            ) : lastResult ? (
              <div
                key={cardKeys.join("-")}
                className={`poker-result-card${
                  lastResult.payout > 0 ? " is-win" : " is-loss"
                }${lastResult.hotStreakBonus ? " is-bonus" : ""}`}
              >
                <p className="poker-result-rank">{lastResult.evaluation.label}</p>
                <p className="poker-result-payout">
                  {lastResult.payout > 0 ? (
                    <>
                      <span className="poker-result-plus">+</span>
                      <span className="poker-result-amount">
                        {lastResult.payout.toLocaleString()}
                      </span>
                      <span className="poker-result-unit">chip</span>
                      {lastResult.hotStreakBonus ? (
                        <span className="poker-result-bonus-tag">🔥 STREAK</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="poker-result-zero">{t("ノーペイ")}</span>
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="poker-side">
          {/* Bet mode — underline tabs */}
          <div className="poker-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "normal"}
              className={`poker-mode-tab${mode === "normal" ? " is-active" : ""}`}
              onClick={() => switchMode("normal")}
              disabled={phase === "dealt"}
            >
              {t("通常チップ")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "focus"}
              className={`poker-mode-tab${mode === "focus" ? " is-active" : ""}${
                focusChips === 0 ? " is-empty" : ""
              }`}
              onClick={() => switchMode("focus")}
              disabled={phase === "dealt" || focusChips === 0}
              title={
                focusChips === 0
                  ? t("作業部屋に25分滞在で Focus Chip を獲得（1日8枚まで）")
                  : t("配当 ×1.5")
              }
            >
              <span className="poker-mode-tab-text">Focus</span>
              <span className="poker-mode-tab-meta">×1.5</span>
            </button>
          </div>

          {/* Bet — flat group with chip selector */}
          <div className="poker-bet-group">
            <div className="poker-bet-head">
              <span className="poker-bet-head-label">Bet</span>
              <span className="poker-bet-head-amount" key={`${mode}-${activeBet}`}>
                <span className="poker-bet-head-num">{activeBet}</span>
                <span className="poker-bet-head-unit">
                  {mode === "normal" ? "chip" : "focus"}
                </span>
              </span>
            </div>
            <div className="poker-bet-chips" role="group" aria-label={t("ベット額")}>
              {(mode === "normal" ? NORMAL_BET_STEPS : FOCUS_BET_STEPS).map((step, i) => {
                const activeIdx = mode === "normal" ? normalBetIdx : focusBetIdx;
                return (
                  <button
                    key={step}
                    type="button"
                    className={`poker-bet-chip${i === activeIdx ? " is-active" : ""}`}
                    onClick={() => pickBetIdx(i)}
                    disabled={phase === "dealt"}
                    aria-pressed={i === activeIdx}
                  >
                    {step}
                  </button>
                );
              })}
            </div>
            <p className="poker-bet-note">
              {mode === "normal"
                ? t("RTP 95% — 長くやると確率的に負け越す")
                : t("配当 ×1.5 — 集中で稼いだ Focus でだけ勝ち越せる")}
            </p>
          </div>

          {/* Primary action */}
          {phase === "dealt" ? (
            <button
              type="button"
              className="poker-cta is-draw"
              onClick={handleDraw}
            >
              <span className="poker-cta-label">Draw</span>
              <span className="poker-cta-sub">{t("残してない札を交換")}</span>
            </button>
          ) : (
            <button
              type="button"
              className="poker-cta is-deal"
              onClick={handleDeal}
              disabled={!canDeal}
            >
              <span className="poker-cta-label">
                {canDeal ? "Deal" : mode === "normal" ? t("チップ不足") : t("Focus 不足")}
              </span>
              <span className="poker-cta-sub">
                {canDeal
                  ? `−${activeBet} ${mode === "normal" ? "chip" : "focus"}`
                  : t("両替が必要です")}
              </span>
            </button>
          )}

          <button
            type="button"
            className="poker-link"
            onClick={() => setExchangeOpen((v) => !v)}
            disabled={phase === "dealt"}
          >
            {exchangeOpen ? t("両替を閉じる") : t("Arc ⇄ チップ 両替")}
          </button>
        </div>
      </section>

      {exchangeOpen && phase !== "dealt" ? (
        <section className="poker-exchange">
          <header>
            <h2>{t("両替・換金")}</h2>
            <p>
              {t("Arc → チップは 1 Arc = {chip} chip。チップ → Arc は {cashout} chip = {arc} Arc。", {
                chip: NORMAL_CHIP_PER_ARC,
                cashout: CASHOUT_CHIP_UNIT,
                arc: CASHOUT_ARC_RATE,
              })}
            </p>
          </header>
          <div className="poker-exchange-grid">
            <div className="poker-exchange-card">
              <p className="poker-exchange-card-title">Arc → chip</p>
              <p className="poker-exchange-card-sub">
                {t("所持 Arc: {n}", { n: arcBalance.toLocaleString() })}
              </p>
              <div className="poker-exchange-buttons">
                {[1, 5, 10, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={amt > arcBalance}
                    onClick={() => buyChipsWithArc(amt)}
                  >
                    {t("{amt} Arc", { amt })}<br />
                    <span>{t("→ {n} chip", { n: (amt * NORMAL_CHIP_PER_ARC).toLocaleString() })}</span>
                  </button>
                ))}
              </div>
              {arcBalance < 1 ? (
                <button
                  type="button"
                  className="poker-buy-arc"
                  onClick={onOpenShop}
                >
                  {t("Arc が足りません → ショップへ")}
                </button>
              ) : null}
            </div>
            <div className="poker-exchange-card">
              <p className="poker-exchange-card-title">chip → Arc</p>
              <p className="poker-exchange-card-sub">
                {t("所持 chip: {n}", { n: pokerChips.toLocaleString() })}
              </p>
              <div className="poker-exchange-buttons">
                {[1000, 5000, 10000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={amt > pokerChips}
                    onClick={() => cashOutChipsToArc(amt)}
                  >
                    {amt.toLocaleString()} chip<br />
                    <span>
                      → {(amt / CASHOUT_CHIP_UNIT) * CASHOUT_ARC_RATE} Arc
                    </span>
                  </button>
                ))}
              </div>
              <p className="poker-exchange-tip">
                {t("換金レートは購入レートより辛口。たくさん勝ってまとめて換金しよう。")}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
