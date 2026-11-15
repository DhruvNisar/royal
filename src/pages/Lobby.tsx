import React from 'react';
import { UserProfile, GameId, DailyQuest } from '../types';
import { soundManager } from '../services/sound';
import { storageManager } from '../services/storage';
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
} from '../assets/images';
import {
  Sparkles,
  Trophy,
  Shield,
  ArrowRight,
  Flame,
  Gift,
  Clock,
  CheckCircle2,
  Users,
  Coins,
} from 'lucide-react';

interface LobbyProps {
  profile: UserProfile;
  onSelectGame: (gameId: GameId) => void;
  onNavigate: (view: string) => void;
  onOpenDailyReward: () => void;
  canClaimDailyReward: boolean;
  onUpdateProfile: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  profile,
  onSelectGame,
  onNavigate,
  onOpenDailyReward,
  canClaimDailyReward,
  onUpdateProfile,
}) => {
  const quests = storageManager.getDailyQuests();

  const handleClaimQuest = (id: string) => {
    const res = storageManager.claimQuestReward(id);
    if (res.success) {
      soundManager.playWin();
      onUpdateProfile();
    }
  };

  const featuredGames = [
    {
      id: 'blackjack' as GameId,
      title: 'Blackjack 21',
      subtitle: 'VIP High Roller Table',
      category: 'Card Game',
      minBet: '10 coins',
      payout: 'Natural 21',
      image: gameBlackjackTableImg,
      badge: 'Popular',
    },
    {
      id: 'roulette' as GameId,
      title: 'European Roulette',
      subtitle: 'Single 0 Classic Wheel',
      category: 'Table Game',
      minBet: '10 coins',
      payout: 'Single Zero',
      image: gameRouletteWheelImg,
      badge: 'Hot Table',
    },
    {
      id: 'poker' as GameId,
      title: "Texas Hold'em",
      subtitle: 'No Limit Solo & Multiplayer',
      category: 'Poker Room',
      minBet: '20 coins',
      payout: 'Pot Based',
      image: gamePokerTableImg,
      badge: 'Multiplayer',
    },
    {
      id: 'teen_patti' as GameId,
      title: 'Teen Patti Royal',
      subtitle: '3 Patti Indian Poker',
      category: 'Card Game',
      minBet: '20 coins',
      payout: 'Pot Limit',
      image: gameTeenPattiTableImg,
      badge: 'Royal Table',
    },
    {
      id: 'slots' as GameId,
      title: 'Royal Ace Slots',
      subtitle: '5 Reels & 20 Paylines',
      category: 'Slots Arena',
      minBet: '5 coins',
      payout: 'Up to 1,000x',
      image: gameSlotsNeonImg,
      badge: 'Jackpot',
    },
    {
      id: 'plinko' as GameId,
      title: 'Royal Plinko',
      subtitle: '8–16 Peg Rows · Custom Risk',
      category: 'Arcade Game',
      minBet: '10 coins',
      payout: 'High Multipliers',
      image: gamePlinkoBoardImg,
      badge: 'New Arcade',
    },
    {
      id: 'crash' as GameId,
      title: 'Rocket Crash',
      subtitle: 'Live Curve · Cash Out Anytime',
      category: 'Arcade Game',
      minBet: '10 coins',
      payout: 'Up to 1,000x',
      image: gameCrashRocketImg,
      badge: 'New Arcade',
    },
    {
      id: 'mines' as GameId,
      title: 'Royal Mines',
      subtitle: '5×5 Vault Grid · 1–24 Mines',
      category: 'Arcade Game',
      minBet: '10 coins',
      payout: '97% RTP Gems',
      image: gameMinesVaultImg,
      badge: 'New Arcade',
    },
  ];

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 pb-20 md:pb-12">
      {/* 18+ Virtual Play Notice Top Strip */}
      <div className="bg-[#10121a] border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300/80 flex items-center justify-center gap-2">
        <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          <strong className="text-amber-300">18+ Virtual Entertainment:</strong> All coins and chips are fictional credits. No real-money gambling, deposits, or cash prizes.
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl bg-[#0f1118]">
          <div className="absolute inset-0 z-0">
            <img
              src={casinoHeroLoungeImg}
              alt="Royal Ace Casino Lounge"
              className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity filter brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08090d] via-[#08090d]/60 to-transparent" />
          </div>

          <div className="relative z-10 p-6 sm:p-10 lg:p-14 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Welcome to The Royal Ace VIP Salon</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif font-black tracking-tight text-white leading-tight">
              Elegance. Prestige. <br />
              <span className="gold-text-gradient">Pure Vegas Virtual Action.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Step onto authentic emerald green felt tables. Compete in high-stakes Blackjack 21, spin the European Roulette wheel, bluff through Texas Hold'em, or trigger free spins on Royal Slots.
            </p>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  onSelectGame('blackjack');
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-xl shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
              >
                <span>Play Blackjack 21</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  onNavigate('multiplayer');
                }}
                className="px-6 py-3 rounded-xl bg-[#161922] hover:bg-[#202533] border border-amber-500/30 text-amber-300 font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Multiplayer Rooms</span>
              </button>
            </div>
          </div>
        </div>

        {/* Daily Reward Notification Banner (if claimable) */}
        {canClaimDailyReward && (
          <div className="bg-gradient-to-r from-amber-950/80 via-[#261e08]/90 to-amber-950/80 border border-amber-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="font-serif font-bold text-amber-300 text-base sm:text-lg">
                  Daily VIP Reward Ready to Claim!
                </div>
                <div className="text-xs text-amber-200/80">
                  Keep your 7-day streak active to earn up to +2,500 complimentary virtual chips.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                onOpenDailyReward();
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider shrink-0 transition-transform active:scale-95 shadow-md shadow-amber-500/30"
            >
              Claim Bonus Now
            </button>
          </div>
        )}

        {/* Featured Casino Games */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-100">Featured Casino Tables</h2>
              <p className="text-xs text-slate-400 mt-0.5">Authentic virtual gaming rules with zero lag</p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                onNavigate('games');
              }}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>View All 10 Games</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {featuredGames.map(game => (
              <div
                key={game.id}
                onClick={() => {
                  soundManager.playButtonClick();
                  onSelectGame(game.id);
                }}
                className="group relative rounded-2xl bg-[#12141c] hover:bg-[#181a24] border border-slate-800 hover:border-amber-500/50 transition-all duration-300 cursor-pointer overflow-hidden shadow-lg flex flex-col justify-between"
              >
                {/* Image Showcase */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12141c] via-transparent to-transparent" />
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                    {game.badge}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-semibold tracking-wider text-amber-400/80 uppercase">
                      {game.category}
                    </span>
                    <h3 className="font-serif font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{game.subtitle}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>Min: </span>
                      <span className="text-slate-200 font-semibold">{game.minBet}</span>
                    </div>
                    <div>
                      <span className="text-amber-300 font-medium">{game.payout}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2 rounded-xl bg-slate-800/80 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-200 font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Play Table</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Challenges & Quests Strip */}
        <div className="bg-[#12141c] rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-serif font-bold text-base text-slate-100">Daily Casino Challenges</h3>
            </div>
            <span className="text-xs text-slate-400">Refreshes every 24 hours</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quests.map(q => (
              <div
                key={q.id}
                className="p-3.5 rounded-xl bg-[#171a24] border border-slate-800/80 flex items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-slate-200">{q.title}</div>
                  <div className="text-[11px] text-slate-400">{q.description}</div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                    <span>Progress: {q.progress}/{q.target}</span>
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  {q.claimed ? (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Claimed
                    </span>
                  ) : q.completed ? (
                    <button
                      type="button"
                      onClick={() => handleClaimQuest(q.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow transition-transform active:scale-95"
                    >
                      +{q.rewardCoins}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-mono text-xs">
                      +{q.rewardCoins}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
