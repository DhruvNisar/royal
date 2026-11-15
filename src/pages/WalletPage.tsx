import React, { useState } from 'react';
import { UserProfile, DAILY_REWARD_SCHEDULE, WalletTransaction } from '../types';
import { storageManager } from '../services/storage';
import { soundManager } from '../services/sound';
import { CoinCelebration } from '../components/common/CoinCelebration';
import {
  Wallet,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  Shield,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface WalletPageProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({ profile, onUpdateProfile }) => {
  const transactions = storageManager.getTransactions();
  const rewardState = storageManager.getDailyRewardState();
  const { canClaim, nextDay, hoursRemaining } = storageManager.canClaimDailyReward();
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<boolean>(false);

  const handleClaim = () => {
    const res = storageManager.claimDailyReward();
    if (res.success) {
      soundManager.playWin();
      setCelebrate(true);
      setClaimMessage(res.message);
      onUpdateProfile();
    }
  };

  const handleEmergencyReload = () => {
    const res = storageManager.claimEmergencyReload();
    if (res.success) {
      soundManager.playWin();
      setCelebrate(true);
      setClaimMessage(res.message);
      onUpdateProfile();
    }
  };

  const netReturn = profile.totalWon - profile.totalWagered;

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 pb-20 md:pb-12">
      <CoinCelebration active={celebrate} onComplete={() => setCelebrate(false)} />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-100">Virtual Casino Bankroll</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Manage your fictional virtual credits, claim daily streak bonuses, and view your transaction history.
            </p>
          </div>

          {/* Emergency reload button if balance < 50 */}
          {profile.coins < 50 && (
            <button
              type="button"
              onClick={handleEmergencyReload}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
            >
              +1,000 Emergency Courtesy Reload
            </button>
          )}
        </div>

        {/* Bankroll Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1b1e2a] to-[#12141c] border border-amber-500/30 shadow-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Current Bankroll</span>
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div className="font-serif font-black text-2xl sm:text-3xl text-amber-300 tabular-nums">
              {profile.coins.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-400/80">Virtual Entertainment Coins</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#12141c] border border-slate-800 shadow-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Total Won</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-serif font-black text-2xl sm:text-3xl text-emerald-400 tabular-nums">
              {profile.totalWon.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Lifetime winnings awarded</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#12141c] border border-slate-800 shadow-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Total Wagered</span>
              <ArrowUpRight className="w-4 h-4 text-red-400" />
            </div>
            <div className="font-serif font-black text-2xl sm:text-3xl text-slate-200 tabular-nums">
              {profile.totalWagered.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Cumulative bets placed</div>
          </div>

          <div className="p-5 rounded-2xl bg-[#12141c] border border-slate-800 shadow-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <span>Net Performance</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div
              className={`font-serif font-black text-2xl sm:text-3xl tabular-nums ${
                netReturn >= 0 ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {netReturn >= 0 ? `+${netReturn.toLocaleString()}` : netReturn.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">VIP Level {profile.level} ({profile.xp} XP)</div>
          </div>
        </div>

        {/* 7-Day Daily Rewards Calendar */}
        <div className="bg-[#12141c] rounded-2xl border border-slate-800 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Gift className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="font-serif font-bold text-lg text-slate-100">7-Day VIP Daily Bonus Streak</h2>
                <p className="text-xs text-slate-400">Log in and claim each day to escalate your rewards</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canClaim ? (
                <button
                  type="button"
                  onClick={handleClaim}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
                >
                  Claim Day {nextDay} (+{DAILY_REWARD_SCHEDULE[nextDay - 1]?.coins.toLocaleString()} Coins)
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/80 text-slate-400 text-xs font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Next claim in ~{hoursRemaining}h</span>
                </div>
              )}
            </div>
          </div>

          {claimMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              {claimMessage}
            </div>
          )}

          {/* 7-Day Visual Progression Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {DAILY_REWARD_SCHEDULE.map(item => {
              const isPast = rewardState.currentDay > item.day;
              const isCurrent = rewardState.currentDay === item.day;

              return (
                <div
                  key={item.day}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
                    isCurrent
                      ? canClaim
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-lg'
                        : 'bg-[#181a24] border-amber-500/40 text-amber-300'
                      : isPast
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-60'
                      : 'bg-[#151722] border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Day {item.day}
                  </span>
                  <div className="my-2">
                    <Sparkles
                      className={`w-5 h-5 mx-auto ${
                        item.day === 7 ? 'text-amber-300 animate-bounce' : 'text-amber-400'
                      }`}
                    />
                  </div>
                  <div className="font-serif font-black text-sm text-amber-300 tabular-nums">
                    +{item.coins.toLocaleString()}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1">
                    {isPast ? 'Claimed' : isCurrent ? (canClaim ? 'Ready!' : 'Today') : 'Upcoming'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Immutable Transaction Ledger */}
        <div className="bg-[#12141c] rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-lg text-slate-100">Transaction History Ledger</h2>
            <span className="text-xs text-slate-400">Last {transactions.length} records</span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              No transactions recorded yet. Place bets or claim daily rewards to populate the ledger.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Activity / Game</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {transactions.slice(0, 20).map(tx => {
                    const isCredit = ['win', 'daily_reward', 'quest', 'reload'].includes(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 font-sans">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                          {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                              isCredit ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 font-sans">{tx.description}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                            isCredit ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isCredit ? `+${tx.amount.toLocaleString()}` : `-${tx.amount.toLocaleString()}`}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300 tabular-nums">
                          {tx.balanceAfter.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
