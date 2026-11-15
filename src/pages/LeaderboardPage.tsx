import React, { useState } from 'react';
import { UserProfile } from '../types';
import { soundManager } from '../services/sound';
import { Trophy, Medal, Crown, Star, Flame, Users } from 'lucide-react';

interface LeaderboardPageProps {
  profile: UserProfile;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  coinsWon: number;
  level: number;
  tier: string;
  winRate: number;
  isCurrentUser?: boolean;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ profile }) => {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'allTime'>('weekly');

  // Realistic leaderboard data based on timeframe with user injected at appropriate rank
  const generateLeaderboard = (): LeaderboardEntry[] => {
    const userCoins = profile.totalWon;
    const baseRoster = [
      { name: 'VegasTycoon_88', avatar: '👑', coinsWon: 245000, level: 24, tier: 'Royal Ace Elite', winRate: 64 },
      { name: 'MonteCarloKing', avatar: '💎', coinsWon: 182000, level: 19, tier: 'Platinum VIP', winRate: 58 },
      { name: 'DiamondDuchess', avatar: '🦁', coinsWon: 145000, level: 16, tier: 'Platinum VIP', winRate: 55 },
      { name: 'HighStakesSam', avatar: '♠', coinsWon: 98000, level: 14, tier: 'Gold VIP', winRate: 52 },
      { name: 'RouletteRider', avatar: '🔥', coinsWon: 74000, level: 12, tier: 'Gold VIP', winRate: 50 },
      { name: 'AceDealt_21', avatar: '⭐', coinsWon: 52000, level: 9, tier: 'Gold VIP', winRate: 48 },
      { name: 'LadyLuckPro', avatar: '👑', coinsWon: 38000, level: 7, tier: 'Silver VIP', winRate: 46 },
      { name: 'ChipCollector', avatar: '🦁', coinsWon: 22000, level: 5, tier: 'Silver VIP', winRate: 44 },
    ];

    const userEntry: LeaderboardEntry = {
      rank: 0,
      name: `${profile.username} (You)`,
      avatar: profile.avatar === 'crown' ? '👑' : profile.avatar === 'lion' ? '🦁' : profile.avatar === 'diamond' ? '💎' : '♠',
      coinsWon: userCoins,
      level: profile.level,
      tier: profile.level >= 15 ? 'Royal Ace Elite' : profile.level >= 10 ? 'Platinum VIP' : profile.level >= 6 ? 'Gold VIP' : 'Silver VIP',
      winRate: profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0,
      isCurrentUser: true,
    };

    const combined = [...baseRoster, userEntry].sort((a, b) => b.coinsWon - a.coinsWon);
    return combined.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  };

  const list = generateLeaderboard();
  const userRank = list.find(e => e.isCurrentUser)?.rank || 1;

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 pb-20 md:pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-100 flex items-center gap-2.5">
              <Trophy className="w-7 h-7 text-amber-400" />
              <span>Royal High Roller Leaderboard</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Top virtual casino winners ranked by total coins won across all table games.
            </p>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center gap-1 bg-[#13151f] p-1 rounded-xl border border-slate-800">
            {(['daily', 'weekly', 'allTime'] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  setTimeframe(tf);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                  timeframe === tf
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf === 'allTime' ? 'All-Time' : tf}
              </button>
            ))}
          </div>
        </div>

        {/* User Rank Callout */}
        <div className="bg-gradient-to-r from-amber-950/60 via-[#1e1b10] to-amber-950/60 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center font-serif font-black text-amber-300 text-base">
              #{userRank}
            </div>
            <div>
              <div className="text-xs text-amber-300 font-semibold uppercase tracking-wide">Your Standing</div>
              <div className="text-sm font-bold text-slate-100">{profile.username}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Total Coins Won</div>
            <div className="font-serif font-black text-amber-300 text-base sm:text-lg tabular-nums">
              {profile.totalWon.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Podium Top 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {list.slice(0, 3).map((entry, idx) => {
            const podiumOrder = idx === 0 ? 'sm:order-2 scale-105' : idx === 1 ? 'sm:order-1' : 'sm:order-3';
            const colors =
              idx === 0
                ? 'border-amber-400 bg-amber-950/30'
                : idx === 1
                ? 'border-slate-400 bg-slate-900/60'
                : 'border-amber-700 bg-amber-950/20';

            return (
              <div
                key={entry.name}
                className={`p-5 rounded-2xl border ${colors} shadow-xl flex flex-col items-center text-center space-y-3 transition-transform ${podiumOrder}`}
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-black/60 border border-slate-700 flex items-center justify-center text-3xl">
                    {entry.avatar}
                  </div>
                  <div
                    className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center font-serif font-black text-xs text-slate-950 shadow-md ${
                      idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-amber-600'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                </div>

                <div>
                  <h3 className="font-serif font-bold text-base text-slate-100">{entry.name}</h3>
                  <p className="text-xs text-amber-400/80 font-medium">{entry.tier}</p>
                </div>

                <div className="w-full pt-2 border-t border-slate-800 space-y-1">
                  <div className="font-serif font-black text-lg text-amber-300 tabular-nums">
                    {entry.coinsWon.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">Win Rate: {entry.winRate}%</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ranks 4+ Table */}
        <div className="bg-[#12141c] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] bg-[#0f1118]">
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">VIP Tier</th>
                  <th className="py-3 px-4 text-center">Win Rate</th>
                  <th className="py-3 px-4 text-right">Coins Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {list.slice(3).map(entry => (
                  <tr
                    key={entry.name}
                    className={`transition-colors ${
                      entry.isCurrentUser ? 'bg-amber-500/10 font-bold' : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-300">#{entry.rank}</td>
                    <td className="py-3 px-4 flex items-center gap-2 font-sans">
                      <span className="text-base">{entry.avatar}</span>
                      <span className={entry.isCurrentUser ? 'text-amber-300' : 'text-slate-200'}>
                        {entry.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">{entry.tier}</td>
                    <td className="py-3 px-4 text-center text-slate-300">{entry.winRate}%</td>
                    <td className="py-3 px-4 text-right font-serif font-bold text-amber-300 tabular-nums">
                      {entry.coinsWon.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
