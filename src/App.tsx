import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, SoundSettings, GameId, GameCategory } from './types';
import { storageManager } from './services/storage';
import { soundManager } from './services/sound';
import {
  AppNavigationState,
  createInitialNavigationState,
  openGameWithReturnContext,
  exitGameWithReturnContext,
  navigateTopLevelView,
} from './services/navigation';
import { Header } from './components/common/Header';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { SettingsModal } from './components/common/SettingsModal';
import { RulesModal } from './components/common/RulesModal';
import { FirebaseSetupModal } from './components/common/FirebaseSetupModal';

// Pages
import { Lobby } from './pages/Lobby';
import { GamesList } from './pages/GamesList';
import { WalletPage } from './pages/WalletPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { MultiplayerPage } from './pages/MultiplayerPage';

// Games
import { BlackjackGame } from './games/blackjack/BlackjackGame';
import { RouletteGame } from './games/roulette/RouletteGame';
import { PokerGame } from './games/poker/PokerGame';
import { BaccaratGame } from './games/baccarat/BaccaratGame';
import { DiceGame } from './games/dice/DiceGame';
import { SlotsGame } from './games/slots/SlotsGame';
import { TeenPattiGame } from './games/teen_patti/TeenPattiGame';
import { PlinkoGame } from './games/plinko/PlinkoGame';
import { CrashGame } from './games/crash/CrashGame';
import { MinesGame } from './games/mines/MinesGame';

import { Sparkles, ArrowRight } from 'lucide-react';

export default function App() {
  const [profile, setProfile] = useState<UserProfile>(() => storageManager.getProfile());
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => storageManager.getSoundSettings());
  const [navState, setNavState] = useState<AppNavigationState>(() =>
    createInitialNavigationState('lobby')
  );
  const [selectedGameForRules, setSelectedGameForRules] = useState<GameId>('blackjack');
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFirebaseOpen, setIsFirebaseOpen] = useState<boolean>(false);
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);

  const currentView = navState.currentView;
  const pendingScrollRestoreRef = useRef<number | null>(null);

  // Sync profile from storage
  const refreshProfile = () => {
    setProfile(storageManager.getProfile());
  };

  useEffect(() => {
    // Dismiss splash screen smoothly after short duration or allow instant click
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      pendingScrollRestoreRef.current !== null &&
      !currentView.startsWith('game_') &&
      typeof window !== 'undefined'
    ) {
      const targetY = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: 'auto' });
      });
    }
  }, [currentView]);

  const handleNavigate = useCallback((view: string, resetScroll: boolean = true) => {
    pendingScrollRestoreRef.current = null;
    setNavState(prev => navigateTopLevelView(prev, view));
    if (resetScroll && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSelectGame = useCallback((gameId: GameId) => {
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    setSelectedGameForRules(gameId);
    setNavState(prev => openGameWithReturnContext(prev, gameId, scrollY));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const handleExitGame = useCallback(() => {
    setNavState(prev => {
      const { nextState, restoreScrollY } = exitGameWithReturnContext(prev);
      pendingScrollRestoreRef.current = restoreScrollY;
      return nextState;
    });
  }, []);

  const handleGamesCategoryChange = useCallback((category: GameCategory) => {
    setNavState(prev => ({ ...prev, gamesCategory: category }));
  }, []);

  const handleGamesSearchChange = useCallback((query: string) => {
    setNavState(prev => ({ ...prev, gamesSearchQuery: query }));
  }, []);

  const { canClaim: canClaimReward } = storageManager.canClaimDailyReward();

  // Splash Screen Intro
  if (isSplashActive) {
    return (
      <div className="fixed inset-0 z-50 bg-[#07080b] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
        {/* Background glow */}
        <div className="absolute w-96 h-96 rounded-full bg-amber-500/10 filter blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center space-y-6 max-w-sm animate-in fade-in zoom-in-95 duration-700">
          {/* Royal Ace Monogram Emblem */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-1 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
            <div className="w-full h-full rounded-2xl bg-[#0e1017] flex items-center justify-center">
              <span className="font-serif font-black text-amber-300 text-3xl">♠</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-serif font-black text-3xl sm:text-4xl gold-text-gradient tracking-widest uppercase">
              ROYAL ACE
            </h1>
            <p className="text-xs uppercase tracking-widest text-amber-400/90 font-semibold">
              PREMIUM VIRTUAL CASINO
            </p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Strictly 18+ virtual gaming with fictional coins. Enter the high roller salon.
          </p>

          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setIsSplashActive(false);
            }}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/30 transition-transform active:scale-95 flex items-center gap-2"
          >
            <span>Enter Casino</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const isPlayingGame = currentView.startsWith('game_');

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col">
      {/* Universal Top Header */}
      <Header
        currentView={currentView}
        onNavigate={view => handleNavigate(view, true)}
        profile={profile}
        soundSettings={soundSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDailyReward={() => handleNavigate('wallet', true)}
        canClaimDailyReward={canClaimReward}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {currentView === 'lobby' && (
          <Lobby
            profile={profile}
            onSelectGame={handleSelectGame}
            onNavigate={view => handleNavigate(view, true)}
            onOpenDailyReward={() => handleNavigate('wallet', true)}
            canClaimDailyReward={canClaimReward}
            onUpdateProfile={refreshProfile}
          />
        )}

        {currentView === 'games' && (
          <GamesList
            onSelectGame={handleSelectGame}
            onNavigateToMultiplayer={() => handleNavigate('multiplayer', true)}
            selectedCategory={navState.gamesCategory}
            onSelectCategory={handleGamesCategoryChange}
            searchQuery={navState.gamesSearchQuery}
            onSearchChange={handleGamesSearchChange}
          />
        )}

        {currentView === 'wallet' && (
          <WalletPage profile={profile} onUpdateProfile={refreshProfile} />
        )}

        {currentView === 'profile' && (
          <ProfilePage profile={profile} onUpdateProfile={refreshProfile} />
        )}

        {currentView === 'leaderboard' && <LeaderboardPage profile={profile} />}

        {currentView === 'multiplayer' && (
          <MultiplayerPage
            profile={profile}
            onOpenFirebaseGuide={() => setIsFirebaseOpen(true)}
            onBackToLobby={() => handleNavigate('lobby', true)}
          />
        )}

        {/* Game Views */}
        {currentView === 'game_blackjack' && (
          <BlackjackGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('blackjack');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_roulette' && (
          <RouletteGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('roulette');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_poker' && (
          <PokerGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('poker');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_baccarat' && (
          <BaccaratGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('baccarat');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_dice' && (
          <DiceGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('dice');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_slots' && (
          <SlotsGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('slots');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_teen_patti' && (
          <TeenPattiGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('teen_patti');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_plinko' && (
          <PlinkoGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('plinko');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_crash' && (
          <CrashGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('crash');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}

        {currentView === 'game_mines' && (
          <MinesGame
            profile={profile}
            onUpdateProfile={refreshProfile}
            onOpenRules={() => {
              setSelectedGameForRules('mines');
              setIsRulesOpen(true);
            }}
            onBackToLobby={handleExitGame}
          />
        )}
      </main>

      {/* Mobile Ergonomic Bottom Tab Bar (hidden when actively at game tables so controls have maximum room) */}
      {!isPlayingGame && (
        <MobileBottomNav
          currentView={currentView}
          onNavigate={view => handleNavigate(view, true)}
        />
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        soundSettings={soundSettings}
        onUpdateSoundSettings={updated => {
          setSoundSettings(updated);
          storageManager.saveSoundSettings(updated);
        }}
        profile={profile}
        onReloadCoins={refreshProfile}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        initialGame={selectedGameForRules}
      />

      <FirebaseSetupModal
        isOpen={isFirebaseOpen}
        onClose={() => setIsFirebaseOpen(false)}
      />
    </div>
  );
}
