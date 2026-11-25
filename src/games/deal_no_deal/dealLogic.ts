import {
  DealBriefcase,
  DealNoDealRoundResult,
  DealNoDealStats,
} from '../../types';
import {
  DEAL_MIN_BET,
  DEAL_MAX_BET,
  DEAL_PRIZE_MULTIPLIERS,
  DEAL_TOTAL_CASES,
} from './dealMath';

export const DEAL_HISTORY_STORAGE_KEY = 'royal_ace_deal_no_deal_history_v1';
export const DEAL_MAX_HISTORY_ENTRIES = 50;

/**
 * Unbiased cryptographic uniform integer in [0, upperBoundExclusive) via rejection sampling.
 */
export function cryptoDealUniformIndex(upperBoundExclusive: number): number {
  if (!Number.isInteger(upperBoundExclusive) || upperBoundExclusive <= 0) {
    throw new Error(`Invalid upper bound: ${upperBoundExclusive}`);
  }
  if (upperBoundExclusive === 1) return 0;

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographic randomness API is unavailable in this environment.');
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % upperBoundExclusive);
  const buf = new Uint32Array(1);

  while (true) {
    cryptoObj.getRandomValues(buf);
    const val = buf[0];
    if (val < limit) {
      return val % upperBoundExclusive;
    }
  }
}

/**
 * Unbiased cryptographic Fisher-Yates shuffle.
 */
export function cryptoShuffleMultipliers(values: readonly number[]): number[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoDealUniformIndex(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Generates all 26 numbered briefcases with a freshly shuffled, locked 1-to-1
 * assignment of the exact 26 prize multipliers.
 */
export function createShuffledBriefcases(): DealBriefcase[] {
  const shuffled = cryptoShuffleMultipliers(DEAL_PRIZE_MULTIPLIERS);
  if (shuffled.length !== DEAL_TOTAL_CASES) {
    throw new Error(`Expected ${DEAL_TOTAL_CASES} multipliers, got ${shuffled.length}.`);
  }

  return shuffled.map((multiplier, index) => ({
    caseNumber: index + 1,
    multiplier,
    isOpened: false,
    isPlayerCase: false,
  }));
}

/**
 * Validates wager amount against limits and player wallet balance.
 */
export function validateDealBet(
  bet: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(bet) || !Number.isInteger(bet)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (bet < DEAL_MIN_BET) {
    return { valid: false, error: `Minimum bet is ${DEAL_MIN_BET} coins.` };
  }
  if (bet > DEAL_MAX_BET) {
    return { valid: false, error: `Maximum bet is ${DEAL_MAX_BET.toLocaleString()} coins.` };
  }
  if (bet > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance for this wager.' };
  }
  return { valid: true };
}

/**
 * Persists and loads Deal or No Deal round history (up to 50 most recent rounds).
 */
export function loadDealHistory(): DealNoDealRoundResult[] {
  try {
    const raw = localStorage.getItem(DEAL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is DealNoDealRoundResult =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.bet === 'number' &&
          typeof item.grossPayout === 'number'
      )
      .slice(0, DEAL_MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function saveDealHistory(history: DealNoDealRoundResult[]): void {
  try {
    localStorage.setItem(
      DEAL_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, DEAL_MAX_HISTORY_ENTRIES))
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function appendDealHistoryRecord(
  record: DealNoDealRoundResult
): DealNoDealRoundResult[] {
  const existing = loadDealHistory();
  const updated = [record, ...existing].slice(0, DEAL_MAX_HISTORY_ENTRIES);
  saveDealHistory(updated);
  return updated;
}

/**
 * Aggregates career Deal or No Deal statistics from recorded rounds.
 */
export function calculateDealStats(history: DealNoDealRoundResult[]): DealNoDealStats {
  const gamesPlayed = history.length;
  let totalWagered = 0;
  let totalGrossWon = 0;
  let dealsAccepted = 0;
  let dealsRejected = 0;
  let biggestPayout = 0;
  let highestMultiplierWon = 0;

  for (const r of history) {
    totalWagered += r.bet;
    totalGrossWon += r.grossPayout;

    if (r.finalChoice === 'DEAL') {
      dealsAccepted++;
    }
    // Count every rejected Banker offer across rounds
    if (Array.isArray(r.offersReceived)) {
      for (const offer of r.offersReceived) {
        if (offer.decision === 'NO_DEAL') {
          dealsRejected++;
        }
      }
    }

    if (r.grossPayout > biggestPayout) {
      biggestPayout = r.grossPayout;
    }
    if (r.finalMultiplier > highestMultiplierWon) {
      highestMultiplierWon = r.finalMultiplier;
    }
  }

  return {
    gamesPlayed,
    totalWagered,
    totalGrossWon,
    totalNetProfit: totalGrossWon - totalWagered,
    dealsAccepted,
    dealsRejected,
    biggestPayout,
    highestMultiplierWon,
  };
}
