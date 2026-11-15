import React from 'react';
import { Volume2, VolumeX, Settings, Sparkles, Shield, Gift } from 'lucide-react';
import { UserProfile, SoundSettings } from '../../types';
import { soundManager } from '../../services/sound';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  profile: UserProfile;
  soundSettings: SoundSettings;
  onOpenSettings: () => void;
  onOpenDailyReward: () => void;
  canClaimDailyReward: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  profile,
  soundSettings,
  onOpenSettings,
  onOpenDailyReward,
  canClaimDailyReward,
}) => {
  const toggleSound = () => {
    const next = !soundSettings.sfxEnabled;
    soundManager.updateSettings({ sfxEnabled: next });
    if (next) soundManager.playButtonClick();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0d0f14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div
          onClick={() => {
            soundManager.playButtonClick();
            onNavigate('lobby');
          }}
          className="flex items-center gap-2 cursor-pointer select-none shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center shadow-md shadow-amber-500/20">
            <span className="font-serif font-black text-slate-950 text-base leading-none">♠</span>
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-black tracking-widest text-lg sm:text-xl gold-text-gradient uppercase leading-none">
              ROYAL ACE
            </span>
            <span className="text-[9px] uppercase tracking-widest text-amber-400/80 font-medium">
              VIRTUAL CASINO
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Desktop/Tablet) */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onNavigate('lobby');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-amber-300 ${
              currentView === 'lobby' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Lobby
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onNavigate('games');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-amber-300 ${
              currentView === 'games' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            All Games
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onNavigate('wallet');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-amber-300 ${
              currentView === 'wallet' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Virtual Wallet
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onNavigate('multiplayer');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-amber-300 flex items-center gap-1.5 ${
              currentView === 'multiplayer' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Multiplayer
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onNavigate('leaderboard');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-amber-300 ${
              currentView === 'leaderboard' ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5' : ''
            }`}
          >
            Leaderboard
          </button>
        </nav>

        {/* Zone 3: Primary Bankroll & Controls */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Daily Reward Claim Button */}
          {canClaimDailyReward && (
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                onOpenDailyReward();
              }}
              className="relative p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5"
              title="Claim Daily Login Reward"
            >
              <Gift className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-xs font-semibold">Reward</span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
            </button>
          )}

          {/* Virtual Coin Balance Widget */}
          <div
            onClick={() => {
              soundManager.playChipClick();
              onNavigate('wallet');
            }}
            className="flex items-center gap-2 bg-[#171a23] hover:bg-[#1f2330] border border-amber-500/30 hover:border-amber-400/60 rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 cursor-pointer transition-all select-none shadow-md shadow-black/40"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 flex items-center justify-center font-bold text-slate-950 text-xs shadow-inner">
              $
            </div>
            <div className="flex flex-col text-left">
              <span className="text-amber-300 font-serif font-black text-sm sm:text-base tabular-nums leading-none">
                {profile.coins.toLocaleString()}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 leading-none mt-0.5">
                VIP Lv.{profile.level}
              </span>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title={soundSettings.sfxEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
            aria-label="Toggle Sound"
          >
            {soundSettings.sfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Settings Trigger */}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onOpenSettings();
            }}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Settings & 18+ Notice"
            aria-label="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
