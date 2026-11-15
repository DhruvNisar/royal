import React, { useState } from 'react';
import { UserProfile, Achievement } from '../types';
import { storageManager } from '../services/storage';
import { soundManager } from '../services/sound';
import { CoinCelebration } from '../components/common/CoinCelebration';
import {
  User,
  Crown,
  Trophy,
  Award,
  Zap,
  Target,
  Flame,
  ShieldCheck,
  CheckCircle2,
  Edit2,
  Check,
} from 'lucide-react';

interface ProfilePageProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
}

const AVATAR_OPTIONS = [
  { id: 'crown', label: 'Crown', icon: '👑' },
  { id: 'lion', label: 'Lion', icon: '🦁' },
  { id: 'diamond', label: 'Diamond', icon: '💎' },
  { id: 'spade', label: 'Ace Spade', icon: '♠' },
  { id: 'star', label: 'Gold Star', icon: '⭐' },
  { id: 'fire', label: 'Flame', icon: '🔥' },
];

export const ProfilePage: React.FC<ProfilePageProps> = ({ profile, onUpdateProfile }) => {
  const achievements = storageManager.getAchievements();
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [usernameInput, setUsernameInput] = useState<string>(profile.username);
  const [celebrate, setCelebrate] = useState<boolean>(false);

  const handleSaveUsername = () => {
    if (!usernameInput.trim()) return;
    storageManager.updateProfile({ username: usernameInput.trim() });
    setIsEditingName(false);
    soundManager.playButtonClick();
    onUpdateProfile();
  };

  const handleSelectAvatar = (avatarId: string) => {
    storageManager.updateProfile({ avatar: avatarId });
    soundManager.playButtonClick();
    onUpdateProfile();
  };

  // Determine VIP Tier
  let vipTier = 'Bronze VIP';
  let tierColor = 'text-amber-600';
  if (profile.level >= 15) {
    vipTier = 'Royal Ace Elite';
    tierColor = 'text-amber-300 font-black';
  } else if (profile.level >= 10) {
    vipTier = 'Platinum VIP';
    tierColor = 'text-cyan-300';
  } else if (profile.level >= 6) {
    vipTier = 'Gold VIP';
    tierColor = 'text-yellow-400';
  } else if (profile.level >= 3) {
    vipTier = 'Silver VIP';
    tierColor = 'text-slate-300';
  }

  const nextLevelXp = Math.pow(profile.level, 2) * 40;
  const currentLevelBaseXp = Math.pow(profile.level - 1, 2) * 40;
  const progressInLevel = Math.max(0, profile.xp - currentLevelBaseXp);
  const xpNeeded = Math.max(1, nextLevelXp - currentLevelBaseXp);
  const xpPercent = Math.min(100, Math.round((progressInLevel / xpNeeded) * 100));

  const winRate =
    profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;

  const currentAvatarDef = AVATAR_OPTIONS.find(a => a.id === profile.avatar) || AVATAR_OPTIONS[0];

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 pb-20 md:pb-12">
      <CoinCelebration active={celebrate} onComplete={() => setCelebrate(false)} />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Profile Card Header */}
        <div className="bg-[#12141c] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left z-10">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-1 shadow-xl flex items-center justify-center">
                <div className="w-full h-full rounded-xl bg-[#0e1017] flex items-center justify-center text-4xl select-none">
                  {currentAvatarDef.icon}
                </div>
              </div>
            </div>

            {/* User Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value)}
                      className="bg-slate-900 border border-amber-500/60 rounded-lg px-2.5 py-1 text-sm text-slate-100 outline-none"
                      maxLength={18}
                    />
                    <button
                      type="button"
                      onClick={handleSaveUsername}
                      className="p-1.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="font-serif font-black text-2xl sm:text-3xl text-slate-100">
                      {profile.username}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="text-slate-400 hover:text-amber-400 transition-colors p-1"
                      title="Edit Username"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs">
                <span className={`font-semibold uppercase tracking-wider ${tierColor}`}>{vipTier}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">Level {profile.level}</span>
                <span className="text-slate-500">·</span>
                <span className="text-amber-400 font-serif font-bold">
                  {profile.coins.toLocaleString()} Virtual Chips
                </span>
              </div>

              {/* XP Progress Bar */}
              <div className="w-full sm:w-72 space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Level Progress</span>
                  <span>{progressInLevel} / {xpNeeded} XP ({xpPercent}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-300"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Avatar Selector Switcher */}
          <div className="flex flex-col items-center sm:items-end gap-2 z-10">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Change Avatar</span>
            <div className="flex items-center gap-1.5">
              {AVATAR_OPTIONS.map(av => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => handleSelectAvatar(av.id)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
                    profile.avatar === av.id
                      ? 'bg-amber-500/20 border-2 border-amber-400 scale-110 shadow-md shadow-amber-500/30'
                      : 'bg-slate-900 border border-slate-800 hover:bg-slate-800'
                  }`}
                  title={av.label}
                >
                  {av.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Career Stats KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#12141c] border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Games Played</span>
            <div className="font-serif font-bold text-2xl text-slate-100 tabular-nums">
              {profile.gamesPlayed}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12141c] border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Games Won</span>
            <div className="font-serif font-bold text-2xl text-emerald-400 tabular-nums">
              {profile.gamesWon}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12141c] border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Win Rate</span>
            <div className="font-serif font-bold text-2xl text-amber-300 tabular-nums">
              {winRate}%
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#12141c] border border-slate-800 text-center space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Won</span>
            <div className="font-serif font-bold text-2xl text-amber-300 tabular-nums">
              {profile.totalWon >= 1000 ? `${(profile.totalWon / 1000).toFixed(1)}k` : profile.totalWon}
            </div>
          </div>
        </div>

        {/* 12 Career Achievements */}
        <div className="bg-[#12141c] rounded-2xl border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif font-bold text-lg text-slate-100">VIP Casino Achievements</h2>
              <p className="text-xs text-slate-400">Complete challenges to earn trophy status and virtual coin bonuses</p>
            </div>
            <div className="text-xs font-mono text-amber-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              {achievements.filter(a => a.completed).length} / {achievements.length} Unlocked
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {achievements.map(ach => (
              <div
                key={ach.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  ach.completed
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-md'
                    : 'bg-[#151822] border-slate-800/80 opacity-75'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif font-bold text-sm text-slate-200">{ach.title}</h3>
                    {ach.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono text-amber-400/80">+{ach.rewardCoins}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{ach.description}</p>
                </div>

                <div className="pt-3 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Progress</span>
                    <span>{ach.progress} / {ach.target}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ach.completed ? 'bg-amber-400' : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
