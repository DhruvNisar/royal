import React from 'react';
import { X, Volume2, VolumeX, Music, Shield, RefreshCw, Sparkles } from 'lucide-react';
import { SoundSettings, UserProfile } from '../../types';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundSettings: SoundSettings;
  onUpdateSoundSettings: (settings: SoundSettings) => void;
  profile: UserProfile;
  onReloadCoins: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundSettings,
  onUpdateSoundSettings,
  profile,
  onReloadCoins,
}) => {
  if (!isOpen) return null;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const updated = { ...soundSettings, masterVolume: val };
    onUpdateSoundSettings(updated);
    soundManager.updateSettings(updated);
  };

  const handleToggleSfx = () => {
    const next = !soundSettings.sfxEnabled;
    const updated = { ...soundSettings, sfxEnabled: next };
    onUpdateSoundSettings(updated);
    soundManager.updateSettings(updated);
    if (next) soundManager.playChipClick();
  };

  const handleToggleMusic = () => {
    const next = !soundSettings.musicEnabled;
    const updated = { ...soundSettings, musicEnabled: next };
    onUpdateSoundSettings(updated);
    soundManager.updateSettings(updated);
  };

  const handleClaimEmergency = () => {
    const res = storageManager.claimEmergencyReload();
    if (res.success) {
      soundManager.playWin();
      onReloadCoins();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#13151c] border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-serif font-black text-xl">♠</span>
            <h2 className="font-serif font-bold text-lg text-slate-100">Casino Settings</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Controls */}
        <div className="py-4 space-y-4 border-b border-slate-800">
          <h3 className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Audio & Soundtracks</h3>

          {/* Master Volume */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Master Volume</span>
              <span className="tabular-nums font-mono">{Math.round(soundSettings.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundSettings.masterVolume}
              onChange={handleVolumeChange}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-slate-200">
              {soundSettings.sfxEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              <span>Casino Sound Effects</span>
            </div>
            <button
              type="button"
              onClick={handleToggleSfx}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                soundSettings.sfxEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Lounge Music Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-slate-200">
              <Music className={`w-4 h-4 ${soundSettings.musicEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Ambient Casino Lounge</span>
            </div>
            <button
              type="button"
              onClick={handleToggleMusic}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                soundSettings.musicEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        </div>

        {/* Bankroll Assistance */}
        <div className="py-4 space-y-3 border-b border-slate-800">
          <h3 className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Virtual Bankroll</h3>
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div>
              <div className="text-sm font-medium text-slate-200">Emergency Chip Reload</div>
              <div className="text-xs text-slate-400">Available when coins &lt; 50</div>
            </div>
            <button
              type="button"
              onClick={handleClaimEmergency}
              disabled={profile.coins >= 50}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              +1,000 Coins
            </button>
          </div>
        </div>

        {/* 18+ Entertainment Notice */}
        <div className="pt-4">
          <div className="bg-amber-950/20 border border-amber-600/30 rounded-xl p-3 flex gap-3 text-xs text-amber-200/90 leading-relaxed">
            <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">18+ Virtual Play Notice: </span>
              ROYAL ACE is strictly a free virtual entertainment application. All coins and chips are fictional virtual credits with zero real-world monetary value. No real-money gambling, deposits, cash-outs, or transfers are supported.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
