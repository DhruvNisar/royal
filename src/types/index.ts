export type ChipDenomination = 10 | 25 | 50 | 100 | 500 | 1000;

export const CHIP_DENOMINATIONS: ChipDenomination[] = [10, 25, 50, 100, 500, 1000];

export const CHIP_COLORS: Record<ChipDenomination, { bg: string; border: string; text: string; stripe: string }> = {
  10: { bg: '#1e3a8a', border: '#60a5fa', text: '#ffffff', stripe: '#93c5fd' },     // Blue
  25: { bg: '#065f46', border: '#34d399', text: '#ffffff', stripe: '#a7f3d0' },     // Green
  50: { bg: '#991b1b', border: '#f87171', text: '#ffffff', stripe: '#fca5a5' },     // Red
  100: { bg: '#111827', border: '#d4af37', text: '#fde047', stripe: '#facc15' },   // Black / Gold
  500: { bg: '#581c87', border: '#c084fc', text: '#ffffff', stripe: '#e9d5ff' },    // Purple
  1000: { bg: '#854d0e', border: '#fde047', text: '#ffffff', stripe: '#fef08a' },  // Gold / Bronze
};

export type GameId = 'blackjack' | 'roulette' | 'poker' | 'baccarat' | 'dice' | 'slots' | 'teen_patti' | 'plinko' | 'crash' | 'mines' | 'keno' | 'hilo' | 'horse_racing' | 'bingo' | 'deal_no_deal';

export type GameCategory = 'all' | 'cards' | 'table' | 'dice' | 'arcade' | 'multiplayer';

export type TransactionType = 'bet' | 'win' | 'daily_reward' | 'quest' | 'reload' | 'split_bet' | 'insurance';

export interface WalletTransaction {
  id: string;
  timestamp: number;
  type: TransactionType;
  game: GameId | 'system';
  amount: number;
  balanceAfter: number;
  description: string;
}

export interface DailyRewardDay {
  day: number;
  coins: number;
}

export const DAILY_REWARD_SCHEDULE: DailyRewardDay[] = [
  { day: 1, coins: 250 },
  { day: 2, coins: 400 },
  { day: 3, coins: 500 },
  { day: 4, coins: 750 },
  { day: 5, coins: 1000 },
  { day: 6, coins: 1500 },
  { day: 7, coins: 2500 },
];

export interface DailyRewardState {
  currentDay: number;
  lastClaimDateString: string | null; // 'YYYY-MM-DD'
  claimHistory: { date: string; day: number; coins: number }[];
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  totalWon: number;
  totalWagered: number;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  iconName: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  gameId: GameId;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export interface SoundSettings {
  masterVolume: number; // 0 to 1
  sfxEnabled: boolean;
  musicEnabled: boolean;
}

/* Card Types */
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
  isHidden?: boolean;
}

/* Blackjack */
export interface BlackjackHand {
  cards: Card[];
  bet: number;
  isStood: boolean;
  isBust: boolean;
  isBlackjack: boolean;
  isDoubled: boolean;
  outcome?: 'win' | 'loss' | 'push' | 'blackjack' | 'bust';
  payout?: number;
}

/* Roulette */
export type RouletteBetType =
  | 'straight'
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high'
  | 'dozen1'
  | 'dozen2'
  | 'dozen3'
  | 'col1'
  | 'col2'
  | 'col3';

export interface RoulettePlacedBet {
  id: string;
  type: RouletteBetType;
  number?: number; // for straight bets (0-36)
  amount: number;
}

export interface RouletteHistoryItem {
  number: number;
  color: 'red' | 'black' | 'green';
}

/* Poker */
export type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type AiPersonality = 'beginner' | 'balanced' | 'experienced' | 'aggressive';

export interface PokerPlayer {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  currentBet: number;
  cards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  isAi: boolean;
  personality?: AiPersonality;
  handDescription?: string;
  handScore?: number;
}

/* Baccarat */
export type BaccaratBetChoice = 'player' | 'banker' | 'tie' | 'player_pair' | 'banker_pair';

export interface BaccaratHistoryItem {
  id: string;
  winner: 'player' | 'banker' | 'tie';
  playerScore: number;
  bankerScore: number;
  playerPair: boolean;
  bankerPair: boolean;
}

/* Dice */
export type DiceBetType = 'over' | 'under' | 'lucky7' | 'exact' | 'doubles';

export interface DicePlacedBet {
  type: DiceBetType;
  exactNumber?: number; // 2-12
  amount: number;
  multiplier: number;
}

export interface DiceRollResult {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
}

/* Slots */
export interface SlotSymbol {
  id: string;
  name: string;
  payout3: number;
  payout4: number;
  payout5: number;
  isWild?: boolean;
  isScatter?: boolean;
  color: string;
  icon: string;
}

/* Multiplayer */
export interface MultiplayerPlayer {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  isHost: boolean;
  isReady: boolean;
  lastActive: number;
}

export interface MultiplayerRoom {
  id: string;
  code: string;
  name: string;
  gameId: 'poker' | 'blackjack';
  hostId: string;
  isPrivate: boolean;
  minBet: number;
  maxPlayers: number;
  players: MultiplayerPlayer[];
  status: 'waiting' | 'in_game' | 'finished';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

/* Teen Patti (3 Patti / Indian Poker) */
export type TeenPattiHandRankType =
  | 'trail'           // Trio / Three of a Kind (AAA down to 222)
  | 'pure_sequence'  // Straight Flush (A-K-Q, A-2-3 down to 4-3-2 suited)
  | 'sequence'       // Straight / Normal Run (A-K-Q, A-2-3 down to 4-3-2)
  | 'color'          // Flush (same suit)
  | 'pair'           // Pair
  | 'high_card';     // High Card

export interface TeenPattiPlayer {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  currentRoundBet: number;
  totalHandBet: number;
  cards: Card[];
  isFolded: boolean;
  isSeen: boolean;
  isAi: boolean;
  blindTurnsCount: number;
  personality?: 'beginner' | 'balanced' | 'aggressive';
  handRankName?: string;
  handRankLevel?: number;
  handScore?: number;
}

export interface TeenPattiEvaluation {
  level: number; // 6 (Trail) down to 1 (High Card)
  type: TeenPattiHandRankType;
  name: string;
  score: number;
}

/* Plinko */
export type PlinkoRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type PlinkoRowCount = 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export interface PlinkoRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  rows: PlinkoRowCount;
  risk: PlinkoRiskLevel;
  slotIndex: number;
  multiplier: number;
  payout: number;
  net: number;
}

/* Crash */
export type CrashRoundState = 'READY' | 'RUNNING' | 'CASHED_OUT' | 'CRASHED';

export interface CrashRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  finalCrashMultiplier: number;
  cashOutMultiplier: number | null;
  payout: number;
  net: number;
  outcome: 'CASHED_OUT' | 'CRASHED';
}

/* Royal Mines */
export type MinesGameState = 'READY' | 'PLAYING' | 'CASHED_OUT' | 'LOST' | 'WON';
export type MinesRiskTier = 'Low' | 'Medium' | 'High' | 'Extreme';

export interface MinesRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  mineCount: number;
  safeRevealed: number;
  multiplier: number;
  payout: number;
  net: number;
  outcome: 'CASHED_OUT' | 'WON' | 'LOST';
}

/* Royal Keno */
export type KenoGameState = 'IDLE' | 'READY' | 'DRAWING' | 'SETTLED' | 'ROUND_OVER';

export interface KenoRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  selectedNumbers: number[];
  drawnNumbers: number[];
  matchedNumbers: number[];
  matchesCount: number;
  multiplier: number;
  payout: number;
  net: number;
  isWin: boolean;
}

export interface KenoStats {
  roundsPlayed: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  winningRounds: number;
  losingRounds: number;
  bestWin: number;
  winRate: number;
}

/* Royal Hi-Lo */
export type HiLoSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type HiLoRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type HiLoRankSymbol = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface HiLoCard {
  id: string; // e.g. "hearts_14"
  suit: HiLoSuit;
  rank: HiLoRank;
  symbol: HiLoRankSymbol;
  color: 'red' | 'black';
}

export type HiLoPrediction = 'HIGHER' | 'LOWER';
export type HiLoOutcome = 'WIN' | 'LOSS' | 'PUSH';

export interface HiLoStepResult {
  stepIndex: number;
  prevCard: HiLoCard;
  prediction: HiLoPrediction;
  revealedCard: HiLoCard;
  outcome: HiLoOutcome;
  stepMultiplier: number;
  probability: number;
}

export type HiLoGameState = 'BETTING' | 'PREDICTING' | 'REVEALING' | 'ROUND_WON' | 'ROUND_LOST' | 'CASHED_OUT';

export interface HiLoRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  initialCard: HiLoCard;
  finalCard: HiLoCard;
  cardsRevealed: HiLoCard[];
  steps: HiLoStepResult[];
  correctStreak: number;
  finalMultiplier: number;
  payout: number;
  net: number;
  outcome: 'CASHED_OUT' | 'LOST' | 'PUSH';
}

export interface HiLoStats {
  roundsPlayed: number;
  totalWagered: number;
  totalReturned: number;
  netProfit: number;
  winningRounds: number;
  losingRounds: number;
  pushesCount: number;
  highestMultiplier: number;
  longestStreak: number;
  winRate: number;
}

/* Royal Horse Racing */
export type HorseBetType = 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'QUINELLA' | 'TRIFECTA';

export type HorseRacePhase = 'BETTING' | 'COUNTDOWN' | 'RACING' | 'FINISHED';

export interface HorseRunner {
  number: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  silkPrimary: string;
  silkSecondary: string;
  coatColor: string;
  maneColor: string;
  strengthWeight: number;
  rating: number; // 1..100 display rating
  winProbability: number;
  winMultiplier: number;
  placeMultiplier: number;
  showMultiplier: number;
}

export interface HorseRaceBet {
  type: HorseBetType;
  selections: number[]; // Horse numbers (1..6)
  amount: number;
  probability: number;
  multiplier: number;
  potentialPayout: number;
  potentialNet: number;
}

export interface HorseRaceResult {
  id: string;
  raceNumber: number;
  raceTitle: string;
  timestamp: number;
  horses: { number: number; name: string; silkPrimary: string }[];
  finishOrder: number[]; // Array of 6 horse numbers from 1st to 6th
  betType: HorseBetType;
  selections: number[];
  betAmount: number;
  multiplier: number;
  payout: number;
  net: number;
  isWin: boolean;
}

export interface HorseRaceStats {
  racesPlayed: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  wins: number;
  losses: number;
  winRate: number;
  bestPayout: number;
}

/* Royal Bingo (90-Ball) */
export type BingoPhase = 'SETUP' | 'DRAWING' | 'FINISHED';

export type BingoMilestoneId = 'ONE_LINE' | 'TWO_LINES' | 'FULL_HOUSE';

export type BingoTicketCell = number | null;
export type BingoTicketGrid = BingoTicketCell[][]; // 3 rows x 9 columns

export interface BingoMilestoneOutcome {
  id: BingoMilestoneId;
  label: string;
  targetCalls: number;
  multiplier: number;
  achievedAtCall: number | null;
  earned: boolean;
  reward: number;
}

export interface BingoRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  ticketNumbers: number[];
  totalCallsMade: number;
  oneLine: { achievedAtCall: number | null; earned: boolean; reward: number };
  twoLines: { achievedAtCall: number | null; earned: boolean; reward: number };
  fullHouse: { achievedAtCall: number | null; earned: boolean; reward: number };
  totalReward: number;
  net: number;
  isWin: boolean;
}

export interface BingoStats {
  roundsPlayed: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  oneLineWins: number;
  twoLinesWins: number;
  fullHouseWins: number;
  bestReward: number;
  winRate: number;
}

/* Royal Deal or No Deal */
export type DealNoDealState =
  | 'BETTING'
  | 'BRIEFCASE_SELECTION'
  | 'OPENING_CASES'
  | 'CASE_REVEAL'
  | 'BANKER_CALL'
  | 'BANKER_OFFER'
  | 'DEAL_CONFIRMATION'
  | 'NO_DEAL_RESPONSE'
  | 'FINAL_DECISION'
  | 'FINAL_REVEAL'
  | 'SETTLED';

export interface DealBriefcase {
  caseNumber: number; // 1..26
  multiplier: number;
  isOpened: boolean;
  isPlayerCase: boolean;
}

export interface BankerOfferSnapshot {
  roundNumber: number;
  remainingCasesCount: number;
  averageRemainingMultiplier: number;
  bankerPercentage: number;
  offerMultiplier: number;
  offerCoins: number;
  lowestRemainingMultiplier: number;
  highestRemainingMultiplier: number;
  decision?: 'DEAL' | 'NO_DEAL';
}

export type DealFinalChoice = 'DEAL' | 'KEEP' | 'SWAP';

export interface DealNoDealRoundResult {
  id: string;
  timestamp: number;
  bet: number;
  originalCaseNumber: number;
  originalCaseMultiplier: number;
  finalCaseNumber: number | null;
  casesOpenedCount: number;
  offersReceived: BankerOfferSnapshot[];
  acceptedOffer: BankerOfferSnapshot | null;
  finalChoice: DealFinalChoice;
  finalMultiplier: number;
  grossPayout: number;
  netProfit: number;
}

export interface DealNoDealStats {
  gamesPlayed: number;
  totalWagered: number;
  totalGrossWon: number;
  totalNetProfit: number;
  dealsAccepted: number;
  dealsRejected: number;
  biggestPayout: number;
  highestMultiplierWon: number;
}



