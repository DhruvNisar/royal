import {
  HiLoCard,
  HiLoRoundResult,
  HiLoStats,
} from '../../types';
import {
  createFreshDeck,
  HILO_MIN_BET,
  HILO_MAX_BET,
} from './hiloMath';

export const HILO_HISTORY_STORAGE_KEY = 'royal_ace_hilo_history_v1';
export const HILO_MAX_HISTORY_ENTRIES = 50;

/**
 * Rejection sampling uniform random integer in [0, upperBoundExclusive)
 * using crypto.getRandomValues to eliminate modulo bias.
 */
export function cryptoUniformIndex(upperBoundExclusive: number): number {
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
 * Shuffles a 52-card deck in-place using Fisher-Yates with crypto.getRandomValues.
 * Guaranteed zero duplicates and unbiased card permutations.
 */
export function cryptoShuffleDeck(deck: HiLoCard[]): HiLoCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = cryptoUniformIndex(i + 1);
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Creates and shuffles a fresh 52-card deck for a new Hi-Lo round.
 */
export function initializeShuffledDeck(): HiLoCard[] {
  const freshDeck = createFreshDeck();
  return cryptoShuffleDeck(freshDeck);
}

/**
 * Validates player's bet amount.
 */
export function validateHiLoBet(betAmount: number, userCoins: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (betAmount < HILO_MIN_BET) {
    return { valid: false, error: `Minimum wager is ${HILO_MIN_BET} coins.` };
  }
  if (betAmount > HILO_MAX_BET) {
    return { valid: false, error: `Maximum wager is ${HILO_MAX_BET.toLocaleString()} coins.` };
  }
  if (betAmount > userCoins) {
    return { valid: false, error: 'Insufficient virtual coins for this wager.' };
  }
  return { valid: true };
}

/**
 * Loads Royal Hi-Lo round history from localStorage.
 */
export function loadHiLoHistory(): HiLoRoundResult[] {
  try {
    const raw = localStorage.getItem(HILO_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is HiLoRoundResult =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.bet === 'number' &&
          Boolean(item.initialCard) &&
          Boolean(item.finalCard) &&
          Array.isArray(item.cardsRevealed) &&
          Array.isArray(item.steps) &&
          typeof item.correctStreak === 'number' &&
          typeof item.finalMultiplier === 'number' &&
          typeof item.payout === 'number' &&
          typeof item.net === 'number' &&
          typeof item.outcome === 'string'
      )
      .slice(0, HILO_MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Saves Royal Hi-Lo round history to localStorage.
 */
export function saveHiLoHistory(history: HiLoRoundResult[]): void {
  try {
    localStorage.setItem(
      HILO_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, HILO_MAX_HISTORY_ENTRIES))
    );
  } catch {
    // Graceful handling of storage quota
  }
}

/**
 * Appends a completed Hi-Lo round result to history.
 */
export function appendHiLoHistoryRecord(record: HiLoRoundResult): HiLoRoundResult[] {
  const existing = loadHiLoHistory();
  const updated = [record, ...existing].slice(0, HILO_MAX_HISTORY_ENTRIES);
  saveHiLoHistory(updated);
  return updated;
}

/**
 * Calculates career statistics from Hi-Lo history records.
 */
export function calculateHiLoStats(history: HiLoRoundResult[]): HiLoStats {
  const roundsPlayed = history.length;
  let totalWagered = 0;
  let totalReturned = 0;
  let winningRounds = 0;
  let losingRounds = 0;
  let pushesCount = 0;
  let highestMultiplier = 0;
  let longestStreak = 0;

  for (const r of history) {
    totalWagered += r.bet;
    totalReturned += r.payout;

    if (r.finalMultiplier > highestMultiplier) {
      highestMultiplier = r.finalMultiplier;
    }
    if (r.correctStreak > longestStreak) {
      longestStreak = r.correctStreak;
    }

    if (r.outcome === 'CASHED_OUT') {
      winningRounds++;
    } else if (r.outcome === 'LOST') {
      losingRounds++;
    } else {
      pushesCount++;
    }
  }

  const netProfit = totalReturned - totalWagered;
  const winRate = roundsPlayed > 0 ? (winningRounds / roundsPlayed) * 100 : 0;

  return {
    roundsPlayed,
    totalWagered,
    totalReturned,
    netProfit,
    winningRounds,
    losingRounds,
    pushesCount,
    highestMultiplier,
    longestStreak,
    winRate,
  };
}
