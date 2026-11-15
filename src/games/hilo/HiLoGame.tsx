import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  HiLoCard,
  HiLoPrediction,
  HiLoOutcome,
  HiLoStepResult,
  HiLoGameState,
  HiLoRoundResult,
  HiLoStats,
} from '../../types';
import {
  HILO_MIN_BET,
  HILO_MAX_BET,
  HILO_DEFAULT_BET,
  calculateDeckOutcomes,
  getStepMultiplierForPrediction,
  evaluateStepOutcome,
  calculateHiLoPayout,
  formatHiLoMultiplier,
} from './hiloMath';
import {
  initializeShuffledDeck,
  validateHiLoBet,
  loadHiLoHistory,
  appendHiLoHistoryRecord,
  calculateHiLoStats,
} from './hiloLogic';
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
  ArrowUp,
  ArrowDown,
  Play,
  Square,
  Trophy,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface HiLoGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface AutoPlayConfig {
  rounds: number;
  targetStreak: number;
  strategy: 'smart' | 'higher' | 'lower' | 'random';
  stopOnProfit: number | null;
  stopOnLoss: number | null;
}

const BET_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export const HiLoGame: React.FC<HiLoGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  // --- Game State ---
  const [deck, setDeck] = useState<HiLoCard[]>([]);
  const [deckIndex, setDeckIndex] = useState<number>(0);
  const [currentCard, setCurrentCard] = useState<HiLoCard | null>(null);
  const [previousCards, setPreviousCards] = useState<HiLoCard[]>([]);
  const [steps, setSteps] = useState<HiLoStepResult[]>([]);
  const [correctStreak, setCorrectStreak] = useState<number>(0);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [gameState, setGameState] = useState<HiLoGameState>('BETTING');
  const [bet, setBet] = useState<number>(HILO_DEFAULT_BET);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [isSettled, setIsSettled] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  // Card Flip Animation Trigger
  const [isFlipping, setIsFlipping] = useState<boolean>(false);

  // --- Auto Play State ---
  const [isAutoPlayMode, setIsAutoPlayMode] = useState<boolean>(false);
  const [isAutoPlayRunning, setIsAutoPlayRunning] = useState<boolean>(false);
  const [autoConfig, setAutoConfig] = useState<AutoPlayConfig>({
    rounds: 10,
    targetStreak: 3,
    strategy: 'smart',
    stopOnProfit: null,
    stopOnLoss: null,
  });
  const [autoRoundsLeft, setAutoRoundsLeft] = useState<number>(0);
  const [autoNetProfit, setAutoNetProfit] = useState<number>(0);
  const autoStartCoinsRef = useRef<number>(profile.coins);
  const autoTimeoutRef = useRef<number | null>(null);

  // --- UI Drawer / Modal States ---
  const [isRulesDrawerOpen, setIsRulesDrawerOpen] = useState<boolean>(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // --- History & Career Stats ---
  const [history, setHistory] = useState<HiLoRoundResult[]>(() => loadHiLoHistory());
  const stats = useMemo(() => calculateHiLoStats(history), [history]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoTimeoutRef.current) {
        window.clearTimeout(autoTimeoutRef.current);
      }
    };
  }, []);

  // Remaining deck available for subsequent draws
  const remainingDeck = useMemo(() => {
    if (!deck.length || deckIndex >= deck.length) return [];
    return deck.slice(deckIndex);
  }, [deck, deckIndex]);

  // Dynamic outcome counts and multipliers based on remaining cards
  const deckOutcomes = useMemo(() => {
    if (!currentCard) {
      return {
        higherCount: 0,
        lowerCount: 0,
        tieCount: 0,
        totalRemaining: 0,
        probHigher: 0,
        probLower: 0,
        probTie: 0,
        multiplierHigher: 0,
        multiplierLower: 0,
      };
    }
    return calculateDeckOutcomes(currentCard, remainingDeck);
  }, [currentCard, remainingDeck]);

  // Potential payout at the current multiplier
  const currentPotentialPayout = useMemo(() => {
    if (correctStreak === 0 || currentMultiplier <= 1.0) return bet;
    return calculateHiLoPayout(bet, currentMultiplier);
  }, [bet, currentMultiplier, correctStreak]);

  // Stop Auto Play cleanly
  const handleStopAutoPlay = useCallback((reason?: string) => {
    setIsAutoPlayRunning(false);
    setAutoRoundsLeft(0);
    if (autoTimeoutRef.current) {
      window.clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
    if (reason) {
      setErrorMessage(reason);
    }
  }, []);

  // Bet adjustments
  const handleSetBet = (amount: number) => {
    if (gameState !== 'BETTING' || isAutoPlayRunning) return;
    soundManager.playChipClick();
    const clamped = Math.max(HILO_MIN_BET, Math.min(HILO_MAX_BET, Math.round(amount)));
    setBet(clamped);
    setErrorMessage(null);
  };

  const handleMultiplyBet = (factor: number) => {
    handleSetBet(bet * factor);
  };

  // START A NEW ROUND
  const handleStartRound = useCallback(() => {
    if (isAutoPlayRunning && gameState !== 'BETTING') return;
    if (gameState !== 'BETTING' && gameState !== 'ROUND_LOST' && gameState !== 'CASHED_OUT') return;

    const betVal = validateHiLoBet(bet, profile.coins);
    if (!betVal.valid) {
      setErrorMessage(betVal.error || 'Invalid bet amount.');
      handleStopAutoPlay('Insufficient virtual coin balance.');
      return;
    }

    setErrorMessage(null);
    setLastMessage(null);

    // Atomic bet transaction
    const tx = storageManager.executeTransaction(
      'bet',
      'hilo',
      bet,
      'Royal Hi-Lo: Initial Wager'
    );

    if (!tx.success) {
      setErrorMessage(tx.error || 'Transaction failed.');
      handleStopAutoPlay();
      return;
    }

    onUpdateProfile();
    soundManager.playCardDeal();

    // Generate fresh shuffled 52-card deck
    const shuffled = initializeShuffledDeck();
    const firstCard = shuffled[0];
    const initialRemainingIndex = 1;

    const roundId = `hilo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setDeck(shuffled);
    setDeckIndex(initialRemainingIndex);
    setCurrentCard(firstCard);
    setPreviousCards([firstCard]);
    setSteps([]);
    setCorrectStreak(0);
    setCurrentMultiplier(1.0);
    setActiveRoundId(roundId);
    setIsSettled(false);
    setGameState('PREDICTING');

    // Subtle card appearance animation
    setIsFlipping(true);
    setTimeout(() => setIsFlipping(false), 250);
  }, [bet, profile.coins, gameState, isAutoPlayRunning, onUpdateProfile, handleStopAutoPlay]);

  // CASH OUT CURRENT PAYOUT
  const handleCashOut = useCallback(() => {
    if (isSettled || gameState !== 'PREDICTING' || correctStreak === 0) return;

    const finalPayout = calculateHiLoPayout(bet, currentMultiplier);
    const net = finalPayout - bet;

    // Credit payout atomically
    storageManager.executeTransaction(
      'win',
      'hilo',
      finalPayout,
      `Royal Hi-Lo Win: ${correctStreak} Streak (${formatHiLoMultiplier(currentMultiplier)})`
    );

    // Achievements tracking
    storageManager.updateAchievementProgress('hilo_first_win', 1);
    if (correctStreak >= 5) {
      storageManager.updateAchievementProgress('hilo_streak_5', 1);
    }
    if (currentMultiplier >= 10) {
      storageManager.updateAchievementProgress('hilo_high_roller', 1);
    }

    if (currentMultiplier >= 15 || finalPayout >= bet * 10) {
      soundManager.playBigWin();
      setShowCelebration(true);
    } else {
      soundManager.playHiLoCashOut();
    }

    // Save history record
    if (activeRoundId && currentCard) {
      const record: HiLoRoundResult = {
        id: activeRoundId,
        timestamp: Date.now(),
        bet,
        initialCard: previousCards[0] || currentCard,
        finalCard: currentCard,
        cardsRevealed: previousCards,
        steps,
        correctStreak,
        finalMultiplier: currentMultiplier,
        payout: finalPayout,
        net,
        outcome: 'CASHED_OUT',
      };
      const updatedHistory = appendHiLoHistoryRecord(record);
      setHistory(updatedHistory);
    }

    storageManager.recordGameRound('hilo', true, finalPayout);
    storageManager.incrementAchievementProgress('hilo_master', 1);

    onUpdateProfile();
    setIsSettled(true);
    setGameState('CASHED_OUT');
    setLastMessage(`Cashed out! +${finalPayout.toLocaleString()} coins won (+${net.toLocaleString()} net).`);
  }, [
    isSettled,
    gameState,
    correctStreak,
    bet,
    currentMultiplier,
    activeRoundId,
    currentCard,
    previousCards,
    steps,
    onUpdateProfile,
  ]);

  // MAKE A PREDICTION (HIGHER OR LOWER)
  const handleMakePrediction = useCallback(
    (prediction: HiLoPrediction) => {
      if (gameState !== 'PREDICTING' || !currentCard || isSettled) return;

      const { multiplier: stepMult, probability } = getStepMultiplierForPrediction(
        prediction,
        deckOutcomes
      );

      if (probability <= 0 || stepMult <= 0) {
        setErrorMessage(`No remaining cards are ${prediction === 'HIGHER' ? 'higher' : 'lower'}.`);
        return;
      }

      setErrorMessage(null);
      setGameState('REVEALING');
      setIsFlipping(true);
      soundManager.playHiLoCardFlip();

      // Check if deck has remaining cards
      if (deckIndex >= deck.length) {
        // Deck exhausted! Settle round immediately
        handleCashOut();
        return;
      }

      const nextCard = deck[deckIndex];
      const nextIndex = deckIndex + 1;
      const outcome = evaluateStepOutcome(currentCard, nextCard, prediction);

      const stepRecord: HiLoStepResult = {
        stepIndex: steps.length + 1,
        prevCard: currentCard,
        prediction,
        revealedCard: nextCard,
        outcome,
        stepMultiplier: outcome === 'WIN' ? stepMult : 1.0,
        probability,
      };

      const updatedSteps = [...steps, stepRecord];
      setSteps(updatedSteps);

      setTimeout(() => {
        setIsFlipping(false);
        setCurrentCard(nextCard);
        setPreviousCards(prev => [...prev, nextCard]);
        setDeckIndex(nextIndex);

        if (outcome === 'WIN') {
          // CORRECT PREDICTION
          const newStreak = correctStreak + 1;
          const newMultiplier = currentMultiplier * stepMult;
          setCorrectStreak(newStreak);
          setCurrentMultiplier(newMultiplier);
          soundManager.playHiLoCorrect(newStreak);
          setGameState('PREDICTING');
          setLastMessage(`Correct! Multiplier increased to ${formatHiLoMultiplier(newMultiplier)}`);
        } else if (outcome === 'PUSH') {
          // SAME RANK PUSH
          soundManager.playHiLoPush();
          setGameState('PREDICTING');
          setLastMessage(`Push! Same rank (${nextCard.symbol}). Multiplier preserved at ${formatHiLoMultiplier(currentMultiplier)}.`);
        } else {
          // INCORRECT PREDICTION -> LOSS
          soundManager.playLoss();
          setIsSettled(true);
          setGameState('ROUND_LOST');
          setLastMessage(`Incorrect! Dealt ${nextCard.symbol} of ${nextCard.suit}. Better luck next time.`);

          // Record lost round in history
          if (activeRoundId) {
            const record: HiLoRoundResult = {
              id: activeRoundId,
              timestamp: Date.now(),
              bet,
              initialCard: previousCards[0] || currentCard,
              finalCard: nextCard,
              cardsRevealed: [...previousCards, nextCard],
              steps: updatedSteps,
              correctStreak,
              finalMultiplier: 0,
              payout: 0,
              net: -bet,
              outcome: 'LOST',
            };
            const updatedHistory = appendHiLoHistoryRecord(record);
            setHistory(updatedHistory);
          }

          storageManager.recordGameRound('hilo', false, 0);
          storageManager.incrementAchievementProgress('hilo_master', 1);
          onUpdateProfile();
        }
      }, 350);
    },
    [
      gameState,
      currentCard,
      isSettled,
      deckOutcomes,
      deck,
      deckIndex,
      steps,
      correctStreak,
      currentMultiplier,
      activeRoundId,
      previousCards,
      bet,
      handleCashOut,
      onUpdateProfile,
    ]
  );

  // START AUTO PLAY
  const handleStartAutoPlay = () => {
    if (profile.coins < bet) {
      setErrorMessage('Insufficient virtual coin balance for this wager.');
      return;
    }

    setErrorMessage(null);
    setIsAutoPlayRunning(true);
    setAutoRoundsLeft(autoConfig.rounds);
    setAutoNetProfit(0);
    autoStartCoinsRef.current = profile.coins;

    handleStartRound();
  };

  // AUTO PLAY LOGIC ENGINE
  useEffect(() => {
    if (!isAutoPlayRunning) return;

    // Check bankroll stop limits
    const currentProfile = storageManager.getProfile();
    const currentNet = currentProfile.coins - autoStartCoinsRef.current;
    setAutoNetProfit(currentNet);

    if (autoConfig.stopOnProfit && currentNet >= autoConfig.stopOnProfit) {
      handleStopAutoPlay(`Auto Play profit target reached (+${currentNet.toLocaleString()} coins).`);
      return;
    }

    if (autoConfig.stopOnLoss && currentNet <= -autoConfig.stopOnLoss) {
      handleStopAutoPlay(`Auto Play stop-loss limit reached (${currentNet.toLocaleString()} coins).`);
      return;
    }

    // Step 1: In PREDICTING state, make next choice or cash out if target streak reached
    if (gameState === 'PREDICTING' && currentCard) {
      if (correctStreak >= autoConfig.targetStreak) {
        // Target streak reached -> Cash Out!
        autoTimeoutRef.current = window.setTimeout(() => {
          handleCashOut();
        }, 500);
        return;
      }

      // Determine prediction based on configured strategy
      let chosenPrediction: HiLoPrediction = 'HIGHER';

      if (autoConfig.strategy === 'smart') {
        // Pick whichever option has higher probability
        chosenPrediction = deckOutcomes.probHigher >= deckOutcomes.probLower ? 'HIGHER' : 'LOWER';
      } else if (autoConfig.strategy === 'higher') {
        chosenPrediction = deckOutcomes.higherCount > 0 ? 'HIGHER' : 'LOWER';
      } else if (autoConfig.strategy === 'lower') {
        chosenPrediction = deckOutcomes.lowerCount > 0 ? 'LOWER' : 'HIGHER';
      } else {
        // Random
        chosenPrediction = Math.random() > 0.5 ? 'HIGHER' : 'LOWER';
        if (chosenPrediction === 'HIGHER' && deckOutcomes.higherCount === 0) chosenPrediction = 'LOWER';
        if (chosenPrediction === 'LOWER' && deckOutcomes.lowerCount === 0) chosenPrediction = 'HIGHER';
      }

      autoTimeoutRef.current = window.setTimeout(() => {
        handleMakePrediction(chosenPrediction);
      }, 650);

      return () => {
        if (autoTimeoutRef.current) window.clearTimeout(autoTimeoutRef.current);
      };
    }

    // Step 2: In CASHED_OUT or ROUND_LOST, prepare next round
    if (gameState === 'CASHED_OUT' || gameState === 'ROUND_LOST') {
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

      autoTimeoutRef.current = window.setTimeout(() => {
        setGameState('BETTING');
        handleStartRound();
      }, 900);

      return () => {
        if (autoTimeoutRef.current) window.clearTimeout(autoTimeoutRef.current);
      };
    }
  }, [
    gameState,
    isAutoPlayRunning,
    currentCard,
    correctStreak,
    autoConfig,
    autoRoundsLeft,
    bet,
    deckOutcomes,
    handleCashOut,
    handleMakePrediction,
    handleStartRound,
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

  // Render suit symbol icon
  const renderSuitIcon = (suit: string, className = 'w-4 h-4') => {
    switch (suit) {
      case 'hearts':
        return <span className={`text-red-500 font-serif leading-none ${className}`}>♥</span>;
      case 'diamonds':
        return <span className={`text-red-500 font-serif leading-none ${className}`}>♦</span>;
      case 'clubs':
        return <span className={`text-slate-900 font-serif leading-none ${className}`}>♣</span>;
      case 'spades':
      default:
        return <span className={`text-slate-900 font-serif leading-none ${className}`}>♠</span>;
    }
  };

  return (
    <div className="relative min-h-screen bg-[#07090f] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Coin Celebration Overlay for high multiplier cash-outs */}
      {showCelebration && (
        <CoinCelebration
          active={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {/* Rules Drawer */}
      <InGameRuleDrawer
        gameId="hilo"
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
              if (autoTimeoutRef.current) window.clearTimeout(autoTimeoutRef.current);
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
                ROYAL HI-LO
              </h1>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-amber-200/60">
                <span>52 Cards Single Deck</span>
                <span aria-hidden="true">·</span>
                <span>Aces High</span>
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
            {profile.coins < HILO_MIN_BET && (
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
              Auto Play Active: Round {autoConfig.rounds - autoRoundsLeft + 1} of {autoConfig.rounds} · Target Streak: {autoConfig.targetStreak}
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
      <main className="flex-1 w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 py-3 sm:py-5 flex flex-col gap-4">
        {/* TOP STATUS BAR: CURRENT STREAK, MULTIPLIER & POTENTIAL PAYOUT */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 rounded-2xl bg-[#0e121d] border border-amber-500/20 shadow-md text-center">
          <div className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Correct Streak</span>
            <div className="flex items-center gap-1 text-sm sm:text-lg font-black font-mono text-amber-300">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{correctStreak}</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Multiplier</span>
            <div className="text-sm sm:text-lg font-black font-mono text-emerald-400">
              {formatHiLoMultiplier(currentMultiplier)}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-1 sm:p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Potential Return</span>
            <div className="text-sm sm:text-lg font-black font-mono text-yellow-300 tabular-nums">
              {currentPotentialPayout.toLocaleString()} <span className="text-xs text-slate-400 font-normal">coins</span>
            </div>
          </div>
        </div>

        {/* 2-COLUMN ARENA: (CARD TABLE & REVEALED SEQUENCE) & (PREDICTION & BET CONTROLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT 7-8 COLS: CASINO CARD TABLE & PLAYING CARD */}
          <div className="lg:col-span-8 flex flex-col gap-3.5">
            {/* CARD TABLE FELT CANVAS */}
            <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-b from-[#0c241b] via-[#091b14] to-[#07130e] border-2 border-amber-500/40 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px]">
              {/* Table felt texture & gold rim watermark */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.12),transparent_70%)] pointer-events-none" />
              <div className="absolute top-3 left-4 text-[10px] font-serif font-black tracking-widest text-amber-400/60 uppercase">
                ROYAL ACE CASINO SALON
              </div>
              <div className="absolute top-3 right-4 text-[10px] font-mono text-slate-400">
                Cards Remaining: {remainingDeck.length} / 51
              </div>

              {/* CENTER ACTIVE CARD PRESENTATION */}
              <div className="relative my-4 flex flex-col items-center">
                {currentCard ? (
                  <div
                    className={`relative w-36 h-52 sm:w-44 sm:h-64 rounded-2xl bg-white text-slate-950 shadow-2xl p-3 flex flex-col justify-between border-2 border-slate-200 transition-all duration-300 ${
                      isFlipping ? 'scale-90 opacity-60 rotate-6' : 'scale-100 opacity-100'
                    }`}
                  >
                    {/* Top-left rank & suit */}
                    <div className="flex flex-col items-center leading-none self-start">
                      <span className={`text-xl sm:text-2xl font-black font-serif ${currentCard.color === 'red' ? 'text-red-600' : 'text-slate-950'}`}>
                        {currentCard.symbol}
                      </span>
                      <span className="text-sm sm:text-base leading-none">
                        {renderSuitIcon(currentCard.suit, 'text-base')}
                      </span>
                    </div>

                    {/* Center big suit art */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-6xl sm:text-7xl opacity-90">
                        {renderSuitIcon(currentCard.suit, 'text-6xl sm:text-7xl')}
                      </span>
                      <span className="text-[10px] font-serif font-bold text-slate-400 tracking-widest uppercase mt-1">
                        ROYAL ACE
                      </span>
                    </div>

                    {/* Bottom-right rank & suit (inverted) */}
                    <div className="flex flex-col items-center leading-none self-end rotate-180">
                      <span className={`text-xl sm:text-2xl font-black font-serif ${currentCard.color === 'red' ? 'text-red-600' : 'text-slate-950'}`}>
                        {currentCard.symbol}
                      </span>
                      <span className="text-sm sm:text-base leading-none">
                        {renderSuitIcon(currentCard.suit, 'text-base')}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Waiting for start placeholder */
                  <div className="w-36 h-52 sm:w-44 sm:h-64 rounded-2xl bg-gradient-to-br from-[#121624] to-[#0a0d17] border-2 border-dashed border-amber-500/40 flex flex-col items-center justify-center p-4 text-center">
                    <Sparkles className="w-8 h-8 text-amber-400 mb-2 animate-pulse" />
                    <span className="text-xs font-serif font-bold text-amber-200">Place Bet &amp; Deal</span>
                    <span className="text-[10px] text-slate-400 mt-1">To reveal your reference card</span>
                  </div>
                )}

                {/* Outcome message feedback under active card */}
                {lastMessage && (
                  <div className="mt-3 px-3 py-1 rounded-full bg-black/60 border border-amber-500/30 text-[11px] font-semibold text-amber-300 text-center animate-in fade-in">
                    {lastMessage}
                  </div>
                )}
              </div>

              {/* CARD ODDS & REMAINING BREAKDOWN STRIP */}
              {currentCard && gameState === 'PREDICTING' && (
                <div className="w-full max-w-md grid grid-cols-3 gap-2 px-3 py-2 rounded-2xl bg-black/50 border border-emerald-500/20 text-center text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Higher Cards</span>
                    <div className="font-mono font-bold text-emerald-400">
                      {deckOutcomes.higherCount} ({Math.round(deckOutcomes.probHigher * 100)}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Equal / Push</span>
                    <div className="font-mono font-bold text-cyan-400">
                      {deckOutcomes.tieCount} ({Math.round(deckOutcomes.probTie * 100)}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Lower Cards</span>
                    <div className="font-mono font-bold text-amber-400">
                      {deckOutcomes.lowerCount} ({Math.round(deckOutcomes.probLower * 100)}%)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PREVIOUS CARDS REVEALED TRAIL */}
            <div className="p-3 sm:p-4 rounded-3xl bg-[#0e121d] border border-slate-800 shadow-xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Round Cards History ({previousCards.length})</span>
                <span className="text-[10px]">Aces High = 14</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                {previousCards.length === 0 ? (
                  <span className="text-xs text-slate-500 py-2">No cards dealt yet. Start a round to begin.</span>
                ) : (
                  previousCards.map((c, idx) => {
                    const step = steps[idx - 1]; // step leading to this card

                    return (
                      <div key={idx} className="flex items-center gap-1.5 shrink-0">
                        {/* Step indicator arrow */}
                        {step && (
                          <div className={`px-1 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${
                            step.outcome === 'WIN'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : step.outcome === 'PUSH'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                          }`}>
                            {step.prediction === 'HIGHER' ? '↑' : '↓'}
                          </div>
                        )}

                        {/* Mini Card */}
                        <div className={`w-10 h-14 rounded-lg bg-white flex flex-col items-center justify-center p-1 shadow-md border ${
                          idx === previousCards.length - 1 ? 'ring-2 ring-amber-400' : 'border-slate-300'
                        }`}>
                          <span className={`text-xs font-black font-serif leading-none ${c.color === 'red' ? 'text-red-600' : 'text-slate-950'}`}>
                            {c.symbol}
                          </span>
                          <span className="text-xs leading-none mt-0.5">
                            {renderSuitIcon(c.suit, 'text-xs')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 4-5 COLS: PREDICTION BUTTONS, CASH OUT & BET CONTROLS */}
          <div className="lg:col-span-4 flex flex-col gap-3.5">
            {/* PREDICTION CONTROLS CARD */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-[#101422] to-[#0b0e18] border border-amber-500/30 shadow-xl flex flex-col gap-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-serif font-bold text-slate-200">Make Prediction</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  97% Theoretical RTP
                </span>
              </div>

              {/* HIGHER / LOWER PRIMARY BUTTONS */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* HIGHER BUTTON */}
                <button
                  type="button"
                  disabled={
                    gameState !== 'PREDICTING' ||
                    isAutoPlayRunning ||
                    deckOutcomes.higherCount === 0 ||
                    deckOutcomes.probHigher <= 0
                  }
                  onClick={() => handleMakePrediction('HIGHER')}
                  className={`relative p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all transform active:scale-95 ${
                    gameState === 'PREDICTING' && deckOutcomes.higherCount > 0
                      ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400 cursor-pointer'
                      : 'bg-slate-900 border border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-serif font-black text-sm sm:text-base tracking-wider uppercase">
                    <ArrowUp className="w-5 h-5" />
                    <span>HIGHER</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-200">
                    {deckOutcomes.multiplierHigher > 0 ? formatHiLoMultiplier(deckOutcomes.multiplierHigher) : '—'}
                  </span>
                  <span className="text-[10px] text-emerald-300/80">
                    {deckOutcomes.probHigher > 0 ? `${(deckOutcomes.probHigher * 100).toFixed(1)}% chance` : 'Impossible (Ace)'}
                  </span>
                </button>

                {/* LOWER BUTTON */}
                <button
                  type="button"
                  disabled={
                    gameState !== 'PREDICTING' ||
                    isAutoPlayRunning ||
                    deckOutcomes.lowerCount === 0 ||
                    deckOutcomes.probLower <= 0
                  }
                  onClick={() => handleMakePrediction('LOWER')}
                  className={`relative p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all transform active:scale-95 ${
                    gameState === 'PREDICTING' && deckOutcomes.lowerCount > 0
                      ? 'bg-gradient-to-b from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 text-white shadow-lg shadow-amber-900/40 ring-1 ring-amber-400 cursor-pointer'
                      : 'bg-slate-900 border border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-serif font-black text-sm sm:text-base tracking-wider uppercase">
                    <ArrowDown className="w-5 h-5" />
                    <span>LOWER</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-yellow-200">
                    {deckOutcomes.multiplierLower > 0 ? formatHiLoMultiplier(deckOutcomes.multiplierLower) : '—'}
                  </span>
                  <span className="text-[10px] text-yellow-300/80">
                    {deckOutcomes.probLower > 0 ? `${(deckOutcomes.probLower * 100).toFixed(1)}% chance` : 'Impossible (2)'}
                  </span>
                </button>
              </div>

              {/* CASH OUT BUTTON (WHEN STREAK >= 1) */}
              {gameState === 'PREDICTING' && correctStreak > 0 && (
                <button
                  type="button"
                  disabled={isAutoPlayRunning}
                  onClick={handleCashOut}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 active:scale-98 transition-transform"
                >
                  <Trophy className="w-4 h-4 fill-slate-950" />
                  <span>CASH OUT ({currentPotentialPayout.toLocaleString()} COINS)</span>
                </button>
              )}

              {/* START NEW ROUND BUTTON (BETTING / ROUND OVER) */}
              {gameState !== 'PREDICTING' && gameState !== 'REVEALING' && !isAutoPlayMode && (
                <button
                  type="button"
                  disabled={profile.coins < bet}
                  onClick={handleStartRound}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-40"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>DEAL CARDS ({bet} COINS)</span>
                </button>
              )}
            </div>

            {/* WAGER & AUTO PLAY SETTINGS */}
            <div className="p-4 rounded-3xl bg-[#0e121d] border border-amber-500/20 shadow-xl flex flex-col gap-3.5">
              {/* Single Draw vs Auto Play Switch */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning}
                  onClick={() => setIsAutoPlayMode(false)}
                  className={`py-1.5 rounded-lg transition-all ${
                    !isAutoPlayMode
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning}
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

                {/* Input & Quick Multipliers */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning || bet <= HILO_MIN_BET}
                    onClick={() => handleMultiplyBet(0.5)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-300 disabled:opacity-40"
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning || bet * 2 > HILO_MAX_BET}
                    onClick={() => handleMultiplyBet(2)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-300 disabled:opacity-40"
                  >
                    2×
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="number"
                      disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning}
                      value={bet}
                      onChange={e => handleSetBet(parseInt(e.target.value) || HILO_MIN_BET)}
                      min={HILO_MIN_BET}
                      max={HILO_MAX_BET}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-xs sm:text-sm text-center text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning}
                    onClick={() => handleSetBet(Math.min(HILO_MAX_BET, profile.coins))}
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
                      disabled={gameState === 'PREDICTING' || gameState === 'REVEALING' || isAutoPlayRunning}
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

              {/* AUTO PLAY CONFIGURATION */}
              {isAutoPlayMode && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Rounds:</span>
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

                  {/* Cash Out Target Streak */}
                  <div className="flex items-center justify-between text-slate-400 pt-1">
                    <span>Target Streak:</span>
                    <span className="font-bold text-amber-300 font-mono">Cash out at {autoConfig.targetStreak}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        disabled={isAutoPlayRunning}
                        onClick={() => setAutoConfig(prev => ({ ...prev, targetStreak: s }))}
                        className={`py-1 rounded-lg text-xs font-bold ${
                          autoConfig.targetStreak === s
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {s} {s === 1 ? 'Win' : 'Wins'}
                      </button>
                    ))}
                  </div>

                  {/* Strategy Choice */}
                  <div className="flex items-center justify-between text-slate-400 pt-1">
                    <span>Strategy:</span>
                    <select
                      disabled={isAutoPlayRunning}
                      value={autoConfig.strategy}
                      onChange={e =>
                        setAutoConfig(prev => ({ ...prev, strategy: e.target.value as any }))
                      }
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-400"
                    >
                      <option value="smart">Smart (Best Odds)</option>
                      <option value="higher">Always Higher</option>
                      <option value="lower">Always Lower</option>
                      <option value="random">Random Prediction</option>
                    </select>
                  </div>

                  {/* Auto Play Start/Stop button */}
                  <div className="pt-2">
                    {isAutoPlayRunning ? (
                      <button
                        type="button"
                        onClick={() => handleStopAutoPlay('Auto Play halted.')}
                        className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-serif font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>STOP AUTO PLAY</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={profile.coins < bet}
                        onClick={handleStartAutoPlay}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-950" />
                        <span>START AUTO ({autoConfig.rounds} ROUNDS)</span>
                      </button>
                    )}
                  </div>
                </div>
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
                <h2 className="font-serif font-bold text-base sm:text-lg">Royal Hi-Lo History &amp; Statistics</h2>
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
                <div className="text-slate-400 text-[10px]">Longest Streak</div>
                <div className="font-mono font-bold text-sm text-amber-300">{stats.longestStreak}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[10px]">Highest Multiplier</div>
                <div className="font-mono font-bold text-sm text-emerald-400">
                  {stats.highestMultiplier > 0 ? formatHiLoMultiplier(stats.highestMultiplier) : '—'}
                </div>
              </div>
            </div>

            {/* Recent Rounds Table */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 text-xs">
              {history.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No rounds recorded yet. Place your wager and deal the first card!
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
                          {round.outcome === 'CASHED_OUT' ? 'Cashed Out' : 'Lost'} ({round.correctStreak} Streak)
                        </span>
                        {round.finalMultiplier > 0 && (
                          <span className="font-mono text-amber-400 font-bold">
                            {formatHiLoMultiplier(round.finalMultiplier)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Bet: {round.bet} coins · {new Date(round.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-mono font-bold ${round.payout > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {round.payout > 0 ? `+${round.payout.toLocaleString()}` : '0'} coins
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
