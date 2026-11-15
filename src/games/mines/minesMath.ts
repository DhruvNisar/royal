import { MinesRiskTier } from '../../types';

export const MINES_GRID_SIZE = 5;
export const MINES_TOTAL_TILES = 25;
export const MINES_MIN_COUNT = 1;
export const MINES_MAX_COUNT = 24;
export const MINES_DEFAULT_COUNT = 3;

export const MINES_MIN_BET = 10;
export const MINES_MAX_BET = 5000;
export const MINES_DEFAULT_BET = 100;

export const MINES_TARGET_RTP = 0.97;

export interface MinesStepMetric {
  picks: number;
  survivalProbability: number;
  multiplier: number;
}

/**
 * Computes exact binomial coefficient C(n, k) iteratively without factorial overflow.
 */
export function binomialCoefficient(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) {
    return 0;
  }
  if (k === 0 || k === n) return 1;
  const r = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= r; i++) {
    result = (result * (n - r + i)) / i;
  }
  return Math.round(result);
}

/**
 * Calculates the exact survival probability P(K) of picking K safe tiles consecutively
 * out of N = 25 tiles with M mines (S = N - M safe tiles):
 *
 *   P(K) = C(S, K) / C(N, K) = PRODUCT_{i=0}^{K-1} ((S - i) / (N - i))
 *
 * Uses the iterative product so each factor stays in (0, 1] with zero overflow.
 */
export function calculateSurvivalProbability(mineCount: number, safeRevealed: number): number {
  if (!Number.isInteger(mineCount) || mineCount < MINES_MIN_COUNT || mineCount > MINES_MAX_COUNT) {
    throw new Error(`Invalid mine count: ${mineCount}. Must be between 1 and 24.`);
  }
  const safeTotal = MINES_TOTAL_TILES - mineCount;
  if (!Number.isInteger(safeRevealed) || safeRevealed < 0 || safeRevealed > safeTotal) {
    throw new Error(`Invalid reveal count ${safeRevealed} for ${mineCount} mines (max ${safeTotal}).`);
  }
  if (safeRevealed === 0) {
    return 1;
  }

  let prob = 1;
  for (let i = 0; i < safeRevealed; i++) {
    prob *= (safeTotal - i) / (MINES_TOTAL_TILES - i);
  }
  return prob;
}

/**
 * Calculates the unrounded fair payout multiplier for 97% theoretical RTP:
 *
 *   Multiplier(K) = 0.97 / P(K)
 *
 * Returns 1.00 when K === 0 (display reference only; cash-out requires K >= 1).
 */
export function calculateMinesMultiplier(mineCount: number, safeRevealed: number): number {
  if (safeRevealed === 0) {
    return 1;
  }
  const prob = calculateSurvivalProbability(mineCount, safeRevealed);
  if (!Number.isFinite(prob) || prob <= 0) {
    throw new Error(`Invalid survival probability (${prob}) for mines=${mineCount}, k=${safeRevealed}`);
  }
  const multiplier = MINES_TARGET_RTP / prob;
  if (!Number.isFinite(multiplier)) {
    throw new Error('Multiplier overflow');
  }
  return multiplier;
}

/**
 * Formats a multiplier to exactly 2 decimal places for UI display without altering internal math.
 */
export function formatMinesMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier) || multiplier < 0) return '1.00x';
  return `${multiplier.toFixed(2)}x`;
}

/**
 * Computes total virtual coin payout rounded to the nearest whole coin using the unrounded multiplier.
 */
export function calculateMinesPayout(betAmount: number, unroundedMultiplier: number): number {
  if (
    !Number.isFinite(betAmount) ||
    !Number.isFinite(unroundedMultiplier) ||
    betAmount <= 0 ||
    unroundedMultiplier <= 0
  ) {
    return 0;
  }
  const raw = Math.round(betAmount * unroundedMultiplier);
  if (!Number.isSafeInteger(raw)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.max(0, raw);
}

/**
 * Returns the probability (0..1) that the next single pick is safe given current board state.
 */
export function calculateNextPickSafeProbability(mineCount: number, safeRevealed: number): number {
  const remainingTiles = MINES_TOTAL_TILES - safeRevealed;
  const remainingSafe = MINES_TOTAL_TILES - mineCount - safeRevealed;
  if (remainingTiles <= 0 || remainingSafe <= 0) return 0;
  return remainingSafe / remainingTiles;
}

/**
 * Descriptive risk classification for a given mine count (1-24).
 */
export function getMinesRiskTier(mineCount: number): MinesRiskTier {
  if (mineCount <= 5) return 'Low';
  if (mineCount <= 10) return 'Medium';
  if (mineCount <= 17) return 'High';
  return 'Extreme';
}

/**
 * Returns the full multiplier & survival progression schedule for all valid picks 1..S.
 */
export function getMinesMultiplierSchedule(mineCount: number): MinesStepMetric[] {
  const safeTotal = MINES_TOTAL_TILES - mineCount;
  const schedule: MinesStepMetric[] = [];
  for (let k = 1; k <= safeTotal; k++) {
    schedule.push({
      picks: k,
      survivalProbability: calculateSurvivalProbability(mineCount, k),
      multiplier: calculateMinesMultiplier(mineCount, k),
    });
  }
  return schedule;
}
