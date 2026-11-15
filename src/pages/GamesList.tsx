import React, { useState } from 'react';
import { GameId, GameCategory } from '../types';
import { soundManager } from '../services/sound';
import { Search, ArrowRight, Dices, Layers, Shield } from 'lucide-react';
import {
  casinoHeroLoungeImg,
  gameBlackjackTableImg,
  gamePokerTableImg,
  gameRouletteWheelImg,
  gameSlotsNeonImg,
  gameTeenPattiTableImg,
  gamePlinkoBoardImg,
  gameCrashRocketImg,
  gameMinesVaultImg,
  gameKenoBoardImg,
  gameHiLoTableImg,
} from '../assets/images';

interface GamesListProps {
  onSelectGame: (gameId: GameId) => void;
  onNavigateToMultiplayer: () => void;
  selectedCategory?: GameCategory;
  onSelectCategory?: (category: GameCategory) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

interface GameCardItem {
  id: GameId;
  title: string;
  category: 'cards' | 'table' | 'dice' | 'arcade' | 'multiplayer';
  categoryLabel: string;
  description: string;
  minBet: number;
  maxBet: number;
  rulesHighlight: string;
  image: string;
  isMultiplayerCapable?: boolean;
}

const ALL_GAMES: GameCardItem[] = [
  {
    id: 'blackjack',
    title: 'Blackjack 21',
    category: 'cards',
    categoryLabel: 'Card Game',
    description: 'Beat the dealer to 21 with standard Las Vegas rules. Features Double Down, Pair Splits, and Insurance.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: 'Natural 21 bonus · Dealer stands on 17',
    image: gameBlackjackTableImg,
    isMultiplayerCapable: true,
  },
  {
    id: 'roulette',
    title: 'European Roulette',
    category: 'table',
    categoryLabel: 'Table Game',
    description: 'Authentic 37-pocket single zero roulette. Bet on straight numbers, red/black, dozens, columns, and outside zones.',
    minBet: 10,
    maxBet: 10000,
    rulesHighlight: 'European Single 0 · Inside & Outside wagers',
    image: gameRouletteWheelImg,
  },
  {
    id: 'poker',
    title: "Texas Hold'em Poker",
    category: 'cards',
    categoryLabel: 'Card Game',
    description: 'No Limit Hold\'em against intelligent AI opponents with Beginner, Balanced, and Aggressive personalities or online players.',
    minBet: 20,
    maxBet: 10000,
    rulesHighlight: 'Full 5-Card Hand Evaluation · Solo & Multiplayer Rooms',
    image: gamePokerTableImg,
    isMultiplayerCapable: true,
  },
  {
    id: 'teen_patti',
    title: 'Teen Patti Royal',
    category: 'cards',
    categoryLabel: 'Card Game',
    description: 'Authentic 3-card Indian poker. Play Blind or Seen, request Sideshows, manage Pot Limits, and battle for the royal pot.',
    minBet: 20,
    maxBet: 10000,
    rulesHighlight: 'Trail, Pure Sequence & Color · Blind (1x) vs Chaal (2x)',
    image: gameTeenPattiTableImg,
    isMultiplayerCapable: true,
  },
  {
    id: 'baccarat',
    title: 'VIP Baccarat (Punto Banco)',
    category: 'table',
    categoryLabel: 'Table Game',
    description: 'Classic high-roller salon card game. Wager on Player, Banker, or Tie with official third-card tableau drawing rules.',
    minBet: 25,
    maxBet: 15000,
    rulesHighlight: 'Natural 8/9 wins · Banker, Player & Tie bets',
    image: gameBlackjackTableImg,
  },
  {
    id: 'dice',
    title: 'Dice Arena',
    category: 'dice',
    categoryLabel: 'Dice Game',
    description: 'Roll two 6-sided dice and predict sums. Wager on Over 7, Under 7, Lucky 7, Doubles, and exact sum combinations.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: 'Multipliers up to 30.0x on Snake Eyes (2) and 12',
    image: casinoHeroLoungeImg,
  },
  {
    id: 'slots',
    title: 'Royal Ace Slots',
    category: 'table',
    categoryLabel: 'Slots Arena',
    description: '5 animated reels and 20 paylines. Hit Royal Crown Wilds and Gold Scatters to trigger 10 Free Spins with 2x Multiplier.',
    minBet: 5,
    maxBet: 1000,
    rulesHighlight: 'Scatter Free Spins · 20 Active Paylines · Wild Crowns',
    image: gameSlotsNeonImg,
  },
  {
    id: 'plinko',
    title: 'Royal Plinko',
    category: 'arcade',
    categoryLabel: 'Arcade Game',
    description: 'Drop virtual coins down a golden peg pyramid. Customize 8–16 rows and Low, Medium, or High risk for big edge multipliers.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: '8–16 Peg Rows · Low/Medium/High Risk · Auto-Drop Mode',
    image: gamePlinkoBoardImg,
  },
  {
    id: 'crash',
    title: 'Rocket Crash',
    category: 'arcade',
    categoryLabel: 'Arcade Game',
    description: 'Ride an ascending multiplier curve in real time and cash out before the rocket crashes. Supports manual and auto cash-out.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: 'Real-Time Multiplier · Manual & Auto Cash-Out · Up to 1,000x',
    image: gameCrashRocketImg,
  },
  {
    id: 'mines',
    title: 'Royal Mines',
    category: 'arcade',
    categoryLabel: 'Arcade Game',
    description: 'Find hidden diamonds, avoid dangerous mines and cash out before your luck runs out.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: '5×5 Vault Grid · 1–24 Mines · 97% Theoretical RTP',
    image: gameMinesVaultImg,
  },
  {
    id: 'keno',
    title: 'Royal Keno',
    category: 'arcade',
    categoryLabel: 'Arcade Game',
    description: 'Pick 1 to 10 lucky numbers on an 80-ball board. 20 balls drawn with exact hypergeometric ~97% RTP payouts up to 60,000x.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: '80 Numbers · 20 Draws · Hypergeometric 97% RTP · Auto Play',
    image: gameKenoBoardImg,
  },
  {
    id: 'hilo',
    title: 'Royal Hi-Lo',
    category: 'cards',
    categoryLabel: 'Card Game',
    description: 'Predict whether the next card dealt will be Higher or Lower. Real-time dynamic odds, Aces high, same-rank push, and instant cash out.',
    minBet: 10,
    maxBet: 5000,
    rulesHighlight: '52-Card Deck · Real-Time Odds · Aces High · 97% RTP',
    image: gameHiLoTableImg,
  },
];

export const GamesList: React.FC<GamesListProps> = ({
  onSelectGame,
  onNavigateToMultiplayer,
  selectedCategory: controlledCategory,
  onSelectCategory,
  searchQuery: controlledSearchQuery,
  onSearchChange,
}) => {
  const [internalCategory, setInternalCategory] = useState<GameCategory>('all');
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');

  const selectedCategory = controlledCategory ?? internalCategory;
  const setSelectedCategory = onSelectCategory ?? setInternalCategory;
  const searchQuery = controlledSearchQuery ?? internalSearchQuery;
  const setSearchQuery = onSearchChange ?? setInternalSearchQuery;

  const filteredGames = ALL_GAMES.filter(game => {
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'multiplayer' ? game.isMultiplayerCapable : game.category === selectedCategory);

    const matchesSearch =
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 pb-20 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-100">Casino Gaming Suite</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select a virtual table to begin playing. Single-player against AI or multiplayer rooms.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search games, tables, or rules..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#13151f] border border-slate-800 focus:border-amber-500/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all' as GameCategory, label: 'All Games' },
            { id: 'cards' as GameCategory, label: 'Card Games' },
            { id: 'table' as GameCategory, label: 'Table Games' },
            { id: 'dice' as GameCategory, label: 'Dice Games' },
            { id: 'arcade' as GameCategory, label: 'Arcade Games' },
            { id: 'multiplayer' as GameCategory, label: 'Multiplayer' },
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setSelectedCategory(cat.id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#12141c] hover:bg-[#1a1d27] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Game Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map(game => (
            <div
              key={game.id}
              className="group bg-[#12141c] hover:bg-[#161822] border border-slate-800 hover:border-amber-500/40 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12141c] via-transparent to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-amber-500/40 text-[10px] font-bold text-amber-300 uppercase">
                  {game.categoryLabel}
                </span>
                {game.isMultiplayerCapable ? (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 uppercase">
                    Live Rooms
                  </span>
                ) : (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-slate-900/85 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 uppercase">
                    Single-Player
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-100 group-hover:text-amber-300 transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{game.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] text-amber-300/90 font-medium">
                    {game.rulesHighlight}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>Stakes: </span>
                      <span className="text-slate-200 font-semibold">{game.minBet} - {game.maxBet.toLocaleString()} coins</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        onSelectGame(game.id);
                      }}
                      className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md shadow-amber-500/20 active:scale-95"
                    >
                      <span>Play Solo (AI)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {game.isMultiplayerCapable && (
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playButtonClick();
                          onNavigateToMultiplayer();
                        }}
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Multiplayer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
