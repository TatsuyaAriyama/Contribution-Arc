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

  const canDeal = phase !== "dealt" && activeBalance >= activeBet;
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
    const fresh = shuffle(buildDeck());
    const newHand = fresh.slice(0, 5);
    setDeck(fresh.slice(5));
    setHand(newHand);
    setHeld([false, false, false, false, false]);
    // Re-key every slot so the deal-in animation fires for all five.
    setCardKeys([nextCardKey(), nextCardKey(), nextCardKey(), nextCardKey(), nextCardKey()]);
    if (mode === "normal") {
      setPokerChips((c) => c - normalBet);
    } else {
      setFocusChips((c) => c - focusBet);
    }
    setLastResult(null);
    setStreakConsumed(false);
    setPhase("dealt");
  }

  function handleDraw() {
    if (!canDraw) return;
    const remaining = [...deck];
    const finalHand = hand.map((card, idx) => {
      if (held[idx]) return card;
      return remaining.shift() ?? card;
    });
    // Re-key only the slots that swapped in a fresh card so HOLD cards
    // do not jump while the drawn cards flip in.
    setCardKeys((prev) => prev.map((k, i) => (held[i] ? k : nextCardKey())));
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
    setPokerChips((c) => c + payout);
    setLastResult({ evaluation, payout, hotStreakBonus });

    if (payout > 0) {
      setWinStreak((s) => (hotStreakBonus ? 0 : s + 1));
      if (hotStreakBonus) setStreakConsumed(true);
    } else {
      setWinStreak(0);
    }
    setPhase("settled");
  }

  function toggleHold(idx: number) {
    if (phase !== "dealt") return;
    setHeld((prev) => prev.map((v, i) => (i === idx ? !v : v)));
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
          ← アトリエに戻る
        </button>
        <div className="poker-title">
          <p className="poker-kicker">Video Poker · Jacks or Better (6/5)</p>
          <h1>♠ Arc を増やすには集中して稼ぐ。</h1>
        </div>
        <div className="poker-balances" aria-label="残高">
          <div className="poker-meter" title="Arc 残高">
            <span className="poker-meter-label">Arc</span>
            <span className="poker-meter-value">{arcBalance.toLocaleString()}</span>
          </div>
          <span className="poker-meter-sep" aria-hidden="true" />
          <div className="poker-meter" title="ポーカーチップ残高">
            <span className="poker-meter-label">Chip</span>
            <span className="poker-meter-value">{displayChips.toLocaleString()}</span>
          </div>
          <span className="poker-meter-sep" aria-hidden="true" />
          <div
            className={`poker-meter is-focus${focusChips > 0 ? " has-charge" : ""}`}
            title="今日のFocus Chip残高（集中作業で獲得）"
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
        <div className="poker-paytable" aria-label="ペイテーブル">
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
            Royal Flush は MAX BET 時 800×bet。<br />
            Focus Chip モードは全配当 ×1.5、HOT STREAK は次の当たり配当 +20%。
          </p>
        </div>

        <div
          className={`poker-table${
            lastResult && lastResult.payout > 0 ? " is-winning" : ""
          }${winStreak >= HOT_STREAK_THRESHOLD ? " is-armed" : ""}`}
        >
          {/* Felt highlights — pure CSS, no DOM cost beyond two layers */}
          <div className="poker-table-glow" aria-hidden="true" />
          <div className="poker-table-rim" aria-hidden="true" />

          <div className="poker-streak-row">
            <div
              className={`poker-streak${
                winStreak >= HOT_STREAK_THRESHOLD ? " is-armed" : ""
              }`}
              aria-label="連勝カウンタ"
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
                ベットを決めて <strong>DEAL</strong>。
              </p>
            ) : phase === "dealt" ? (
              <p className="poker-result-hint">
                残したい札をタップ → <strong>DRAW</strong>。
              </p>
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
                    <span className="poker-result-zero">ノーペイ</span>
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
              通常チップ
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
                  ? "アトリエに25分滞在で Focus Chip を獲得（1日8枚まで）"
                  : "配当 ×1.5"
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
            <div className="poker-bet-chips" role="group" aria-label="ベット額">
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
                ? "RTP 95% — 長くやると確率的に負け越す"
                : "配当 ×1.5 — 集中で稼いだ Focus でだけ勝ち越せる"}
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
              <span className="poker-cta-sub">残してない札を交換</span>
            </button>
          ) : (
            <button
              type="button"
              className="poker-cta is-deal"
              onClick={handleDeal}
              disabled={!canDeal}
            >
              <span className="poker-cta-label">
                {canDeal ? "Deal" : mode === "normal" ? "チップ不足" : "Focus 不足"}
              </span>
              <span className="poker-cta-sub">
                {canDeal
                  ? `−${activeBet} ${mode === "normal" ? "chip" : "focus"}`
                  : "両替が必要です"}
              </span>
            </button>
          )}

          <button
            type="button"
            className="poker-link"
            onClick={() => setExchangeOpen((v) => !v)}
            disabled={phase === "dealt"}
          >
            {exchangeOpen ? "両替を閉じる" : "Arc ⇄ チップ 両替"}
          </button>
        </div>
      </section>

      {exchangeOpen && phase !== "dealt" ? (
        <section className="poker-exchange">
          <header>
            <h2>両替・換金</h2>
            <p>
              Arc → チップは 1 Arc = {NORMAL_CHIP_PER_ARC} chip。
              チップ → Arc は {CASHOUT_CHIP_UNIT} chip = {CASHOUT_ARC_RATE} Arc。
            </p>
          </header>
          <div className="poker-exchange-grid">
            <div className="poker-exchange-card">
              <p className="poker-exchange-card-title">Arc → chip</p>
              <p className="poker-exchange-card-sub">
                所持 Arc: {arcBalance.toLocaleString()}
              </p>
              <div className="poker-exchange-buttons">
                {[1, 5, 10, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={amt > arcBalance}
                    onClick={() => buyChipsWithArc(amt)}
                  >
                    {amt} Arc<br />
                    <span>→ {(amt * NORMAL_CHIP_PER_ARC).toLocaleString()} chip</span>
                  </button>
                ))}
              </div>
              {arcBalance < 1 ? (
                <button
                  type="button"
                  className="poker-buy-arc"
                  onClick={onOpenShop}
                >
                  Arc が足りません → ショップへ
                </button>
              ) : null}
            </div>
            <div className="poker-exchange-card">
              <p className="poker-exchange-card-title">chip → Arc</p>
              <p className="poker-exchange-card-sub">
                所持 chip: {pokerChips.toLocaleString()}
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
                換金レートは購入レートより辛口。たくさん勝ってまとめて換金しよう。
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
