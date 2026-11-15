import { HiLoCard, HiLoSuit, HiLoRank, HiLoRankSymbol, HiLoPrediction } from '../../types';

export const HILO_MIN_BET = 10;
export const HILO_MAX_BET = 5000;
export const HILO_DEFAULT_BET = 100;
export const HILO_TARGET_RTP = 0.97;

export const SUITS: HiLoSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: { rank: HiLoRank; symbol: HiLoRankSymbol }[] = [
  { rank: 2, symbol: '2' },
  { rank: 3, symbol: '3' },
  { rank: 4, symbol: '4' },
  { rank: 5, symbol: '5' },
  { rank: 6, symbol: '6' },
  { rank: 7, symbol: '7' },
  { rank: 8, symbol: '8' },
  { rank: 9, symbol: '9' },
  { rank: 10, symbol: '10' },
  { rank: 11, symbol: 'J' },
  { rank: 12, symbol: 'Q' },
  { rank: 13, symbol: 'K' },
  { rank: 14, symbol: 'A' },
];

/**
 * Creates a standard 52-card deck with 4 suits and 13 ranks (Aces high = 14).
 * Guaranteed exactly 52 unique cards with unique IDs.
 */
export function createFreshDeck(): HiLoCard[] {
  const deck: HiLoCard[] = [];
  for (const suit of SUITS) {
    const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
    for (const { rank, symbol } of RANKS) {
      deck.push({
        id: `${suit}_${rank}`,
        suit,
        rank,
        symbol,
        color,
      });
    }
  }
  return deck;
}

export interface DeckOutcomeCounts {
  higherCount: number;
  lowerCount: number;
  tieCount: number;
  totalRemaining: number;
  probHigher: number;
  probLower: number;
  probTie: number;
  multiplierHigher: number;
  multiplierLower: number;
}

/**
 * Calculates remaining outcome counts, exact conditional probabilities,
 * and RTP-adjusted multipliers (0.97 / P) based on the remaining deck.
 */
export function calculateDeckOutcomes(
  currentCard: HiLoCard,
  remainingDeck: HiLoCard[],
  targetRTP: number = HILO_TARGET_RTP
): DeckOutcomeCounts {
  const totalRemaining = remainingDeck.length;

  if (totalRemaining <= 0) {
    return {
      higherCount: 0,
      lowerCount: 0,
      tieCount: 0,
      totalRemaining: 0,
      probHigher: 0,
      probLower: 0,
      probTie: 0,
      multiplierHigher: 0,
      multiplierLower: 0,
    };
  }

  let higherCount = 0;
  let lowerCount = 0;
  let tieCount = 0;

  for (const card of remainingDeck) {
    if (card.rank > currentCard.rank) {
      higherCount++;
    } else if (card.rank < currentCard.rank) {
      lowerCount++;
    } else {
      tieCount++;
    }
  }

  const probHigher = higherCount / totalRemaining;
  const probLower = lowerCount / totalRemaining;
  const probTie = tieCount / totalRemaining;

  // RTP-Adjusted Multiplier: 0.97 / Probability
  // If probability is 0, multiplier is 0 (disabled).
  const multiplierHigher = probHigher > 0 ? targetRTP / probHigher : 0;
  const multiplierLower = probLower > 0 ? targetRTP / probLower : 0;

  return {
    higherCount,
    lowerCount,
    tieCount,
    totalRemaining,
    probHigher,
    probLower,
    probTie,
    multiplierHigher,
    multiplierLower,
  };
}

/**
 * Calculates the step multiplier for a specific prediction.
 */
export function getStepMultiplierForPrediction(
  prediction: HiLoPrediction,
  outcomes: DeckOutcomeCounts
): { multiplier: number; probability: number } {
  if (prediction === 'HIGHER') {
    return {
      multiplier: outcomes.multiplierHigher,
      probability: outcomes.probHigher,
    };
  } else {
    return {
      multiplier: outcomes.multiplierLower,
      probability: outcomes.probLower,
    };
  }
}

/**
 * Evaluates the step outcome comparing revealedCard rank with prevCard rank.
 */
export function evaluateStepOutcome(
  prevCard: HiLoCard,
  revealedCard: HiLoCard,
  prediction: HiLoPrediction
): 'WIN' | 'LOSS' | 'PUSH' {
  if (revealedCard.rank === prevCard.rank) {
    return 'PUSH';
  }

  if (prediction === 'HIGHER') {
    return revealedCard.rank > prevCard.rank ? 'WIN' : 'LOSS';
  } else {
    return revealedCard.rank < prevCard.rank ? 'WIN' : 'LOSS';
  }
}

/**
 * Calculates total gross payout rounded to whole virtual coins.
 */
export function calculateHiLoPayout(betAmount: number, multiplier: number): number {
  if (!Number.isFinite(betAmount) || !Number.isFinite(multiplier) || betAmount <= 0 || multiplier <= 0) {
    return 0;
  }
  return Math.round(betAmount * multiplier);
}

/**
 * Formats multiplier for UI display (e.g. "1.35x" or "142.50x").
 */
export function formatHiLoMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return '0.00x';
  if (multiplier >= 1000) {
    return `${multiplier.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x`;
  }
  return `${multiplier.toFixed(2)}x`;
}
