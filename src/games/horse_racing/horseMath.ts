import { HorseBetType, HorseRunner } from '../../types';

export const HORSE_MIN_BET = 10;
export const HORSE_MAX_BET = 5000;
export const HORSE_DEFAULT_BET = 100;
export const HORSE_TARGET_RTP = 0.95;
export const HORSE_COUNT = 6;

export interface PlackettLuceOrder {
  order: number[]; // Array of 6 horse numbers (1..6) from 1st to 6th
  probability: number;
}

/**
 * Enumerates all 6! = 720 possible finishing orders and computes exact
 * Plackett-Luce probabilities from the 6 runners' positive strength weights:
 *
 *   P(order) = prod_{k=0..5} (w[order[k]] / sum_{j=k..5} w[order[j]])
 */
export function computePlackettLuceDistribution(
  runners: Pick<HorseRunner, 'number' | 'strengthWeight'>[]
): PlackettLuceOrder[] {
  if (runners.length !== HORSE_COUNT) {
    throw new Error(`Expected ${HORSE_COUNT} runners, received ${runners.length}`);
  }

  const results: PlackettLuceOrder[] = [];
  const used = new Array<boolean>(HORSE_COUNT).fill(false);
  const currentOrder: number[] = [];

  const totalWeight = runners.reduce((sum, r) => sum + r.strengthWeight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error('Runner strength weights must sum to a positive finite number.');
  }

  function permute(depth: number, remainingWeight: number, runningProb: number) {
    if (depth === HORSE_COUNT) {
      results.push({
        order: [...currentOrder],
        probability: runningProb,
      });
      return;
    }

    for (let i = 0; i < HORSE_COUNT; i++) {
      if (used[i]) continue;
      const runner = runners[i];
      const stepProb = runner.strengthWeight / remainingWeight;
      used[i] = true;
      currentOrder.push(runner.number);
      permute(depth + 1, remainingWeight - runner.strengthWeight, runningProb * stepProb);
      currentOrder.pop();
      used[i] = false;
    }
  }

  permute(0, totalWeight, 1);
  return results;
}

/**
 * Returns the exact required number of distinct horse selections for each bet type.
 */
export function getRequiredSelectionCount(betType: HorseBetType): number {
  switch (betType) {
    case 'WIN':
    case 'PLACE':
    case 'SHOW':
      return 1;
    case 'EXACTA':
    case 'QUINELLA':
      return 2;
    case 'TRIFECTA':
      return 3;
  }
}

/**
 * Checks whether a given 6-horse finishOrder satisfies a bet type + selections.
 */
export function isWinningOrderForBet(
  betType: HorseBetType,
  selections: number[],
  finishOrder: number[]
): boolean {
  if (finishOrder.length < 3) return false;
  const required = getRequiredSelectionCount(betType);
  if (selections.length !== required) return false;

  const [first, second, third] = finishOrder;

  switch (betType) {
    case 'WIN':
      return first === selections[0];
    case 'PLACE':
      return first === selections[0] || second === selections[0];
    case 'SHOW':
      return first === selections[0] || second === selections[0] || third === selections[0];
    case 'EXACTA':
      return first === selections[0] && second === selections[1];
    case 'QUINELLA':
      return (
        (first === selections[0] && second === selections[1]) ||
        (first === selections[1] && second === selections[0])
      );
    case 'TRIFECTA':
      return (
        first === selections[0] &&
        second === selections[1] &&
        third === selections[2]
      );
  }
}

/**
 * Validates that selections are valid distinct horse numbers (1..6) for the bet type.
 */
export function validateHorseSelections(
  betType: HorseBetType,
  selections: number[]
): { valid: boolean; error?: string } {
  const required = getRequiredSelectionCount(betType);
  if (selections.length !== required) {
    return {
      valid: false,
      error: `Select ${required} ${required === 1 ? 'horse' : 'horses'} for a ${betType} bet.`,
    };
  }

  const unique = new Set<number>();
  for (const num of selections) {
    if (!Number.isInteger(num) || num < 1 || num > HORSE_COUNT) {
      return { valid: false, error: 'Horse number must be between 1 and 6.' };
    }
    if (unique.has(num)) {
      return { valid: false, error: 'Duplicate horse selections are not allowed.' };
    }
    unique.add(num);
  }

  return { valid: true };
}

/**
 * Sums the exact Plackett-Luce probability over all 720 finishing orders matching the bet.
 */
export function calculateBetEventProbability(
  distribution: PlackettLuceOrder[],
  betType: HorseBetType,
  selections: number[]
): number {
  const validation = validateHorseSelections(betType, selections);
  if (!validation.valid) return 0;

  let prob = 0;
  for (let i = 0; i < distribution.length; i++) {
    const entry = distribution[i];
    if (isWinningOrderForBet(betType, selections, entry.order)) {
      prob += entry.probability;
    }
  }
  return prob;
}

/**
 * Computes the RTP-adjusted gross payout multiplier rounded cleanly to 2 decimal places.
 * Guarantees displayed multiplier matches settlement math exactly.
 */
export function calculateGrossMultiplier(
  probability: number,
  targetRTP: number = HORSE_TARGET_RTP
): number {
  if (!Number.isFinite(probability) || probability <= 0) return 0;
  const raw = targetRTP / probability;
  // Round to 2 decimals consistently; cap floor at 1.05x for very likely Show bets
  const rounded = Math.round(raw * 100) / 100;
  return Math.max(1.05, rounded);
}

/**
 * Calculates gross virtual-coin payout rounded to whole coins.
 * Displayed payout and settled payout both call this single function.
 */
export function calculateHorsePayout(betAmount: number, multiplier: number): number {
  if (
    !Number.isFinite(betAmount) ||
    !Number.isFinite(multiplier) ||
    betAmount <= 0 ||
    multiplier <= 0
  ) {
    return 0;
  }
  return Math.round(betAmount * multiplier);
}

/**
 * Formats multiplier cleanly for display (e.g. "3.45x" or "128.50x").
 */
export function formatHorseMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return '—';
  if (multiplier >= 1000) {
    return `${multiplier.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}x`;
  }
  return `${multiplier.toFixed(2)}x`;
}

/**
 * Human-readable betting type metadata for UI & rules.
 */
export const HORSE_BET_META: Record<
  HorseBetType,
  {
    label: string;
    shortRule: string;
    selectionPrompt: string;
    requiredCount: number;
    ordered: boolean;
  }
> = {
  WIN: {
    label: 'Win',
    shortRule: 'Selected horse must finish 1st.',
    selectionPrompt: 'Pick 1 horse to finish 1st',
    requiredCount: 1,
    ordered: false,
  },
  PLACE: {
    label: 'Place',
    shortRule: 'Selected horse must finish 1st or 2nd.',
    selectionPrompt: 'Pick 1 horse to finish 1st or 2nd',
    requiredCount: 1,
    ordered: false,
  },
  SHOW: {
    label: 'Show',
    shortRule: 'Selected horse must finish 1st, 2nd, or 3rd.',
    selectionPrompt: 'Pick 1 horse to finish Top 3',
    requiredCount: 1,
    ordered: false,
  },
  EXACTA: {
    label: 'Exacta',
    shortRule: 'Two horses must finish 1st and 2nd in exact order.',
    selectionPrompt: 'Pick 1st place, then 2nd place',
    requiredCount: 2,
    ordered: true,
  },
  QUINELLA: {
    label: 'Quinella',
    shortRule: 'Two horses must finish 1st and 2nd in either order.',
    selectionPrompt: 'Pick 2 horses to finish Top 2 (any order)',
    requiredCount: 2,
    ordered: false,
  },
  TRIFECTA: {
    label: 'Trifecta',
    shortRule: 'Three horses must finish 1st, 2nd, and 3rd in exact order.',
    selectionPrompt: 'Pick 1st, 2nd, and 3rd in exact order',
    requiredCount: 3,
    ordered: true,
  },
};
