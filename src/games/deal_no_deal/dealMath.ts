import { BankerOfferSnapshot, DealBriefcase } from '../../types';

export const DEAL_MIN_BET = 10;
export const DEAL_MAX_BET = 2000;
export const DEAL_DEFAULT_BET = 100;
export const DEAL_TOTAL_CASES = 26;

/**
 * Exact 26 prize multipliers — every value appears strictly once per game.
 */
export const DEAL_PRIZE_MULTIPLIERS: readonly number[] = [
  0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 7.5, 10, 15,
  20, 25, 35, 50, 75, 100, 150, 200, 250, 350, 500, 750, 1000,
] as const;

export const DEAL_LOW_TIER_MULTIPLIERS: readonly number[] = DEAL_PRIZE_MULTIPLIERS.slice(0, 13);
export const DEAL_HIGH_TIER_MULTIPLIERS: readonly number[] = DEAL_PRIZE_MULTIPLIERS.slice(13, 26);

/**
 * Configurable opening schedule by round number (1-indexed):
 * Round 1: 6 cases, Round 2: 5, Round 3: 4, Round 4: 3, Round 5: 2, Round 6+: 1 per round.
 */
export const OPENING_ROUND_SCHEDULE: readonly number[] = [6, 5, 4, 3, 2, 1, 1, 1, 1] as const;

export function getCasesToOpenForRound(roundNumber: number): number {
  if (roundNumber < 1) return 1;
  const idx = roundNumber - 1;
  if (idx < OPENING_ROUND_SCHEDULE.length) {
    return OPENING_ROUND_SCHEDULE[idx];
  }
  return 1;
}

/**
 * Configurable progressive Banker offer percentages based on completed round / remaining cases.
 * Early game: 55% -> Early-middle: 60% -> Middle: 65% -> Late: 75% -> Final stages: 85%.
 */
export const BANKER_PERCENTAGE_SCHEDULE: readonly {
  round: number;
  maxRemainingCases: number;
  percentage: number;
  stageLabel: string;
}[] = [
  { round: 1, maxRemainingCases: 20, percentage: 0.55, stageLabel: 'Opening Offer' },
  { round: 2, maxRemainingCases: 15, percentage: 0.60, stageLabel: 'Early-Mid Offer' },
  { round: 3, maxRemainingCases: 11, percentage: 0.65, stageLabel: 'Mid-Game Offer' },
  { round: 4, maxRemainingCases: 8, percentage: 0.70, stageLabel: 'Rising Stakes' },
  { round: 5, maxRemainingCases: 6, percentage: 0.75, stageLabel: 'Late-Game Offer' },
  { round: 6, maxRemainingCases: 5, percentage: 0.78, stageLabel: 'High Tension' },
  { round: 7, maxRemainingCases: 4, percentage: 0.81, stageLabel: 'Final Four' },
  { round: 8, maxRemainingCases: 3, percentage: 0.83, stageLabel: 'Final Three' },
  { round: 9, maxRemainingCases: 2, percentage: 0.85, stageLabel: 'Final Banker Offer' },
] as const;

export function getBankerPercentageForRound(
  roundNumber: number,
  remainingCasesCount: number
): { percentage: number; stageLabel: string } {
  if (remainingCasesCount <= 2) {
    const last = BANKER_PERCENTAGE_SCHEDULE[BANKER_PERCENTAGE_SCHEDULE.length - 1];
    return { percentage: last.percentage, stageLabel: last.stageLabel };
  }
  const byRound = BANKER_PERCENTAGE_SCHEDULE.find(entry => entry.round === roundNumber);
  if (byRound) {
    return { percentage: byRound.percentage, stageLabel: byRound.stageLabel };
  }
  const fallback =
    BANKER_PERCENTAGE_SCHEDULE.find(entry => remainingCasesCount >= entry.maxRemainingCases) ??
    BANKER_PERCENTAGE_SCHEDULE[BANKER_PERCENTAGE_SCHEDULE.length - 1];
  return { percentage: fallback.percentage, stageLabel: fallback.stageLabel };
}

/**
 * Single authoritative coin calculation used by both UI displays and wallet settlement.
 * Guarantees settled coin amount always matches displayed coin amount.
 */
export function calculateDealCoins(bet: number, multiplier: number): number {
  if (!Number.isFinite(bet) || !Number.isFinite(multiplier) || bet <= 0 || multiplier <= 0) {
    return 0;
  }
  return Math.round(bet * multiplier);
}

/**
 * Computes the dynamic Banker offer strictly from currently unopened briefcases
 * (which always includes the player's unopened personal case and excludes all opened cases).
 */
export function calculateBankerOffer(
  briefcases: DealBriefcase[],
  bet: number,
  roundNumber: number
): BankerOfferSnapshot {
  const remaining = briefcases.filter(c => !c.isOpened);
  if (remaining.length === 0) {
    throw new Error('Cannot compute Banker offer with zero remaining briefcases.');
  }

  let sum = 0;
  let lowest = Infinity;
  let highest = -Infinity;

  for (const c of remaining) {
    sum += c.multiplier;
    if (c.multiplier < lowest) lowest = c.multiplier;
    if (c.multiplier > highest) highest = c.multiplier;
  }

  const averageRemainingMultiplier = sum / remaining.length;
  const { percentage: bankerPercentage } = getBankerPercentageForRound(
    roundNumber,
    remaining.length
  );

  // Round displayed/settled offer multiplier cleanly to 2 decimal places
  const rawOfferMultiplier = averageRemainingMultiplier * bankerPercentage;
  const offerMultiplier = Math.max(0.01, Math.round(rawOfferMultiplier * 100) / 100);
  const offerCoins = calculateDealCoins(bet, offerMultiplier);

  return {
    roundNumber,
    remainingCasesCount: remaining.length,
    averageRemainingMultiplier: Math.round(averageRemainingMultiplier * 100) / 100,
    bankerPercentage,
    offerMultiplier,
    offerCoins,
    lowestRemainingMultiplier: lowest,
    highestRemainingMultiplier: highest,
  };
}

/**
 * Clean, consistent multiplier formatter (e.g., 0.01x, 7.5x, 100x, 1,000x).
 */
export function formatDealMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier)) return '0x';
  if (multiplier < 1) {
    return `${multiplier.toFixed(2)}x`;
  }
  if (Number.isInteger(multiplier)) {
    return `${multiplier.toLocaleString()}x`;
  }
  const fixed2 = Math.round(multiplier * 100) / 100;
  const str = fixed2 % 1 === 0 ? fixed2.toFixed(0) : fixed2.toFixed(2).replace(/0$/, '');
  return `${Number(str).toLocaleString(undefined, { maximumFractionDigits: 2 })}x`;
}

export function isHighTierMultiplier(multiplier: number): boolean {
  return multiplier >= 20;
}
