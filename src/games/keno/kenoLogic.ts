import { KenoRoundResult, KenoStats } from '../../types';
import {
  KENO_TOTAL_NUMBERS,
  KENO_DRAW_COUNT,
  KENO_MIN_PICKS,
  KENO_MAX_PICKS,
  KENO_MIN_BET,
  KENO_MAX_BET,
  getKenoMultiplier,
  calculateKenoPayout,
} from './kenoMath';

export const KENO_HISTORY_STORAGE_KEY = 'royal_ace_keno_history_v1';
export const KENO_MAX_HISTORY_ENTRIES = 50;

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
 * Draws exactly `drawCount` (20) unique numbers from range 1..80.
 * Uses Fisher-Yates shuffle with cryptographic randomness.
 * Returns the drawn numbers in the EXACT order they were drawn,
 * with zero duplicates.
 */
export function cryptoDrawKenoNumbers(
  drawCount: number = KENO_DRAW_COUNT,
  totalNumbers: number = KENO_TOTAL_NUMBERS
): number[] {
  const pool = Array.from({ length: totalNumbers }, (_, i) => i + 1);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = cryptoUniformIndex(i + 1);
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }

  return pool.slice(0, drawCount);
}

/**
 * Generates `count` unique random numbers in range 1..80 for Quick Pick.
 * Returns numbers sorted ascending.
 */
export function generateKenoQuickPick(
  count: number = 5,
  totalNumbers: number = KENO_TOTAL_NUMBERS
): number[] {
  const safeCount = Math.max(KENO_MIN_PICKS, Math.min(KENO_MAX_PICKS, Math.floor(count)));
  const drawn = cryptoDrawKenoNumbers(safeCount, totalNumbers);
  return drawn.sort((a, b) => a - b);
}

/**
 * Validates player's number selection.
 */
export function validateKenoSelection(selected: number[]): { valid: boolean; error?: string } {
  if (!Array.isArray(selected) || selected.length < KENO_MIN_PICKS) {
    return {
      valid: false,
      error: `Select at least ${KENO_MIN_PICKS} number (up to ${KENO_MAX_PICKS}) to play.`,
    };
  }
  if (selected.length > KENO_MAX_PICKS) {
    return {
      valid: false,
      error: `You can select at most ${KENO_MAX_PICKS} numbers.`,
    };
  }

  const uniqueSet = new Set<number>();
  for (const n of selected) {
    if (!Number.isInteger(n) || n < 1 || n > KENO_TOTAL_NUMBERS) {
      return {
        valid: false,
        error: `Numbers must be between 1 and ${KENO_TOTAL_NUMBERS}.`,
      };
    }
    if (uniqueSet.has(n)) {
      return {
        valid: false,
        error: 'Duplicate numbers are not allowed.',
      };
    }
    uniqueSet.add(n);
  }

  return { valid: true };
}

/**
 * Validates player's bet amount against limits and available balance.
 */
export function validateKenoBet(betAmount: number, balance: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (betAmount < KENO_MIN_BET) {
    return { valid: false, error: `Minimum bet is ${KENO_MIN_BET} coins.` };
  }
  if (betAmount > KENO_MAX_BET) {
    return { valid: false, error: `Maximum bet is ${KENO_MAX_BET.toLocaleString()} coins.` };
  }
  if (betAmount > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance.' };
  }
  return { valid: true };
}

/**
 * Calculates matching numbers between player selection and drawn numbers.
 * Returns sorted list of matches.
 */
export function calculateMatches(selected: number[], drawn: number[]): number[] {
  const drawnSet = new Set(drawn);
  return selected.filter(n => drawnSet.has(n)).sort((a, b) => a - b);
}

/**
 * Executes a full Keno round calculation given the player's bet, selected numbers,
 * and an already-drawn or freshly drawn list of 20 numbers.
 */
export function computeKenoRoundResult(
  bet: number,
  selectedNumbers: number[],
  drawnNumbers: number[],
  roundId?: string
): KenoRoundResult {
  const matchedNumbers = calculateMatches(selectedNumbers, drawnNumbers);
  const matchesCount = matchedNumbers.length;
  const multiplier = getKenoMultiplier(selectedNumbers.length, matchesCount);
  const payout = calculateKenoPayout(bet, multiplier);
  const net = payout - bet;
  const isWin = payout > 0;

  return {
    id: roundId || `keno_${Date.now()}_${cryptoUniformIndex(1_000_000).toString(36)}`,
    timestamp: Date.now(),
    bet,
    selectedNumbers: [...selectedNumbers].sort((a, b) => a - b),
    drawnNumbers: [...drawnNumbers],
    matchedNumbers,
    matchesCount,
    multiplier,
    payout,
    net,
    isWin,
  };
}

/**
 * Loads Keno game history from localStorage (up to 50 rounds).
 */
export function loadKenoHistory(): KenoRoundResult[] {
  try {
    const raw = localStorage.getItem(KENO_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is KenoRoundResult =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.bet === 'number' &&
          Array.isArray(item.selectedNumbers) &&
          Array.isArray(item.drawnNumbers) &&
          Array.isArray(item.matchedNumbers) &&
          typeof item.matchesCount === 'number' &&
          typeof item.multiplier === 'number' &&
          typeof item.payout === 'number' &&
          typeof item.net === 'number' &&
          typeof item.isWin === 'boolean'
      )
      .slice(0, KENO_MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Saves Keno game history to localStorage.
 */
export function saveKenoHistory(history: KenoRoundResult[]): void {
  try {
    localStorage.setItem(
      KENO_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, KENO_MAX_HISTORY_ENTRIES))
    );
  } catch {
    // Gracefully handle storage quota errors
  }
}

/**
 * Appends a completed round result to history.
 */
export function appendKenoHistoryRecord(record: KenoRoundResult): KenoRoundResult[] {
  const existing = loadKenoHistory();
  const updated = [record, ...existing].slice(0, KENO_MAX_HISTORY_ENTRIES);
  saveKenoHistory(updated);
  return updated;
}

/**
 * Computes career statistics from history records.
 */
export function calculateKenoStats(history: KenoRoundResult[]): KenoStats {
  const roundsPlayed = history.length;
  let totalWagered = 0;
  let totalWon = 0;
  let winningRounds = 0;
  let bestWin = 0;

  for (const r of history) {
    totalWagered += r.bet;
    totalWon += r.payout;
    if (r.isWin) {
      winningRounds++;
      if (r.payout > bestWin) {
        bestWin = r.payout;
      }
    }
  }

  const losingRounds = roundsPlayed - winningRounds;
  const netProfit = totalWon - totalWagered;
  const winRate = roundsPlayed > 0 ? (winningRounds / roundsPlayed) * 100 : 0;

  return {
    roundsPlayed,
    totalWagered,
    totalWon,
    netProfit,
    winningRounds,
    losingRounds,
    bestWin,
    winRate,
  };
}
