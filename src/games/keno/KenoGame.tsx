import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  KenoGameState,
  KenoRoundResult,
  KenoStats,
} from '../../types';
import {
  KENO_TOTAL_NUMBERS,
  KENO_DRAW_COUNT,
  KENO_MIN_PICKS,
  KENO_MAX_PICKS,
  KENO_DEFAULT_PICKS,
  KENO_MIN_BET,
  KENO_MAX_BET,
  KENO_DEFAULT_BET,
  KENO_TARGET_RTP,
  getKenoMultiplier,
  calculateKenoPayout,
  calculateHypergeometricProbability,
  getKenoPaytableForSelection,
  formatKenoMultiplier,
} from './kenoMath';
import {
  cryptoDrawKenoNumbers,
  generateKenoQuickPick,
  validateKenoSelection,
  validateKenoBet,
  computeKenoRoundResult,
  loadKenoHistory,
  appendKenoHistoryRecord,
  calculateKenoStats,
} from './kenoLogic';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Coins,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  Square,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface KenoGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface AutoPlayConfig {
  rounds: number;
  stopOnProfit: number | null;
  stopOnLoss: number | null;
  randomizeEachRound: boolean;
}

const BET_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;
const QUICK_PICK_PRESETS = [1, 3, 5, 8, 10] as const;

export const KenoGame: React.FC<KenoGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  // --- Game State ---
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([7, 14, 21, 42, 77]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [revealedDrawn, setRevealedDrawn] = useState<number[]>([]);
  const [gameState, setGameState] = useState<KenoGameState>('READY');
  const [bet, setBet] = useState<number>(KENO_DEFAULT_BET);
  const [lastResult, setLastResult] = useState<KenoRoundResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Draw Animation Ref ---
  const drawIntervalRef = useRef<number | null>(null);
  const autoPlayTimeoutRef = useRef<number | null>(null);

  // --- Auto Play State ---
  const [isAutoPlayMode, setIsAutoPlayMode] = useState<boolean>(false);
  const [isAutoPlayRunning, setIsAutoPlayRunning] = useState<boolean>(false);
  const [autoConfig, setAutoConfig] = useState<AutoPlayConfig>({
    rounds: 10,
    stopOnProfit: null,
    stopOnLoss: null,
    randomizeEachRound: false,
  });
  const [autoRoundsLeft, setAutoRoundsLeft] = useState<number>(0);
  const [autoNetProfit, setAutoNetProfit] = useState<number>(0);
  const autoStartCoinsRef = useRef<number>(profile.coins);

  // --- UI Drawer / Modal States ---
  const [isRulesDrawerOpen, setIsRulesDrawerOpen] = useState<boolean>(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [isPaytableCollapsed, setIsPaytableCollapsed] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [celebrationCoins, setCelebrationCoins] = useState<number>(0);

  // --- History & Stats ---
  const [history, setHistory] = useState<KenoRoundResult[]>(() => loadKenoHistory());
  const stats = useMemo(() => calculateKenoStats(history), [history]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (drawIntervalRef.current) window.clearInterval(drawIntervalRef.current);
      if (autoPlayTimeoutRef.current) window.clearTimeout(autoPlayTimeoutRef.current);
    };
  }, []);

  // Set of selected and revealed for O(1) rendering checks
  const selectedSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
  const revealedSet = useMemo(() => new Set(revealedDrawn), [revealedDrawn]);

  // Current matched numbers among revealed
  const currentMatches = useMemo(() => {
    return revealedDrawn.filter(n => selectedSet.has(n));
  }, [revealedDrawn, selectedSet]);

  // Dynamic Paytable for currently selected count
  const paytableEntries = useMemo(() => {
    const count = selectedNumbers.length;
    if (count < KENO_MIN_PICKS) return [];
    return getKenoPaytableForSelection(count, bet);
  }, [selectedNumbers.length, bet]);

  // Current potential or actual multiplier
  const activeMultiplier = useMemo(() => {
    if (selectedNumbers.length < KENO_MIN_PICKS) return 0;
    return getKenoMultiplier(selectedNumbers.length, currentMatches.length);
  }, [selectedNumbers.length, currentMatches.length]);

  // Toggle single number selection
  const handleToggleNumber = (num: number) => {
    if (gameState === 'DRAWING' || isAutoPlayRunning) return;
    setErrorMessage(null);

    if (selectedSet.has(num)) {
      soundManager.playKenoNumberToggle(false);
      setSelectedNumbers(prev => prev.filter(n => n !== num));
    } else {
      if (selectedNumbers.length >= KENO_MAX_PICKS) {
        setErrorMessage(`Maximum ${KENO_MAX_PICKS} numbers allowed per round.`);
        return;
      }
      soundManager.playKenoNumberToggle(true);
      setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
    }
  };

  // Quick Pick
  const handleQuickPick = (count: number) => {
    if (gameState === 'DRAWING' || isAutoPlayRunning) return;
    setErrorMessage(null);
    soundManager.playKenoQuickPick();
    const picks = generateKenoQuickPick(count);
    setSelectedNumbers(picks);
  };

  // Clear all selections
  const handleClearSelections = () => {
    if (gameState === 'DRAWING' || isAutoPlayRunning) return;
    soundManager.playKenoClear();
    setSelectedNumbers([]);
    setErrorMessage(null);
  };

  // Bet adjustments
  const handleSetBet = (amount: number) => {
    if (gameState === 'DRAWING' || isAutoPlayRunning) return;
    soundManager.playChipClick();
    const clamped = Math.max(KENO_MIN_BET, Math.min(KENO_MAX_BET, Math.round(amount)));
    setBet(clamped);
    setErrorMessage(null);
  };

  const handleMultiplyBet = (factor: number) => {
    handleSetBet(bet * factor);
  };

  // Stop Auto Play
  const handleStopAutoPlay = useCallback((reason?: string) => {
    setIsAutoPlayRunning(false);
    setAutoRoundsLeft(0);
    if (autoPlayTimeoutRef.current) {
      window.clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    if (reason) {
      setErrorMessage(reason);
    }
  }, []);

  // Execute a single Keno Draw
  const startSingleDraw = useCallback(
    (customSelections?: number[]) => {
      const activeSelections = customSelections || selectedNumbers;

      // Validation
      const selVal = validateKenoSelection(activeSelections);
      if (!selVal.valid) {
        setErrorMessage(selVal.error || 'Invalid number selection.');
        handleStopAutoPlay();
        return;
      }

      const betVal = validateKenoBet(bet, profile.coins);
      if (!betVal.valid) {
        setErrorMessage(betVal.error || 'Invalid bet amount.');
        handleStopAutoPlay('Insufficient virtual coin balance.');
        return;
      }

      setErrorMessage(null);

      // Execute bet transaction
      const tx = storageManager.executeTransaction(
        'bet',
        'keno',
        bet,
        `Royal Keno: Pick ${activeSelections.length} Numbers`
      );

      if (!tx.success) {
        setErrorMessage(tx.error || 'Transaction failed.');
        handleStopAutoPlay();
        return;
      }

      onUpdateProfile();
      soundManager.playChipClick();

      // Draw 20 numbers beforehand using cryptographic Fisher-Yates
      const fullDraw = cryptoDrawKenoNumbers(KENO_DRAW_COUNT, KENO_TOTAL_NUMBERS);
      setDrawnNumbers(fullDraw);
      setRevealedDrawn([]);
      setGameState('DRAWING');

      let currentRevealIndex = 0;
      const revealList: number[] = [];
      const currentSelectedSet = new Set(activeSelections);

      if (drawIntervalRef.current) {
        window.clearInterval(drawIntervalRef.current);
      }

      // Sequential animation: reveal 1 ball every 110ms (~2.2s total)
      drawIntervalRef.current = window.setInterval(() => {
        if (currentRevealIndex < fullDraw.length) {
          const nextBall = fullDraw[currentRevealIndex];
          revealList.push(nextBall);
          setRevealedDrawn([...revealList]);

          soundManager.playKenoBallDraw(currentRevealIndex);

          if (currentSelectedSet.has(nextBall)) {
            const hitNumber = revealList.filter(n => currentSelectedSet.has(n)).length;
            soundManager.playKenoMatchHit(hitNumber);
          }

          currentRevealIndex++;
        } else {
          // Finished drawing all 20 balls!
          if (drawIntervalRef.current) {
            window.clearInterval(drawIntervalRef.current);
            drawIntervalRef.current = null;
          }

          // Calculate final result
          const roundResult = computeKenoRoundResult(bet, activeSelections, fullDraw);
          setLastResult(roundResult);

          // Payout transaction if win
          if (roundResult.isWin) {
            storageManager.executeTransaction(
              'win',
              'keno',
              roundResult.payout,
              `Royal Keno Win: ${roundResult.matchesCount}/${activeSelections.length} Match (${formatKenoMultiplier(roundResult.multiplier)})`
            );

            // Achievements tracking
            if (roundResult.matchesCount >= 3) {
              storageManager.updateAchievementProgress('keno_first_catch', 1);
            }
            if (roundResult.matchesCount >= 7) {
              storageManager.updateAchievementProgress('keno_jackpot_hit', 1);
            }

            if (roundResult.multiplier >= 15) {
              soundManager.playBigWin();
              setCelebrationCoins(roundResult.payout);
              setShowCelebration(true);
            } else {
              soundManager.playWin();
            }
          } else {
            soundManager.playLoss();
          }

          // Record game round
          storageManager.recordGameRound('keno', roundResult.isWin, roundResult.payout);
          storageManager.incrementAchievementProgress('keno_master', 1);

          // Save to history
          const updatedHistory = appendKenoHistoryRecord(roundResult);
          setHistory(updatedHistory);

          onUpdateProfile();
          setGameState('ROUND_OVER');
        }
      }, 110);
    },
    [selectedNumbers, bet, profile.coins, onUpdateProfile, handleStopAutoPlay]
  );

  // Handle Play / Draw Button Click
  const handleStartDraw = () => {
    if (gameState === 'DRAWING' || isAutoPlayRunning) return;
    startSingleDraw();
  };

  // Start Auto Play Mode
  const handleStartAutoPlay = () => {
    if (selectedNumbers.length < KENO_MIN_PICKS) {
      setErrorMessage(`Please select at least ${KENO_MIN_PICKS} number before starting Auto Play.`);
      return;
    }
    if (profile.coins < bet) {
      setErrorMessage('Insufficient virtual coin balance for this wager.');
      return;
    }

    setErrorMessage(null);
    setIsAutoPlayRunning(true);
    setAutoRoundsLeft(autoConfig.rounds);
    setAutoNetProfit(0);
    autoStartCoinsRef.current = profile.coins;

    let picks = selectedNumbers;
    if (autoConfig.randomizeEachRound) {
      picks = generateKenoQuickPick(selectedNumbers.length || KENO_DEFAULT_PICKS);
      setSelectedNumbers(picks);
    }

    startSingleDraw(picks);
  };

  // Auto Play Next Round Pipeline
  useEffect(() => {
    if (!isAutoPlayRunning) return;
    if (gameState !== 'ROUND_OVER') return;

    // Evaluate stop conditions
    const currentProfile = storageManager.getProfile();
    const currentNet = currentProfile.coins - autoStartCoinsRef.current;
    setAutoNetProfit(currentNet);

    if (autoConfig.stopOnProfit && currentNet >= autoConfig.stopOnProfit) {
      handleStopAutoPlay(`Auto Play target profit reached (+${currentNet.toLocaleString()} coins).`);
      return;
    }

    if (autoConfig.stopOnLoss && currentNet <= -autoConfig.stopOnLoss) {
      handleStopAutoPlay(`Auto Play stop-loss limit hit (${currentNet.toLocaleString()} coins).`);
      return;
    }

    const nextRoundsLeft = autoRoundsLeft - 1;
    setAutoRoundsLeft(nextRoundsLeft);

    if (nextRoundsLeft <= 0) {
      setIsAutoPlayRunning(false);
      return;
    }

    if (currentProfile.coins < bet) {
      handleStopAutoPlay('Insufficient virtual coin balance to continue Auto Play.');
      return;
    }

    // Schedule next automated draw after a 900ms rest
    autoPlayTimeoutRef.current = window.setTimeout(() => {
      let picks = selectedNumbers;
      if (autoConfig.randomizeEachRound) {
        picks = generateKenoQuickPick(selectedNumbers.length || KENO_DEFAULT_PICKS);
        setSelectedNumbers(picks);
      }
      startSingleDraw(picks);
    }, 900);

    return () => {
      if (autoPlayTimeoutRef.current) {
        window.clearTimeout(autoPlayTimeoutRef.current);
      }
    };
  }, [
    gameState,
    isAutoPlayRunning,
    autoRoundsLeft,
    autoConfig,
    bet,
    selectedNumbers,
    startSingleDraw,
    handleStopAutoPlay,
  ]);

  // VIP Quick Reload
  const handleQuickReload = () => {
    const res = storageManager.claimEmergencyReload();
    if (res.success) {
      soundManager.playWin();
      onUpdateProfile();
      setErrorMessage(null);
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#080b12] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Coin Celebration Overlay for big catches */}
      {showCelebration && (
        <CoinCelebration
          active={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {/* Rules Drawer */}
      <InGameRuleDrawer
        gameId="keno"
        isOpen={isRulesDrawerOpen}
        onClose={() => setIsRulesDrawerOpen(false)}
      />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-3 sm:px-6 py-3 bg-[#0c101a]/95 backdrop-blur-md border-b border-amber-500/20 shadow-lg">
        {/* Left: Exit & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              if (drawIntervalRef.current) window.clearInterval(drawIntervalRef.current);
              if (autoPlayTimeoutRef.current) window.clearTimeout(autoPlayTimeoutRef.current);
              onBackToLobby();
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all text-xs font-semibold"
            title="Return to previous screen"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden xs:inline">Exit</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-serif font-black tracking-tight text-sm sm:text-base text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">
                ROYAL KENO
              </h1>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-amber-200/60">
                <span>80-Ball Classic</span>
                <span aria-hidden="true">·</span>
                <span>20 Draws</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-bold">97% RTP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Wallet Chips, History, and Rules */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Wallet Chips */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/30 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-400 leading-none">Coins</span>
              <span className="text-xs sm:text-sm font-bold text-amber-300 tabular-nums font-mono leading-tight">
                {profile.coins.toLocaleString()}
              </span>
            </div>
            {profile.coins < KENO_MIN_BET && (
              <button
                type="button"
                onClick={handleQuickReload}
                className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                +Reload
              </button>
            )}
          </div>

          {/* History Button */}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setIsHistoryDrawerOpen(prev => !prev);
            }}
            className={`p-2 rounded-xl border transition-colors ${
              isHistoryDrawerOpen
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/60 text-slate-300'
            }`}
            title="Round History & Stats"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Rules Button */}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setIsRulesDrawerOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all text-xs font-semibold"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Rules</span>
          </button>
        </div>
      </header>

      {/* ERROR / NOTIFICATION TOAST */}
      {errorMessage && (
        <div className="mx-3 sm:mx-6 mt-3 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* AUTO PLAY ACTIVE STRIP */}
      {isAutoPlayRunning && (
        <div className="mx-3 sm:mx-6 mt-2 px-4 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-amber-300 font-semibold">
              Auto Play Active: Round {autoConfig.rounds - autoRoundsLeft + 1} of {autoConfig.rounds}
            </span>
            <span className="text-slate-400 hidden sm:inline">
              (Net: <span className={autoNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{autoNetProfit >= 0 ? `+${autoNetProfit}` : autoNetProfit}</span> coins)
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleStopAutoPlay('Auto Play stopped by user.')}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase transition-colors"
          >
            <Square className="w-3 h-3" />
            <span>Stop Auto</span>
          </button>
        </div>
      )}

      {/* MAIN GAME CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-5 flex flex-col gap-4">
        {/* TOP STATUS BAR: SELECTIONS COUNT & QUICK PICKS */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#0e121d] border border-slate-800 shadow-md">
          {/* Spot Counter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Picks:</span>
            <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg ${
              selectedNumbers.length > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {selectedNumbers.length} / {KENO_MAX_PICKS}
            </span>
            {selectedNumbers.length === 0 && (
              <span className="text-[11px] text-amber-300/80 italic hidden xs:inline">
                Click 1 to 10 numbers on the board
              </span>
            )}
          </div>

          {/* Quick Pick Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 mr-1 hidden sm:inline">Quick Pick:</span>
            {QUICK_PICK_PRESETS.map(count => (
              <button
                key={count}
                type="button"
                disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                onClick={() => handleQuickPick(count)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedNumbers.length === count
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 disabled:opacity-40'
                }`}
              >
                {count}
              </button>
            ))}

            <button
              type="button"
              disabled={selectedNumbers.length === 0 || gameState === 'DRAWING' || isAutoPlayRunning}
              onClick={handleClearSelections}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-red-950/60 border border-slate-700/60 hover:border-red-500/40 text-slate-300 hover:text-red-300 text-xs font-semibold transition-all disabled:opacity-40"
              title="Clear all selected numbers"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT: (BOARD + HOPPER) & (PAYTABLE + BET CONTROLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT 7-8 COLS: 1-80 NUMBER BOARD & DRAW CHAMBER */}
          <div className="lg:col-span-8 flex flex-col gap-3.5">
            {/* 1–80 KENO NUMBER BOARD */}
            <div className="p-2 sm:p-4 rounded-3xl bg-gradient-to-b from-[#101422] to-[#0b0e18] border border-amber-500/30 shadow-2xl relative overflow-hidden">
              {/* Subtle luxury watermark / table texture accent */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.06),transparent_60%)] pointer-events-none" />

              {/* Board Header Label */}
              <div className="flex items-center justify-between px-2 pb-2 text-[11px] text-slate-400 font-semibold tracking-wide border-b border-slate-800/80 mb-2.5">
                <span className="text-amber-400/90 font-serif">TOP HALF: 1 — 40</span>
                <span className="text-slate-500 font-mono text-[10px]">TAP TO SELECT NUMBERS</span>
              </div>

              {/* NUMBERS GRID: 1 to 80 (10 columns × 8 rows) */}
              <div className="flex flex-col gap-1 sm:gap-1.5">
                {/* Top Half: Rows 1 to 4 (Numbers 1-40) */}
                <div className="grid grid-cols-10 gap-0.5 xs:gap-1 sm:gap-1.5">
                  {Array.from({ length: 40 }, (_, idx) => {
                    const num = idx + 1;
                    const isSelected = selectedSet.has(num);
                    const isDrawn = revealedSet.has(num);
                    const isMatch = isSelected && isDrawn;

                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                        onClick={() => handleToggleNumber(num)}
                        className={`relative aspect-square min-w-0 rounded-md sm:rounded-xl font-mono text-[10px] xs:text-xs sm:text-sm font-bold flex items-center justify-center transition-all transform active:scale-95 ${
                          isMatch
                            ? 'bg-gradient-to-br from-emerald-400 via-yellow-300 to-amber-500 text-slate-950 shadow-[0_0_14px_rgba(52,211,153,0.7)] ring-2 ring-emerald-300 scale-105 z-10 animate-pulse'
                            : isSelected
                            ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] ring-2 ring-amber-300 scale-102 z-10'
                            : isDrawn
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-[0_0_8px_rgba(59,130,246,0.6)] ring-1 ring-blue-400'
                            : 'bg-[#151927] hover:bg-[#1c2236] text-slate-300 hover:text-white border border-slate-800 hover:border-amber-500/40'
                        }`}
                        title={`Number ${num}${isSelected ? ' (Selected)' : ''}${isDrawn ? ' (Drawn)' : ''}`}
                      >
                        <span>{num}</span>
                        {/* Match hit star badge */}
                        {isMatch && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-300 border border-slate-950" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Table Center Gold Divider */}
                <div className="relative py-1.5 flex items-center justify-center my-0.5">
                  <div className="w-full border-t border-amber-500/30" />
                  <div className="absolute px-3 py-0.5 rounded-full bg-[#0c101a] border border-amber-500/40 text-[9px] font-serif font-black tracking-widest text-amber-400 uppercase shadow-md">
                    ROYAL ACE TABLE
                  </div>
                </div>

                {/* Bottom Half: Rows 5 to 8 (Numbers 41-80) */}
                <div className="grid grid-cols-10 gap-0.5 xs:gap-1 sm:gap-1.5">
                  {Array.from({ length: 40 }, (_, idx) => {
                    const num = idx + 41;
                    const isSelected = selectedSet.has(num);
                    const isDrawn = revealedSet.has(num);
                    const isMatch = isSelected && isDrawn;

                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                        onClick={() => handleToggleNumber(num)}
                        className={`relative aspect-square min-w-0 rounded-md sm:rounded-xl font-mono text-[10px] xs:text-xs sm:text-sm font-bold flex items-center justify-center transition-all transform active:scale-95 ${
                          isMatch
                            ? 'bg-gradient-to-br from-emerald-400 via-yellow-300 to-amber-500 text-slate-950 shadow-[0_0_14px_rgba(52,211,153,0.7)] ring-2 ring-emerald-300 scale-105 z-10 animate-pulse'
                            : isSelected
                            ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] ring-2 ring-amber-300 scale-102 z-10'
                            : isDrawn
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-[0_0_8px_rgba(59,130,246,0.6)] ring-1 ring-blue-400'
                            : 'bg-[#151927] hover:bg-[#1c2236] text-slate-300 hover:text-white border border-slate-800 hover:border-amber-500/40'
                        }`}
                        title={`Number ${num}${isSelected ? ' (Selected)' : ''}${isDrawn ? ' (Drawn)' : ''}`}
                      >
                        <span>{num}</span>
                        {isMatch && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-300 border border-slate-950" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Board Footer Legend */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-3 mt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-amber-400 to-yellow-500 ring-1 ring-amber-300" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-blue-600 to-indigo-700 ring-1 ring-blue-400" />
                  <span>Drawn</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-gradient-to-br from-emerald-400 via-yellow-300 to-amber-500 ring-1 ring-emerald-300" />
                  <span className="font-bold text-emerald-300">Match Hit!</span>
                </div>
              </div>
            </div>

            {/* 20-BALL DRAWING CHAMBER / HOPPER DISPLAY */}
            <div className="p-3 sm:p-4 rounded-3xl bg-[#0e121d] border border-slate-800 shadow-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="font-serif font-bold text-xs sm:text-sm text-slate-200">
                    Drawing Chamber ({revealedDrawn.length} / 20 Balls)
                  </h3>
                </div>

                {/* Live Hits Counter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Hits:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                    currentMatches.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {currentMatches.length} / {selectedNumbers.length}
                  </span>
                </div>
              </div>

              {/* 20 BALL SLOTS (2 rows of 10) */}
              <div className="grid grid-cols-10 gap-0.5 xs:gap-1 sm:gap-1.5">
                {Array.from({ length: KENO_DRAW_COUNT }, (_, idx) => {
                  const ballNum = revealedDrawn[idx];
                  const hasDrawn = ballNum !== undefined;
                  const isMatch = hasDrawn && selectedSet.has(ballNum);

                  return (
                    <div
                      key={idx}
                      className={`aspect-square rounded-md sm:rounded-xl flex items-center justify-center font-mono font-bold text-[10px] xs:text-xs sm:text-sm transition-all duration-200 ${
                        hasDrawn
                          ? isMatch
                            ? 'bg-gradient-to-br from-emerald-400 via-yellow-300 to-amber-400 text-slate-950 ring-2 ring-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)] scale-105 animate-in zoom-in-75'
                            : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white ring-1 ring-blue-400 shadow-inner animate-in zoom-in-75'
                          : 'bg-[#141824] border border-dashed border-slate-800 text-slate-600'
                      }`}
                    >
                      {hasDrawn ? ballNum : idx + 1}
                    </div>
                  );
                })}
              </div>

              {/* ROUND SUMMARY BANNER */}
              {gameState === 'ROUND_OVER' && lastResult && (
                <div className={`mt-2 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                  lastResult.isWin
                    ? 'bg-gradient-to-r from-emerald-950/60 via-amber-950/40 to-slate-900 border border-emerald-500/50'
                    : 'bg-slate-900/80 border border-slate-800'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                      lastResult.isWin
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {lastResult.isWin ? <Trophy className="w-5 h-5 text-yellow-400" /> : <RotateCcw className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-serif font-bold text-sm text-slate-100">
                        {lastResult.isWin ? 'Royal Catch!' : 'Better Luck Next Draw'}
                      </div>
                      <div className="text-xs text-slate-400">
                        Matched <span className="font-bold text-amber-300">{lastResult.matchesCount}</span> of {lastResult.selectedNumbers.length} numbers
                        {lastResult.multiplier > 0 && ` (${formatKenoMultiplier(lastResult.multiplier)})`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Payout</div>
                    <div className={`font-mono text-base sm:text-lg font-black tabular-nums ${
                      lastResult.isWin ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {lastResult.isWin ? `+${lastResult.payout.toLocaleString()}` : '0'} Coins
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 4-5 COLS: DYNAMIC PAYTABLE & BET CONTROLS */}
          <div className="lg:col-span-4 flex flex-col gap-3.5">
            {/* DYNAMIC HYPERGEOMETRIC PAYTABLE CARD */}
            <div className="p-3.5 sm:p-4 rounded-3xl bg-[#0e121d] border border-amber-500/30 shadow-xl flex flex-col">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="font-serif font-bold text-xs sm:text-sm text-slate-200">
                    Paytable ({selectedNumbers.length} {selectedNumbers.length === 1 ? 'Spot' : 'Spots'})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                    ~97% RTP
                  </span>
                  {/* Collapsible toggle for mobile */}
                  <button
                    type="button"
                    onClick={() => setIsPaytableCollapsed(prev => !prev)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-200 lg:hidden"
                  >
                    {isPaytableCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Paytable Rows */}
              {!isPaytableCollapsed && (
                <div className="mt-2.5 space-y-1 overflow-y-auto max-h-56 pr-0.5">
                  {selectedNumbers.length < KENO_MIN_PICKS ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Pick at least 1 number on the board to view the payout schedule.
                    </div>
                  ) : paytableEntries.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No positive return tiers for this count.
                    </div>
                  ) : (
                    paytableEntries.map(entry => {
                      const isCurrentMatchTier = currentMatches.length === entry.matches && gameState !== 'READY';

                      return (
                        <div
                          key={entry.matches}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all ${
                            isCurrentMatchTier
                              ? 'bg-gradient-to-r from-amber-500/30 to-emerald-500/20 border border-amber-400 text-amber-200 shadow-md scale-[1.02]'
                              : 'bg-slate-900/60 hover:bg-slate-800/60 text-slate-300 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 font-mono">
                              {entry.matches} Hits
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {(entry.probability * 100).toFixed(entry.probability < 0.001 ? 4 : 2)}%
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400">
                              {formatKenoMultiplier(entry.multiplier)}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400/90 tabular-nums">
                              {(entry.payoutAmount || 0).toLocaleString()} coins
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* BET & DRAW CONTROL PANEL */}
            <div className="p-4 rounded-3xl bg-gradient-to-b from-[#101422] to-[#0b0e18] border border-amber-500/30 shadow-xl flex flex-col gap-3.5">
              {/* Manual vs Auto Play Mode Switch */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                  onClick={() => setIsAutoPlayMode(false)}
                  className={`py-1.5 rounded-lg transition-all ${
                    !isAutoPlayMode
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Single Draw
                </button>
                <button
                  type="button"
                  disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                  onClick={() => setIsAutoPlayMode(true)}
                  className={`py-1.5 rounded-lg transition-all ${
                    isAutoPlayMode
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Auto Play
                </button>
              </div>

              {/* Bet Amount Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Wager Amount:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {bet.toLocaleString()} Coins
                  </span>
                </div>

                {/* Input & Quick Math */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={gameState === 'DRAWING' || isAutoPlayRunning || bet <= KENO_MIN_BET}
                    onClick={() => handleMultiplyBet(0.5)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-300 disabled:opacity-40"
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    disabled={gameState === 'DRAWING' || isAutoPlayRunning || bet * 2 > KENO_MAX_BET}
                    onClick={() => handleMultiplyBet(2)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-300 disabled:opacity-40"
                  >
                    2×
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                      value={bet}
                      onChange={e => handleSetBet(parseInt(e.target.value) || KENO_MIN_BET)}
                      min={KENO_MIN_BET}
                      max={KENO_MAX_BET}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-xs sm:text-sm text-center text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                    onClick={() => handleSetBet(Math.min(KENO_MAX_BET, profile.coins))}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-amber-400 disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>

                {/* Chip Presets */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 pt-1">
                  {BET_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      disabled={gameState === 'DRAWING' || isAutoPlayRunning}
                      onClick={() => handleSetBet(preset)}
                      className={`py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                        bet === preset
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* AUTO PLAY CONFIGURATION PANEL */}
              {isAutoPlayMode && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Rounds to Play:</span>
                    <span className="font-bold text-amber-300 font-mono">{autoConfig.rounds}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[5, 10, 25, 50, 100].map(r => (
                      <button
                        key={r}
                        type="button"
                        disabled={isAutoPlayRunning}
                        onClick={() => setAutoConfig(prev => ({ ...prev, rounds: r }))}
                        className={`py-1 rounded-lg text-xs font-bold ${
                          autoConfig.rounds === r
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Randomize toggle */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoConfig.randomizeEachRound}
                      disabled={isAutoPlayRunning}
                      onChange={e =>
                        setAutoConfig(prev => ({ ...prev, randomizeEachRound: e.target.checked }))
                      }
                      className="rounded accent-amber-500 w-3.5 h-3.5"
                    />
                    <span>Random Quick Pick each round</span>
                  </label>
                </div>
              )}

              {/* PRIMARY ACTION BUTTON */}
              {isAutoPlayMode ? (
                isAutoPlayRunning ? (
                  <button
                    type="button"
                    onClick={() => handleStopAutoPlay('Auto Play halted.')}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-serif font-black text-sm tracking-wider uppercase shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 active:scale-98 transition-transform"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>STOP AUTO PLAY</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={selectedNumbers.length < KENO_MIN_PICKS || profile.coins < bet}
                    onClick={handleStartAutoPlay}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>START AUTO ({autoConfig.rounds} ROUNDS)</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled={
                    selectedNumbers.length < KENO_MIN_PICKS ||
                    profile.coins < bet ||
                    gameState === 'DRAWING'
                  }
                  onClick={handleStartDraw}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
                >
                  {gameState === 'DRAWING' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>DRAWING 20 BALLS...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-slate-950" />
                      <span>
                        {selectedNumbers.length === 0
                          ? 'PICK NUMBERS TO PLAY'
                          : `DRAW 20 BALLS (${bet} COINS)`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ROUND HISTORY & CAREER STATS MODAL */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#111420] border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#151926]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h2 className="font-serif font-bold text-base sm:text-lg">Keno History &amp; Statistics</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Stats Overview */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0d101a] border-b border-slate-800 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Rounds Played</div>
                <div className="font-mono font-bold text-sm text-slate-100">{stats.roundsPlayed}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Win Rate</div>
                <div className="font-mono font-bold text-sm text-emerald-400">{stats.winRate.toFixed(1)}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Net Return</div>
                <div className={`font-mono font-bold text-sm ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.netProfit >= 0 ? `+${stats.netProfit.toLocaleString()}` : stats.netProfit.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Best Win</div>
                <div className="font-mono font-bold text-sm text-amber-300">{stats.bestWin.toLocaleString()}</div>
              </div>
            </div>

            {/* Recent Rounds Table */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 text-xs">
              {history.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No rounds played yet. Pick your numbers and make your first draw!
                </div>
              ) : (
                history.map(round => (
                  <div
                    key={round.id}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          Matched {round.matchesCount} of {round.selectedNumbers.length}
                        </span>
                        {round.multiplier > 0 && (
                          <span className="font-mono text-amber-400 font-bold">
                            {formatKenoMultiplier(round.multiplier)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Bet: {round.bet} coins · {new Date(round.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-mono font-bold ${round.isWin ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {round.isWin ? `+${round.payout.toLocaleString()}` : '0'} coins
                      </div>
                      <div className={`text-[10px] font-mono ${round.net >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                        Net: {round.net >= 0 ? `+${round.net}` : round.net}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
