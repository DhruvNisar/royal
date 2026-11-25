import {
  BingoTicketGrid,
  BingoMilestoneOutcome,
  BingoRoundResult,
  BingoStats,
} from '../../types';
import {
  BINGO_MIN_BET,
  BINGO_MAX_BET,
  BINGO_TOTAL_BALLS,
  BINGO_MILESTONES,
  calculateBingoMilestoneReward,
} from './bingoMath';

export const BINGO_HISTORY_STORAGE_KEY = 'royal_ace_bingo_history_v1';
export const BINGO_MAX_HISTORY_ENTRIES = 50;

export const BINGO_COLUMN_RANGES: readonly [number, number][] = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
] as const;

/**
 * Unbiased cryptographic uniform integer in [0, upperBoundExclusive) via rejection sampling.
 */
export function cryptoBingoUniformIndex(upperBoundExclusive: number): number {
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
 * Cryptographic Fisher-Yates shuffle.
 */
function cryptoShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoBingoUniformIndex(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Generates an unbiased, cryptographically shuffled 90-ball draw sequence (1..90).
 */
export function generateBingoDrawSequence(): number[] {
  const balls: number[] = [];
  for (let n = 1; n <= BINGO_TOTAL_BALLS; n++) {
    balls.push(n);
  }
  return cryptoShuffle(balls);
}

/**
 * Validates that a 3x9 90-ball ticket satisfies every official 90-ball Bingo invariant:
 * - Exactly 3 rows and 9 columns
 * - Exactly 5 numbers per row (15 total, 12 blanks)
 * - Every column has 1..3 numbers
 * - Every number falls within its column's official range (1-9, 10-19, ..., 80-90)
 * - Numbers in each column are strictly ascending from row 0 to row 2
 * - No duplicate numbers anywhere on the ticket
 */
export function validateBingoTicket(grid: BingoTicketGrid): { valid: boolean; error?: string } {
  if (!Array.isArray(grid) || grid.length !== 3) {
    return { valid: false, error: 'Ticket must have exactly 3 rows.' };
  }

  const seen = new Set<number>();

  for (let r = 0; r < 3; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== 9) {
      return { valid: false, error: `Row ${r} must have exactly 9 columns.` };
    }
    let rowCount = 0;
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (val !== null) {
        if (!Number.isInteger(val)) {
          return { valid: false, error: `Invalid cell value at (${r}, ${c}).` };
        }
        const [minVal, maxVal] = BINGO_COLUMN_RANGES[c];
        if (val < minVal || val > maxVal) {
          return {
            valid: false,
            error: `Value ${val} in column ${c} is outside [${minVal}, ${maxVal}].`,
          };
        }
        if (seen.has(val)) {
          return { valid: false, error: `Duplicate ticket number ${val}.` };
        }
        seen.add(val);
        rowCount++;
      }
    }
    if (rowCount !== 5) {
      return { valid: false, error: `Row ${r} has ${rowCount} numbers instead of 5.` };
    }
  }

  if (seen.size !== 15) {
    return { valid: false, error: `Ticket has ${seen.size} numbers instead of 15.` };
  }

  for (let c = 0; c < 9; c++) {
    const colVals: number[] = [];
    for (let r = 0; r < 3; r++) {
      const val = grid[r][c];
      if (val !== null) colVals.push(val);
    }
    if (colVals.length < 1 || colVals.length > 3) {
      return { valid: false, error: `Column ${c} must contain 1 to 3 numbers.` };
    }
    for (let i = 1; i < colVals.length; i++) {
      if (colVals[i] <= colVals[i - 1]) {
        return { valid: false, error: `Column ${c} numbers are not strictly ascending.` };
      }
    }
  }

  return { valid: true };
}

/**
 * Generates a valid official 90-ball 3x9 Bingo ticket using crypto.getRandomValues.
 */
export function generateValidBingoTicket(): BingoTicketGrid {
  // Step 1: Distribute 15 numbers across 9 columns with each column getting 1..3 numbers
  const colCounts = new Array<number>(9).fill(1);
  let remainingToAdd = 6;
  while (remainingToAdd > 0) {
    const eligibleCols: number[] = [];
    for (let c = 0; c < 9; c++) {
      if (colCounts[c] < 3) eligibleCols.push(c);
    }
    const chosen = eligibleCols[cryptoBingoUniformIndex(eligibleCols.length)];
    colCounts[chosen]++;
    remainingToAdd--;
  }

  // Step 2: Assign rows so every row receives exactly 5 numbers
  const occupancy: boolean[][] = [
    new Array<boolean>(9).fill(false),
    new Array<boolean>(9).fill(false),
    new Array<boolean>(9).fill(false),
  ];
  const rowRemaining = [5, 5, 5];

  const cols3: number[] = [];
  const cols2: number[] = [];
  const cols1: number[] = [];
  for (let c = 0; c < 9; c++) {
    if (colCounts[c] === 3) cols3.push(c);
    else if (colCounts[c] === 2) cols2.push(c);
    else cols1.push(c);
  }

  // Place 3-number columns across all 3 rows
  for (const c of cols3) {
    occupancy[0][c] = true;
    occupancy[1][c] = true;
    occupancy[2][c] = true;
    rowRemaining[0]--;
    rowRemaining[1]--;
    rowRemaining[2]--;
  }

  // Place 2-number columns into the 2 rows with highest remaining need (random tie-break)
  for (const c of cryptoShuffle(cols2)) {
    const rowsSorted = cryptoShuffle([0, 1, 2]).sort((a, b) => rowRemaining[b] - rowRemaining[a]);
    const rA = rowsSorted[0];
    const rB = rowsSorted[1];
    occupancy[rA][c] = true;
    occupancy[rB][c] = true;
    rowRemaining[rA]--;
    rowRemaining[rB]--;
  }

  // Place 1-number columns into rows still needing slots
  for (const c of cryptoShuffle(cols1)) {
    const availableRows = [0, 1, 2].filter(r => rowRemaining[r] > 0);
    const chosenRow = availableRows[cryptoBingoUniformIndex(availableRows.length)];
    occupancy[chosenRow][c] = true;
    rowRemaining[chosenRow]--;
  }

  // Step 3: Populate each column with distinct numbers from its official range sorted ascending
  const grid: BingoTicketGrid = [
    new Array(9).fill(null),
    new Array(9).fill(null),
    new Array(9).fill(null),
  ];

  for (let c = 0; c < 9; c++) {
    const [minVal, maxVal] = BINGO_COLUMN_RANGES[c];
    const pool: number[] = [];
    for (let v = minVal; v <= maxVal; v++) {
      pool.push(v);
    }
    const picked = cryptoShuffle(pool)
      .slice(0, colCounts[c])
      .sort((a, b) => a - b);

    let pickIdx = 0;
    for (let r = 0; r < 3; r++) {
      if (occupancy[r][c]) {
        grid[r][c] = picked[pickIdx++];
      }
    }
  }

  const check = validateBingoTicket(grid);
  if (!check.valid) {
    throw new Error(`Generated invalid Bingo ticket: ${check.error}`);
  }

  return grid;
}

/**
 * Extracts all 15 sorted numbers from a 3x9 ticket.
 */
export function extractTicketNumbers(grid: BingoTicketGrid): number[] {
  const nums: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (val !== null) nums.push(val);
    }
  }
  return nums.sort((a, b) => a - b);
}

export interface BingoLiveEvaluation {
  rowMarkedCounts: [number, number, number];
  completedRows: [boolean, boolean, boolean];
  completedLinesCount: number;
  totalMarkedCount: number;
  oneLineCall: number | null;
  twoLinesCall: number | null;
  fullHouseCall: number | null;
  outcomes: BingoMilestoneOutcome[];
}

/**
 * Evaluates a ticket against the sequence of called balls in exact chronological order
 * so milestone call numbers (1 Line, 2 Lines, Full House) are 100% deterministic.
 */
export function evaluateBingoProgress(
  grid: BingoTicketGrid,
  calledBallsInOrder: number[],
  bet: number
): BingoLiveEvaluation {
  const rowSets: Set<number>[] = [new Set(), new Set(), new Set()];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (val !== null) rowSets[r].add(val);
    }
  }

  const rowHits = [0, 0, 0];
  let completedLines = 0;
  let oneLineCall: number | null = null;
  let twoLinesCall: number | null = null;
  let fullHouseCall: number | null = null;

  for (let i = 0; i < calledBallsInOrder.length; i++) {
    const ball = calledBallsInOrder[i];
    const callNum = i + 1;

    for (let r = 0; r < 3; r++) {
      if (rowSets[r].has(ball)) {
        rowHits[r]++;
        if (rowHits[r] === 5) {
          completedLines++;
          if (completedLines === 1 && oneLineCall === null) oneLineCall = callNum;
          if (completedLines === 2 && twoLinesCall === null) twoLinesCall = callNum;
          if (completedLines === 3 && fullHouseCall === null) fullHouseCall = callNum;
        }
        break; // Numbers are unique across the ticket
      }
    }
  }

  const m1 = BINGO_MILESTONES.ONE_LINE;
  const m2 = BINGO_MILESTONES.TWO_LINES;
  const m3 = BINGO_MILESTONES.FULL_HOUSE;

  const earned1 = oneLineCall !== null && oneLineCall <= m1.targetCalls;
  const earned2 = twoLinesCall !== null && twoLinesCall <= m2.targetCalls;
  const earned3 = fullHouseCall !== null && fullHouseCall <= m3.targetCalls;

  const outcomes: BingoMilestoneOutcome[] = [
    {
      id: 'ONE_LINE',
      label: m1.label,
      targetCalls: m1.targetCalls,
      multiplier: m1.multiplier,
      achievedAtCall: oneLineCall,
      earned: earned1,
      reward: earned1 ? calculateBingoMilestoneReward(bet, m1.multiplier) : 0,
    },
    {
      id: 'TWO_LINES',
      label: m2.label,
      targetCalls: m2.targetCalls,
      multiplier: m2.multiplier,
      achievedAtCall: twoLinesCall,
      earned: earned2,
      reward: earned2 ? calculateBingoMilestoneReward(bet, m2.multiplier) : 0,
    },
    {
      id: 'FULL_HOUSE',
      label: m3.label,
      targetCalls: m3.targetCalls,
      multiplier: m3.multiplier,
      achievedAtCall: fullHouseCall,
      earned: earned3,
      reward: earned3 ? calculateBingoMilestoneReward(bet, m3.multiplier) : 0,
    },
  ];

  return {
    rowMarkedCounts: [rowHits[0], rowHits[1], rowHits[2]],
    completedRows: [rowHits[0] === 5, rowHits[1] === 5, rowHits[2] === 5],
    completedLinesCount: completedLines,
    totalMarkedCount: rowHits[0] + rowHits[1] + rowHits[2],
    oneLineCall,
    twoLinesCall,
    fullHouseCall,
    outcomes,
  };
}

/**
 * Validates Bingo bet amount against table limits and player wallet balance.
 */
export function validateBingoBetAmount(
  amount: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return { valid: false, error: 'Ticket wager must be a whole number of coins.' };
  }
  if (amount < BINGO_MIN_BET) {
    return { valid: false, error: `Minimum Bingo ticket wager is ${BINGO_MIN_BET} coins.` };
  }
  if (amount > BINGO_MAX_BET) {
    return {
      valid: false,
      error: `Maximum Bingo ticket wager is ${BINGO_MAX_BET.toLocaleString()} coins.`,
    };
  }
  if (amount > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance for this ticket.' };
  }
  return { valid: true };
}

/**
 * History persistence (max 50 rounds).
 */
export function loadBingoHistory(): BingoRoundResult[] {
  try {
    const raw = localStorage.getItem(BINGO_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is BingoRoundResult =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          typeof item.bet === 'number' &&
          typeof item.totalReward === 'number'
      )
      .slice(0, BINGO_MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function saveBingoHistory(history: BingoRoundResult[]): void {
  try {
    localStorage.setItem(
      BINGO_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, BINGO_MAX_HISTORY_ENTRIES))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function appendBingoHistoryRecord(record: BingoRoundResult): BingoRoundResult[] {
  const existing = loadBingoHistory();
  const updated = [record, ...existing].slice(0, BINGO_MAX_HISTORY_ENTRIES);
  saveBingoHistory(updated);
  return updated;
}

export function calculateBingoStats(history: BingoRoundResult[]): BingoStats {
  const roundsPlayed = history.length;
  let totalWagered = 0;
  let totalWon = 0;
  let oneLineWins = 0;
  let twoLinesWins = 0;
  let fullHouseWins = 0;
  let winningRounds = 0;
  let bestReward = 0;

  for (const r of history) {
    totalWagered += r.bet;
    totalWon += r.totalReward;
    if (r.oneLine?.earned) oneLineWins++;
    if (r.twoLines?.earned) twoLinesWins++;
    if (r.fullHouse?.earned) fullHouseWins++;
    if (r.totalReward > 0) winningRounds++;
    if (r.totalReward > bestReward) bestReward = r.totalReward;
  }

  return {
    roundsPlayed,
    totalWagered,
    totalWon,
    netProfit: totalWon - totalWagered,
    oneLineWins,
    twoLinesWins,
    fullHouseWins,
    bestReward,
    winRate: roundsPlayed > 0 ? (winningRounds / roundsPlayed) * 100 : 0,
  };
}
