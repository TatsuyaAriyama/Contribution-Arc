// Jacks or Better video poker — pure logic. No React, no Firestore.
// Single-player draw poker: deal 5, hold any subset, redraw the rest.

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type Card = {
  suit: Suit;
  rank: Rank;
  /** 2..14 (A=14). Straights handle A=1 case internally. */
  value: number;
};

export type HandRank =
  | "royal-flush"
  | "straight-flush"
  | "four-of-a-kind"
  | "full-house"
  | "flush"
  | "straight"
  | "three-of-a-kind"
  | "two-pair"
  | "jacks-or-better"
  | "nothing";

export type HandEval = {
  rank: HandRank;
  label: string;
  /** Payout multiplier per 1 credit bet (Jacks or Better 9/6 table). */
  payoutPerCredit: number;
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: { rank: Rank; value: number }[] = [
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 11 },
  { rank: "Q", value: 12 },
  { rank: "K", value: 13 },
  { rank: "A", value: 14 },
];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push({ suit: s, rank: r.rank, value: r.value });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle. Mutates and returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/* ---------------- hand evaluation ---------------- */

function isFlush(cards: Card[]): boolean {
  const s = cards[0].suit;
  return cards.every((c) => c.suit === s);
}

/** Returns true if the 5 distinct values form a straight (A-low or A-high allowed). */
function isStraight(values: number[]): boolean {
  const unique = Array.from(new Set(values)).sort((a, b) => a - b);
  if (unique.length !== 5) return false;
  if (unique[4] - unique[0] === 4) return true;
  // A-2-3-4-5 wheel (A counted as 1)
  if (unique.join(",") === "2,3,4,5,14") return true;
  return false;
}

function countByValue(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.value, (m.get(c.value) ?? 0) + 1);
  return m;
}

export function evaluateHand(cards: Card[]): HandEval {
  if (cards.length !== 5) {
    return { rank: "nothing", label: "—", payoutPerCredit: 0 };
  }
  const values = cards.map((c) => c.value);
  const flush = isFlush(cards);
  const straight = isStraight(values);
  const counts = Array.from(countByValue(cards).values()).sort((a, b) => b - a);

  const isRoyal =
    flush &&
    straight &&
    [10, 11, 12, 13, 14].every((v) => values.includes(v));

  if (isRoyal) {
    return { rank: "royal-flush", label: "Royal Flush", payoutPerCredit: 250 };
  }
  if (flush && straight) {
    return { rank: "straight-flush", label: "Straight Flush", payoutPerCredit: 50 };
  }
  if (counts[0] === 4) {
    return { rank: "four-of-a-kind", label: "Four of a Kind", payoutPerCredit: 25 };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    // 6/5 paytable — slightly worse than the textbook 9/6 so the house
    // edge funds Arc spend instead of giving it back.
    return { rank: "full-house", label: "Full House", payoutPerCredit: 6 };
  }
  if (flush) {
    return { rank: "flush", label: "Flush", payoutPerCredit: 5 };
  }
  if (straight) {
    return { rank: "straight", label: "Straight", payoutPerCredit: 4 };
  }
  if (counts[0] === 3) {
    return { rank: "three-of-a-kind", label: "Three of a Kind", payoutPerCredit: 3 };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: "two-pair", label: "Two Pair", payoutPerCredit: 2 };
  }
  if (counts[0] === 2) {
    // Pair must be Jacks or better to pay.
    const pairValue = Array.from(countByValue(cards).entries()).find(
      ([, n]) => n === 2,
    )?.[0];
    if (pairValue && pairValue >= 11) {
      return {
        rank: "jacks-or-better",
        label: "Jacks or Better",
        payoutPerCredit: 1,
      };
    }
  }
  return { rank: "nothing", label: "—", payoutPerCredit: 0 };
}

/** Royal Flush gets a 800x bonus at max bet (5 credits). */
export function computePayout(evaluation: HandEval, bet: number): number {
  if (evaluation.rank === "royal-flush" && bet === 5) {
    return 800 * 5; // 4000 total
  }
  return evaluation.payoutPerCredit * bet;
}

export const PAYTABLE: { rank: HandRank; label: string; perCredit: number }[] = [
  { rank: "royal-flush", label: "Royal Flush", perCredit: 250 },
  { rank: "straight-flush", label: "Straight Flush", perCredit: 50 },
  { rank: "four-of-a-kind", label: "Four of a Kind", perCredit: 25 },
  { rank: "full-house", label: "Full House", perCredit: 9 },
  { rank: "flush", label: "Flush", perCredit: 6 },
  { rank: "straight", label: "Straight", perCredit: 4 },
  { rank: "three-of-a-kind", label: "Three of a Kind", perCredit: 3 },
  { rank: "two-pair", label: "Two Pair", perCredit: 2 },
  { rank: "jacks-or-better", label: "Jacks or Better", perCredit: 1 },
];
