import React from 'react';
import { Home, Layers, Dices, Wallet, User } from 'lucide-react';
import { soundManager } from '../../services/sound';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onNavigate }) => {
  const tabs = [
    { id: 'lobby', label: 'Lobby', icon: Home },
    { id: 'games', label: 'Games', icon: Layers },
    { id: 'multiplayer', label: 'Multiplayer', icon: Dices },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d12]/95 backdrop-blur-md border-t border-slate-800/90 px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onNavigate(tab.id);
            }}
            className={`min-h-[44px] min-w-[56px] flex flex-col items-center justify-center transition-colors ${
              isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
            <span className="text-[10px] font-medium tracking-tight mt-1 leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
