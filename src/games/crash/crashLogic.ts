import { CrashRoundResult } from '../../types';

export const CRASH_TARGET_RTP = 0.97;
export const CRASH_MAX_MULTIPLIER = 1000;
export const CRASH_MIN_BET = 10;
export const CRASH_MAX_BET = 5000;
export const CRASH_DEFAULT_BET = 100;
export const CRASH_GROWTH_RATE_PER_SEC = 0.08;

const CRASH_HISTORY_STORAGE_KEY = 'royal_ace_crash_history';

export function validateCrashBet(betAmount: number, balance: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (betAmount < CRASH_MIN_BET) {
    return { valid: false, error: `Minimum bet is ${CRASH_MIN_BET} coins.` };
  }
  if (betAmount > CRASH_MAX_BET) {
    return { valid: false, error: `Maximum bet is ${CRASH_MAX_BET.toLocaleString()} coins.` };
  }
  if (betAmount > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance.' };
  }
  return { valid: true };
}

export function validateAutoCashOut(target: number | null): { valid: boolean; error?: string } {
  if (target === null) return { valid: true };
  if (!Number.isFinite(target) || target < 1.01 || target > CRASH_MAX_MULTIPLIER) {
    return {
      valid: false,
      error: `Auto cash-out must be between 1.01x and ${CRASH_MAX_MULTIPLIER.toLocaleString()}x.`,
    };
  }
  return { valid: true };
}

/**
 * Generates an independent cryptographic uniform float u in [0, 1) using 53 random bits.
 */
export function cryptoRandomUniform(): number {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographic randomness API is unavailable in this environment.');
  }
  const buf = new Uint32Array(2);
  cryptoObj.getRandomValues(buf);
  const high = buf[0] >>> 5; // 27 bits
  const low = buf[1] >>> 6;  // 26 bits
  return (high * 67108864 + low) / 9007199254740992;
}

/**
 * Converts a uniform random value u in [0, 1) into a Crash point using
 * inverse-distribution under the 97% RTP model:
 * P(crash >= m) ≈ 0.97 / m for m > 1.00, capped at 1000.00x.
 * Includes a 3% probability of immediate crash at 1.00x.
 */
export function crashPointFromUniform(u: number): number {
  const clampedU = Math.min(0.9999999999999999, Math.max(0, u));
  const raw = CRASH_TARGET_RTP / (1 - clampedU);
  if (raw < 1.0) {
    return 1.0;
  }
  const floored = Math.floor(raw * 100) / 100;
  return Math.max(1.0, Math.min(CRASH_MAX_MULTIPLIER, floored));
}

/**
 * Generates an independent predetermined crash point via browser cryptographic randomness.
 * Structured as an isolated pure generator so it can later be swapped for a server service.
 */
export function generateCrashPoint(): number {
  return crashPointFromUniform(cryptoRandomUniform());
}

/**
 * Smooth time-based exponential multiplier curve starting at 1.00x at t = 0.
 * Progresses monotonically faster over elapsed time.
 */
export function getCrashMultiplierAtElapsed(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1.0;
  const seconds = elapsedMs / 1000;
  const raw = Math.exp(CRASH_GROWTH_RATE_PER_SEC * seconds);
  const rounded = Math.floor(raw * 100) / 100;
  return Math.max(1.0, Math.min(CRASH_MAX_MULTIPLIER, rounded));
}

/**
 * Unrounded continuous multiplier for smooth graph plotting.
 */
export function getContinuousCrashMultiplier(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1.0;
  const seconds = elapsedMs / 1000;
  return Math.min(CRASH_MAX_MULTIPLIER, Math.exp(CRASH_GROWTH_RATE_PER_SEC * seconds));
}

/**
 * Exact elapsed milliseconds when the curve reaches a given multiplier m >= 1.00.
 */
export function getElapsedForCrashMultiplier(multiplier: number): number {
  if (multiplier <= 1.0) return 0;
  const capped = Math.min(CRASH_MAX_MULTIPLIER, multiplier);
  return (Math.log(capped) / CRASH_GROWTH_RATE_PER_SEC) * 1000;
}

/**
 * Calculates whole-coin payout strictly if acceptedCashOut < crashPoint.
 */
export function calculateCrashPayout(betAmount: number, acceptedMultiplier: number): number {
  if (!Number.isFinite(betAmount) || !Number.isFinite(acceptedMultiplier) || betAmount <= 0 || acceptedMultiplier <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(betAmount * acceptedMultiplier));
}

export function canCashOutAtMultiplier(currentMultiplier: number, crashPoint: number): boolean {
  if (crashPoint <= 1.0) return false;
  return currentMultiplier >= 1.0 && currentMultiplier < crashPoint;
}

export function loadCrashHistory(): CrashRoundResult[] {
  try {
    const raw = localStorage.getItem(CRASH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CrashRoundResult =>
          item &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.bet === 'number' &&
          typeof item.finalCrashMultiplier === 'number' &&
          (item.cashOutMultiplier === null || typeof item.cashOutMultiplier === 'number') &&
          typeof item.payout === 'number' &&
          typeof item.net === 'number' &&
          (item.outcome === 'CASHED_OUT' || item.outcome === 'CRASHED')
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function saveCrashHistory(history: CrashRoundResult[]): void {
  try {
    localStorage.setItem(CRASH_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
