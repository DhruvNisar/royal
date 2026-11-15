import { Card, Rank, Suit, TeenPattiEvaluation } from '../types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<Suit, string> = {
  spades: '#0f172a',
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#0f172a',
};

export function getRankValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function createDeck(numDecks: number = 1): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `${suit}_${rank}_${d}_${Math.random().toString(36).substring(2, 6)}`,
          suit,
          rank,
          value: getRankValue(rank),
        });
      }
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// --- Blackjack Calculations ---
export function calculateBlackjackScore(cards: Card[]): { score: number; isSoft: boolean; isBust: boolean } {
  let score = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.isHidden) continue;
    if (card.rank === 'A') {
      aceCount++;
      score += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      score += 10;
    } else {
      score += parseInt(card.rank, 10);
    }
  }

  let isSoft = aceCount > 0;
  while (score > 21 && aceCount > 0) {
    score -= 10;
    aceCount--;
  }

  return {
    score,
    isSoft: aceCount > 0,
    isBust: score > 21,
  };
}

export function isNaturalBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const ranks = cards.map(c => c.rank);
  const hasAce = ranks.includes('A');
  const hasTen = ranks.some(r => ['10', 'J', 'Q', 'K'].includes(r));
  return hasAce && hasTen;
}

// --- Baccarat Calculations ---
export function getBaccaratCardValue(card: Card): number {
  if (card.rank === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
  return parseInt(card.rank, 10);
}

export function calculateBaccaratHandTotal(cards: Card[]): number {
  const sum = cards.reduce((acc, card) => acc + getBaccaratCardValue(card), 0);
  return sum % 10;
}

/**
 * Standard International Baccarat (Punto Banco) Third-Card Tableau:
 * Returns: { playerDraws: boolean, bankerDraws: boolean }
 */
export function determineBaccaratThirdCards(
  playerCards: Card[],
  bankerCards: Card[]
): { playerDraws: boolean; bankerDraws: (playerThirdCard: Card | null) => boolean } {
  const pTotal = calculateBaccaratHandTotal(playerCards);
  const bTotal = calculateBaccaratHandTotal(bankerCards);

  // If either has a natural 8 or 9, no further cards are dealt
  if (pTotal >= 8 || bTotal >= 8) {
    return {
      playerDraws: false,
      bankerDraws: () => false,
    };
  }

  const playerDraws = pTotal <= 5;

  const bankerDraws = (playerThirdCard: Card | null): boolean => {
    if (!playerDraws) {
      // If Player stood with 6 or 7, Banker draws on 0-5 and stands on 6-7
      return bTotal <= 5;
    }

    if (!playerThirdCard) return false;
    const p3Val = getBaccaratCardValue(playerThirdCard);

    if (bTotal <= 2) return true;
    if (bTotal === 3) return p3Val !== 8;
    if (bTotal === 4) return p3Val >= 2 && p3Val <= 7;
    if (bTotal === 5) return p3Val >= 4 && p3Val <= 7;
    if (bTotal === 6) return p3Val === 6 || p3Val === 7;
    return false; // Banker 7 stands
  };

  return { playerDraws, bankerDraws };
}

// --- Texas Hold'em Hand Evaluator ---
const RANK_ORDER: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export interface PokerEvaluation {
  rankLevel: number; // 1 (High Card) to 10 (Royal Flush)
  name: string;
  score: number;
  bestFive: Card[];
}

export function evaluate7CardPokerHand(cards: Card[]): PokerEvaluation {
  if (cards.length < 5) {
    return { rankLevel: 0, name: 'Incomplete Hand', score: 0, bestFive: cards };
  }

  // Generate all 5-card combinations
  const combos: Card[][] = [];
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            combos.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }

  let bestEval: PokerEvaluation = { rankLevel: 0, name: 'High Card', score: 0, bestFive: [] };

  for (const combo of combos) {
    const curEval = evaluate5CardHand(combo);
    if (curEval.score > bestEval.score) {
      bestEval = curEval;
    }
  }

  return bestEval;
}

function evaluate5CardHand(cards: Card[]): PokerEvaluation {
  const sorted = [...cards].sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
  const ranks = sorted.map(c => RANK_ORDER[c.rank]);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Standard straight
  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHigh = ranks[0];
  } else if (
    // Ace-low straight (A-2-3-4-5)
    ranks[0] === 14 &&
    ranks[1] === 5 &&
    ranks[2] === 4 &&
    ranks[3] === 3 &&
    ranks[4] === 2
  ) {
    isStraight = true;
    straightHigh = 5;
  }

  // Count rank frequencies
  const counts: Record<number, number> = {};
  ranks.forEach(r => (counts[r] = (counts[r] || 0) + 1));
  const countsArr = Object.entries(counts).map(([r, c]) => ({ rank: parseInt(r, 10), count: c }));
  countsArr.sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 10. Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rankLevel: 10, name: 'Royal Flush', score: 10_000_000, bestFive: sorted };
  }

  // 9. Straight Flush
  if (isFlush && isStraight) {
    return { rankLevel: 9, name: 'Straight Flush', score: 9_000_000 + straightHigh, bestFive: sorted };
  }

  // 8. Four of a Kind
  if (countsArr[0].count === 4) {
    const score = 8_000_000 + countsArr[0].rank * 100 + countsArr[1].rank;
    return { rankLevel: 8, name: 'Four of a Kind', score, bestFive: sorted };
  }

  // 7. Full House
  if (countsArr[0].count === 3 && countsArr[1].count === 2) {
    const score = 7_000_000 + countsArr[0].rank * 100 + countsArr[1].rank;
    return { rankLevel: 7, name: 'Full House', score, bestFive: sorted };
  }

  // 6. Flush
  if (isFlush) {
    const kickerScore = ranks[0] * 10000 + ranks[1] * 1000 + ranks[2] * 100 + ranks[3] * 10 + ranks[4];
    return { rankLevel: 6, name: 'Flush', score: 6_000_000 + kickerScore, bestFive: sorted };
  }

  // 5. Straight
  if (isStraight) {
    return { rankLevel: 5, name: 'Straight', score: 5_000_000 + straightHigh, bestFive: sorted };
  }

  // 4. Three of a Kind
  if (countsArr[0].count === 3) {
    const score = 4_000_000 + countsArr[0].rank * 1000 + countsArr[1].rank * 10 + countsArr[2].rank;
    return { rankLevel: 4, name: 'Three of a Kind', score, bestFive: sorted };
  }

  // 3. Two Pair
  if (countsArr[0].count === 2 && countsArr[1].count === 2) {
    const score = 3_000_000 + countsArr[0].rank * 1000 + countsArr[1].rank * 100 + countsArr[2].rank;
    return { rankLevel: 3, name: 'Two Pair', score, bestFive: sorted };
  }

  // 2. One Pair
  if (countsArr[0].count === 2) {
    const score = 2_000_000 + countsArr[0].rank * 10000 + countsArr[1].rank * 1000 + countsArr[2].rank * 100 + countsArr[3].rank;
    return { rankLevel: 2, name: 'One Pair', score, bestFive: sorted };
  }

  // 1. High Card
  const score = 1_000_000 + ranks[0] * 10000 + ranks[1] * 1000 + ranks[2] * 100 + ranks[3] * 10 + ranks[4];
  return { rankLevel: 1, name: `High Card (${sorted[0].rank})`, score, bestFive: sorted };
}

// --- Teen Patti (3 Patti / Indian Poker) Hand Evaluator ---
export function evaluateTeenPattiHand(cards: Card[]): TeenPattiEvaluation {
  if (cards.length < 3) {
    return { level: 0, type: 'high_card', name: 'Incomplete Hand', score: 0 };
  }

  const sorted = [...cards.slice(0, 3)].sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
  const r = sorted.map(c => RANK_ORDER[c.rank]);
  const isFlush = sorted[0].suit === sorted[1].suit && sorted[1].suit === sorted[2].suit;
  const suitSymbol = SUIT_SYMBOLS[sorted[0].suit] || '';

  // Check Sequence / Straight
  // In Teen Patti:
  // 1. A-K-Q is the highest sequence (score: 15)
  // 2. A-2-3 is the second highest sequence (score: 14.5)
  // 3. K-Q-J down to 4-3-2 follow in standard descending order
  let isSeq = false;
  let seqRankScore = 0;
  let seqName = '';

  if (r[0] === 14 && r[1] === 13 && r[2] === 12) {
    isSeq = true;
    seqRankScore = 15;
    seqName = 'A-K-Q';
  } else if (r[0] === 14 && r[1] === 3 && r[2] === 2) {
    isSeq = true;
    seqRankScore = 14.5;
    seqName = 'A-2-3';
  } else if (r[0] - r[1] === 1 && r[1] - r[2] === 1) {
    isSeq = true;
    seqRankScore = r[0];
    seqName = `${sorted[0].rank}-${sorted[1].rank}-${sorted[2].rank}`;
  }

  // 1. Trail / Trio / Set (Three of a Kind - AAA down to 222)
  if (r[0] === r[1] && r[1] === r[2]) {
    return {
      level: 6,
      type: 'trail',
      name: `Trail of ${sorted[0].rank}s (${sorted[0].rank}-${sorted[1].rank}-${sorted[2].rank})`,
      score: 60_000_000 + r[0] * 10_000,
    };
  }

  // 2. Pure Sequence / Pakki Round (Straight Flush - same suit in sequence)
  if (isFlush && isSeq) {
    return {
      level: 5,
      type: 'pure_sequence',
      name: `Pure Sequence (${suitSymbol} ${seqName})`,
      score: 50_000_000 + Math.floor(seqRankScore * 10_000),
    };
  }

  // 3. Sequence / Normal Run (Straight - mixed suits in sequence)
  if (isSeq) {
    return {
      level: 4,
      type: 'sequence',
      name: `Sequence (${seqName})`,
      score: 40_000_000 + Math.floor(seqRankScore * 10_000),
    };
  }

  // 4. Color / Flush / Rung (3 cards of the exact SAME SUIT)
  // Strictly beats all Pairs and High Cards, regardless of rank!
  if (isFlush) {
    return {
      level: 3,
      type: 'color',
      name: `Color / Flush (${suitSymbol} ${sorted[0].rank}-${sorted[1].rank}-${sorted[2].rank})`,
      score: 30_000_000 + r[0] * 10_000 + r[1] * 100 + r[2],
    };
  }

  // 5. Pair / Double (Two cards of the same rank)
  if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) {
    let pairRank = r[0];
    let kicker = r[2];
    let pairRankStr = sorted[0].rank;
    let kickerRankStr = sorted[2].rank;

    if (r[1] === r[2]) {
      pairRank = r[1];
      kicker = r[0];
      pairRankStr = sorted[1].rank;
      kickerRankStr = sorted[0].rank;
    } else if (r[0] === r[2]) {
      pairRank = r[0];
      kicker = r[1];
      pairRankStr = sorted[0].rank;
      kickerRankStr = sorted[1].rank;
    }

    return {
      level: 2,
      type: 'pair',
      name: `Pair of ${pairRankStr}s (${kickerRankStr} Kicker)`,
      score: 20_000_000 + pairRank * 10_000 + kicker * 100,
    };
  }

  // 6. High Card (Highest individual card rank)
  return {
    level: 1,
    type: 'high_card',
    name: `High Card (${sorted[0].rank}-${sorted[1].rank}-${sorted[2].rank})`,
    score: 10_000_000 + r[0] * 10_000 + r[1] * 100 + r[2],
  };
}

export interface TeenPattiComparisonResult {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  winnerHandName: string;
  loserHandName: string;
  isTie: boolean;
  tieBrokenByCallerLoss: boolean;
  explanation: string;
}

/**
 * Compares two Teen Patti players strictly under official rules.
 * Handles hierarchy: Trail > Pure Seq > Seq > Color > Pair > High Card.
 * Handles exact ties: Official rule dictates the Showdown/Sideshow caller LOSES the tie!
 */
export function compareTeenPattiPlayers(
  pA: { id: string; name: string; cards: Card[] },
  pB: { id: string; name: string; cards: Card[] },
  callerId?: string
): TeenPattiComparisonResult {
  const evalA = evaluateTeenPattiHand(pA.cards);
  const evalB = evaluateTeenPattiHand(pB.cards);

  if (evalA.score > evalB.score) {
    return {
      winnerId: pA.id,
      loserId: pB.id,
      winnerName: pA.name,
      loserName: pB.name,
      winnerHandName: evalA.name,
      loserHandName: evalB.name,
      isTie: false,
      tieBrokenByCallerLoss: false,
      explanation: `${pA.name}'s ${evalA.name} defeats ${pB.name}'s ${evalB.name}`,
    };
  }

  if (evalB.score > evalA.score) {
    return {
      winnerId: pB.id,
      loserId: pA.id,
      winnerName: pB.name,
      loserName: pA.name,
      winnerHandName: evalB.name,
      loserHandName: evalA.name,
      isTie: false,
      tieBrokenByCallerLoss: false,
      explanation: `${pB.name}'s ${evalB.name} defeats ${pA.name}'s ${evalA.name}`,
    };
  }

  // Exact tie in ranks and evaluation score!
  // In official Teen Patti rules: The player who called the show/sideshow loses!
  if (callerId === pA.id) {
    return {
      winnerId: pB.id,
      loserId: pA.id,
      winnerName: pB.name,
      loserName: pA.name,
      winnerHandName: evalB.name,
      loserHandName: evalA.name,
      isTie: true,
      tieBrokenByCallerLoss: true,
      explanation: `Equal hands (${evalA.name})! By official Teen Patti rules, the showdown caller (${pA.name}) loses the tie.`,
    };
  }

  if (callerId === pB.id) {
    return {
      winnerId: pA.id,
      loserId: pB.id,
      winnerName: pA.name,
      loserName: pB.name,
      winnerHandName: evalA.name,
      loserHandName: evalB.name,
      isTie: true,
      tieBrokenByCallerLoss: true,
      explanation: `Equal hands (${evalB.name})! By official Teen Patti rules, the showdown caller (${pB.name}) loses the tie.`,
    };
  }

  // Forced Pot Limit Showdown with identical hands
  return {
    winnerId: pA.id,
    loserId: pB.id,
    winnerName: pA.name,
    loserName: pB.name,
    winnerHandName: evalA.name,
    loserHandName: evalB.name,
    isTie: true,
    tieBrokenByCallerLoss: false,
    explanation: `Exact Tie: Both hold ${evalA.name}!`,
  };
}
