import { MinesGameState, MinesRoundResult } from '../../types';
import {
  MINES_DEFAULT_BET,
  MINES_DEFAULT_COUNT,
  MINES_MAX_BET,
  MINES_MAX_COUNT,
  MINES_MIN_BET,
  MINES_MIN_COUNT,
  MINES_TOTAL_TILES,
  calculateMinesMultiplier,
  calculateMinesPayout,
} from './minesMath';

export {
  MINES_DEFAULT_BET,
  MINES_DEFAULT_COUNT,
  MINES_MAX_BET,
  MINES_MAX_COUNT,
  MINES_MIN_BET,
  MINES_MIN_COUNT,
  MINES_TOTAL_TILES,
};

export const MINES_HISTORY_STORAGE_KEY = 'royal_ace_mines_history_v1';
export const MINES_HISTORY_MAX_ITEMS = 50;

export type MinesRandomIndexGenerator = (upperBoundExclusive: number) => number;

export interface MinesRoundSession {
  roundId: string;
  state: MinesGameState;
  bet: number;
  mineCount: number;
  minePositions: number[];
  revealedTiles: number[];
  hitMineTile: number | null;
  currentMultiplier: number;
  payout: number;
  net: number;
  settled: boolean;
}

export function validateMinesCount(mineCount: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(mineCount) || !Number.isInteger(mineCount)) {
    return { valid: false, error: 'Mine count must be a whole number.' };
  }
  if (mineCount < MINES_MIN_COUNT || mineCount > MINES_MAX_COUNT) {
    return {
      valid: false,
      error: `Mine count must be between ${MINES_MIN_COUNT} and ${MINES_MAX_COUNT}.`,
    };
  }
  return { valid: true };
}

export function validateMinesBet(
  betAmount: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (betAmount < MINES_MIN_BET) {
    return { valid: false, error: `Minimum bet is ${MINES_MIN_BET} coins.` };
  }
  if (betAmount > MINES_MAX_BET) {
    return {
      valid: false,
      error: `Maximum bet is ${MINES_MAX_BET.toLocaleString()} coins.`,
    };
  }
  if (betAmount > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance.' };
  }
  return { valid: true };
}

/**
 * Default cryptographic uniform integer generator in [0, upperBoundExclusive)
 * using rejection sampling over crypto.getRandomValues() to eliminate modulo bias.
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
 * Generates exactly `mineCount` unique tile indices in [0, 24] before any reveal occurs.
 * Uses Fisher-Yates shuffle driven by cryptographic randomness (no Math.random).
 * Accepts an optional RNG provider so server-side outcomes can replace local RNG cleanly.
 */
export function generateMinePositions(
  mineCount: number,
  rng: MinesRandomIndexGenerator = cryptoUniformIndex
): number[] {
  const countCheck = validateMinesCount(mineCount);
  if (!countCheck.valid) {
    throw new Error(countCheck.error);
  }

  const pool = Array.from({ length: MINES_TOTAL_TILES }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return pool.slice(0, mineCount).sort((a, b) => a - b);
}

/**
 * Creates an initial READY round session placeholder (no mines committed until bet starts).
 */
export function createReadyMinesSession(
  bet: number = MINES_DEFAULT_BET,
  mineCount: number = MINES_DEFAULT_COUNT
): MinesRoundSession {
  return {
    roundId: '',
    state: 'READY',
    bet,
    mineCount,
    minePositions: [],
    revealedTiles: [],
    hitMineTile: null,
    currentMultiplier: 1,
    payout: 0,
    net: 0,
    settled: false,
  };
}

/**
 * Starts a new active Royal Mines round with a fixed pre-generated mine layout.
 */
export function startMinesRound(
  bet: number,
  mineCount: number,
  rng: MinesRandomIndexGenerator = cryptoUniformIndex
): MinesRoundSession {
  const countCheck = validateMinesCount(mineCount);
  if (!countCheck.valid) {
    throw new Error(countCheck.error);
  }
  if (!Number.isInteger(bet) || bet < MINES_MIN_BET || bet > MINES_MAX_BET) {
    throw new Error(`Invalid bet amount: ${bet}`);
  }

  const minePositions = generateMinePositions(mineCount, rng);

  return {
    roundId: `mines_${Date.now()}_${cryptoUniformIndex(1_000_000).toString(36)}`,
    state: 'PLAYING',
    bet,
    mineCount,
    minePositions,
    revealedTiles: [],
    hitMineTile: null,
    currentMultiplier: 1,
    payout: 0,
    net: 0,
    settled: false,
  };
}

export interface TileRevealOutcome {
  session: MinesRoundSession;
  accepted: boolean;
  hitMine: boolean;
  autoWon: boolean;
}

/**
 * Reveals a single tile on an active round.
 * - Rejects if not PLAYING, already settled, out of bounds, or already revealed.
 * - Ends in LOST if tile is a mine.
 * - Automatically settles as WON if all (25 - mineCount) safe tiles are revealed.
 */
export function revealMinesTile(
  session: MinesRoundSession,
  tileIndex: number
): TileRevealOutcome {
  if (session.state !== 'PLAYING' || session.settled) {
    return { session, accepted: false, hitMine: false, autoWon: false };
  }
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= MINES_TOTAL_TILES) {
    return { session, accepted: false, hitMine: false, autoWon: false };
  }
  if (session.revealedTiles.includes(tileIndex)) {
    return { session, accepted: false, hitMine: false, autoWon: false };
  }

  const isMine = session.minePositions.includes(tileIndex);
  if (isMine) {
    const nextSession: MinesRoundSession = {
      ...session,
      state: 'LOST',
      hitMineTile: tileIndex,
      payout: 0,
      net: -session.bet,
      settled: true,
    };
    return { session: nextSession, accepted: true, hitMine: true, autoWon: false };
  }

  const nextRevealed = [...session.revealedTiles, tileIndex];
  const safeCount = nextRevealed.length;
  const maxSafeCount = MINES_TOTAL_TILES - session.mineCount;
  const nextMultiplier = calculateMinesMultiplier(session.mineCount, safeCount);
  const potentialPayout = calculateMinesPayout(session.bet, nextMultiplier);
  const allSafeRevealed = safeCount >= maxSafeCount;

  const nextSession: MinesRoundSession = {
    ...session,
    state: allSafeRevealed ? 'WON' : 'PLAYING',
    revealedTiles: nextRevealed,
    currentMultiplier: nextMultiplier,
    payout: potentialPayout,
    net: potentialPayout - session.bet,
    settled: allSafeRevealed,
  };

  return {
    session: nextSession,
    accepted: true,
    hitMine: false,
    autoWon: allSafeRevealed,
  };
}

/**
 * Cashes out an active round after at least 1 safe diamond has been revealed.
 */
export function cashOutMinesRound(
  session: MinesRoundSession
): { session: MinesRoundSession; accepted: boolean } {
  if (session.state !== 'PLAYING' || session.settled || session.revealedTiles.length < 1) {
    return { session, accepted: false };
  }

  const finalMultiplier = calculateMinesMultiplier(
    session.mineCount,
    session.revealedTiles.length
  );
  const payout = calculateMinesPayout(session.bet, finalMultiplier);

  const nextSession: MinesRoundSession = {
    ...session,
    state: 'CASHED_OUT',
    currentMultiplier: finalMultiplier,
    payout,
    net: payout - session.bet,
    settled: true,
  };

  return { session: nextSession, accepted: true };
}

/**
 * Generates a unique shuffled order of safe-candidate tile indices for Auto Play picks.
 */
export function generateAutoPickSequence(
  picksCount: number,
  rng: MinesRandomIndexGenerator = cryptoUniformIndex
): number[] {
  const clamped = Math.max(1, Math.min(MINES_TOTAL_TILES - 1, Math.floor(picksCount)));
  const pool = Array.from({ length: MINES_TOTAL_TILES }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, clamped);
}

export function loadMinesHistory(): MinesRoundResult[] {
  try {
    const raw = localStorage.getItem(MINES_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is MinesRoundResult =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          Number.isFinite(item.timestamp) &&
          typeof item.bet === 'number' &&
          Number.isFinite(item.bet) &&
          typeof item.mineCount === 'number' &&
          item.mineCount >= MINES_MIN_COUNT &&
          item.mineCount <= MINES_MAX_COUNT &&
          typeof item.safeRevealed === 'number' &&
          typeof item.multiplier === 'number' &&
          Number.isFinite(item.multiplier) &&
          typeof item.payout === 'number' &&
          Number.isFinite(item.payout) &&
          typeof item.net === 'number' &&
          Number.isFinite(item.net) &&
          (item.outcome === 'CASHED_OUT' || item.outcome === 'WON' || item.outcome === 'LOST')
      )
      .slice(0, MINES_HISTORY_MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveMinesHistory(history: MinesRoundResult[]): void {
  try {
    localStorage.setItem(
      MINES_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MINES_HISTORY_MAX_ITEMS))
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function appendMinesHistoryRecord(record: MinesRoundResult): MinesRoundResult[] {
  const existing = loadMinesHistory();
  const updated = [record, ...existing].slice(0, MINES_HISTORY_MAX_ITEMS);
  saveMinesHistory(updated);
  return updated;
}
