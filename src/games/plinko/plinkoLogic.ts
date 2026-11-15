import { PlinkoRiskLevel, PlinkoRoundResult, PlinkoRowCount } from '../../types';

export const PLINKO_TARGET_RTP = 0.97;
export const PLINKO_RTP_TOLERANCE = 0.0025; // ±0.25 percentage points
export const PLINKO_MAX_MULTIPLIER = 1000;
export const PLINKO_MIN_BET = 10;
export const PLINKO_MAX_BET = 5000;
export const PLINKO_DEFAULT_BET = 100;

export const PLINKO_ROW_OPTIONS: PlinkoRowCount[] = [8, 9, 10, 11, 12, 13, 14, 15, 16];
export const PLINKO_RISK_OPTIONS: PlinkoRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

const PLINKO_HISTORY_STORAGE_KEY = 'royal_ace_plinko_history';

export function isValidPlinkoRowCount(rows: number): rows is PlinkoRowCount {
  return PLINKO_ROW_OPTIONS.includes(rows as PlinkoRowCount);
}

export function isValidPlinkoRiskLevel(risk: string): risk is PlinkoRiskLevel {
  return risk === 'LOW' || risk === 'MEDIUM' || risk === 'HIGH';
}

export function validatePlinkoBet(betAmount: number, balance: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (betAmount < PLINKO_MIN_BET) {
    return { valid: false, error: `Minimum bet is ${PLINKO_MIN_BET} coins.` };
  }
  if (betAmount > PLINKO_MAX_BET) {
    return { valid: false, error: `Maximum bet is ${PLINKO_MAX_BET.toLocaleString()} coins.` };
  }
  if (betAmount > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance.' };
  }
  return { valid: true };
}

/**
 * Exact binomial coefficient C(n, k) for 0 <= k <= n <= 16.
 */
export function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const r = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = (res * (n - r + i)) / i;
  }
  return Math.round(res);
}

/**
 * Exact binomial probability distribution P(slot k) = C(n, k) / 2^n.
 */
export function getPlinkoProbabilities(rows: PlinkoRowCount): number[] {
  const denom = Math.pow(2, rows);
  const probs: number[] = [];
  for (let k = 0; k <= rows; k++) {
    probs.push(binomialCoefficient(rows, k) / denom);
  }
  return probs;
}

export function calculatePlinkoRTP(rows: PlinkoRowCount, multipliers: number[]): number {
  const probs = getPlinkoProbabilities(rows);
  let sum = 0;
  for (let k = 0; k <= rows; k++) {
    sum += probs[k] * (multipliers[k] ?? 0);
  }
  return sum;
}

function roundTwoDecimals(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function buildCalibratedPayoutTable(
  rows: PlinkoRowCount,
  risk: PlinkoRiskLevel,
  targetRtp: number = PLINKO_TARGET_RTP
): number[] {
  const probs = getPlinkoProbabilities(rows);
  const halfSpan = rows / 2;

  const config = {
    LOW: {
      floor: rows <= 10 ? 0.55 : 0.5,
      edgeBase: 5.6 * Math.pow(1.14, rows - 8),
      exponent: 2.6,
    },
    MEDIUM: {
      floor: rows <= 10 ? 0.35 : 0.3,
      edgeBase: 13.0 * Math.pow(1.32, rows - 8),
      exponent: 4.5,
    },
    HIGH: {
      floor: 0.2,
      edgeBase: 29.0 * Math.pow(1.56, rows - 8),
      exponent: 6.7,
    },
  }[risk];

  const rawDeltas: number[] = [];
  for (let k = 0; k <= rows; k++) {
    const t = Math.abs(k - halfSpan) / halfSpan; // 0 at center, 1 at edges
    const delta = Math.max(0, config.edgeBase - config.floor) * Math.pow(t, config.exponent);
    rawDeltas.push(delta);
  }

  // Binary search alpha so SUM(P(k) * min(MAX, floor + alpha * delta(k))) == targetRtp
  let low = 0.01;
  let high = 20.0;
  for (let iter = 0; iter < 64; iter++) {
    const mid = (low + high) / 2;
    let rtp = 0;
    for (let k = 0; k <= rows; k++) {
      const m = Math.min(PLINKO_MAX_MULTIPLIER, config.floor + mid * rawDeltas[k]);
      rtp += probs[k] * m;
    }
    if (rtp < targetRtp) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const alpha = (low + high) / 2;
  const table: number[] = [];
  for (let k = 0; k <= rows; k++) {
    const raw = Math.min(PLINKO_MAX_MULTIPLIER, config.floor + alpha * rawDeltas[k]);
    table.push(roundTwoDecimals(Math.max(0.1, raw)));
  }

  // Enforce strict symmetry before and during fine calibration
  for (let k = 0; k <= Math.floor(rows / 2); k++) {
    const sym = table[k];
    table[rows - k] = sym;
  }

  // Fine-tune symmetric pairs in 0.01x steps so rounded/capped table hits targetRtp within tight bounds
  const centerIdx = Math.floor(rows / 2);
  for (let step = 0; step < 300; step++) {
    const currentRtp = calculatePlinkoRTP(rows, table);
    const diff = targetRtp - currentRtp;
    if (Math.abs(diff) <= 0.0004) break;

    const dir = diff > 0 ? 1 : -1;
    let bestK = -1;
    let bestNewError = Math.abs(diff);

    for (let k = 0; k <= centerIdx; k++) {
      const isCenterSingle = rows % 2 === 0 && k === centerIdx;
      const pairProb = isCenterSingle ? probs[k] : probs[k] * 2;
      const candidateVal = roundTwoDecimals(table[k] + dir * 0.01);

      if (candidateVal < 0.1 || candidateVal > PLINKO_MAX_MULTIPLIER) continue;

      // Preserve monotonic shape: outer slot >= inner slot
      if (k > 0 && candidateVal > table[k - 1]) continue;
      if (k < centerIdx && candidateVal < table[k + 1]) continue;

      const nextRtp = currentRtp + dir * 0.01 * pairProb;
      const nextErr = Math.abs(targetRtp - nextRtp);
      if (nextErr < bestNewError - 1e-9) {
        bestNewError = nextErr;
        bestK = k;
      }
    }

    if (bestK === -1) break;
    const updatedVal = roundTwoDecimals(table[bestK] + dir * 0.01);
    table[bestK] = updatedVal;
    table[rows - bestK] = updatedVal;
  }

  return table;
}

// Precompute and memoize all 27 calibrated tables for zero runtime overhead
const PAYOUT_TABLE_CACHE: Record<string, number[]> = {};

for (const rows of PLINKO_ROW_OPTIONS) {
  for (const risk of PLINKO_RISK_OPTIONS) {
    PAYOUT_TABLE_CACHE[`${rows}_${risk}`] = buildCalibratedPayoutTable(rows, risk, PLINKO_TARGET_RTP);
  }
}

export function getPlinkoPayoutTable(rows: PlinkoRowCount, risk: PlinkoRiskLevel): number[] {
  const key = `${rows}_${risk}`;
  const cached = PAYOUT_TABLE_CACHE[key];
  if (cached) return [...cached];
  return buildCalibratedPayoutTable(rows, risk, PLINKO_TARGET_RTP);
}

/**
 * Generates an independent left/right path of length `rows` using browser
 * cryptographic randomness (crypto.getRandomValues).
 * 0 = Left movement, 1 = Right movement.
 * Slot index k = sum of Right movements (0 .. rows).
 */
export interface PlinkoDropOutcome {
  path: (0 | 1)[];
  slotIndex: number;
  multiplier: number;
  payout: number;
  net: number;
}

export function generatePlinkoOutcome(
  betAmount: number,
  rows: PlinkoRowCount,
  risk: PlinkoRiskLevel
): PlinkoDropOutcome {
  if (!isValidPlinkoRowCount(rows)) {
    throw new Error(`Invalid Plinko row count: ${rows}`);
  }
  if (!isValidPlinkoRiskLevel(risk)) {
    throw new Error(`Invalid Plinko risk level: ${risk}`);
  }
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    throw new Error(`Invalid Plinko bet amount: ${betAmount}`);
  }

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographic randomness API is unavailable in this environment.');
  }

  const randomValues = new Uint32Array(rows);
  cryptoObj.getRandomValues(randomValues);

  const path: (0 | 1)[] = [];
  let rightMoves = 0;

  for (let i = 0; i < rows; i++) {
    // Each bit of a uniform 32-bit integer has exact P=0.5 of being 0 or 1
    const bit: 0 | 1 = (randomValues[i] & 1) === 1 ? 1 : 0;
    path.push(bit);
    rightMoves += bit;
  }

  const table = getPlinkoPayoutTable(rows, risk);
  const multiplier = table[rightMoves] ?? 0;
  const payout = calculatePlinkoPayout(betAmount, multiplier);
  const net = payout - betAmount;

  return {
    path,
    slotIndex: rightMoves,
    multiplier,
    payout,
    net,
  };
}

export function calculatePlinkoPayout(betAmount: number, multiplier: number): number {
  if (!Number.isFinite(betAmount) || !Number.isFinite(multiplier) || betAmount <= 0 || multiplier <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(betAmount * multiplier));
}

export function loadPlinkoHistory(): PlinkoRoundResult[] {
  try {
    const raw = localStorage.getItem(PLINKO_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is PlinkoRoundResult =>
          item &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.bet === 'number' &&
          isValidPlinkoRowCount(item.rows) &&
          isValidPlinkoRiskLevel(item.risk) &&
          typeof item.slotIndex === 'number' &&
          typeof item.multiplier === 'number' &&
          typeof item.payout === 'number' &&
          typeof item.net === 'number'
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function savePlinkoHistory(history: PlinkoRoundResult[]): void {
  try {
    localStorage.setItem(PLINKO_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
