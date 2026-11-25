import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  DealNoDealState,
  DealBriefcase,
  BankerOfferSnapshot,
  DealFinalChoice,
  DealNoDealRoundResult,
} from '../../types';
import {
  DEAL_MIN_BET,
  DEAL_MAX_BET,
  DEAL_DEFAULT_BET,
  calculateDealCoins,
  calculateBankerOffer,
  formatDealMultiplier,
  getCasesToOpenForRound,
} from './dealMath';
import {
  createShuffledBriefcases,
  validateDealBet,
  loadDealHistory,
  appendDealHistoryRecord,
  calculateDealStats,
} from './dealLogic';
import { BriefcaseTile } from './BriefcaseTile';
import { PrizeColumn } from './PrizeBoard';
import { CaseRevealModal } from './CaseRevealModal';
import { BankerOfferModal } from './BankerOfferModal';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Coins,
  History,
  Play,
  RotateCcw,
  Trophy,
  AlertCircle,
  X,
  Lock,
  ArrowLeftRight,
  ShieldCheck,
  RefreshCw,
  Award,
  Sparkles,
} from 'lucide-react';

interface DealNoDealGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

const BET_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export const DealNoDealGame: React.FC<DealNoDealGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  // --- Core Game State Machine ---
  const [gameState, setGameState] = useState<DealNoDealState>('BETTING');
  const [betInput, setBetInput] = useState<number>(DEAL_DEFAULT_BET);
  const [lockedBet, setLockedBet] = useState<number>(DEAL_DEFAULT_BET);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [briefcases, setBriefcases] = useState<DealBriefcase[]>(() =>
    createShuffledBriefcases()
  );

  // --- Round Progress & Active Offers ---
  const [playerCaseNumber, setPlayerCaseNumber] = useState<number | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [casesToOpenInRound, setCasesToOpenInRound] = useState<number>(
    getCasesToOpenForRound(1)
  );
  const [openingCase, setOpeningCase] = useState<{
    caseNumber: number;
    multiplier: number;
  } | null>(null);
  const [lastEliminatedMultiplier, setLastEliminatedMultiplier] = useState<number | null>(null);
  const [recentlySelectedCase, setRecentlySelectedCase] = useState<number | null>(null);

  const [currentOffer, setCurrentOffer] = useState<BankerOfferSnapshot | null>(null);
  const [offersHistory, setOffersHistory] = useState<BankerOfferSnapshot[]>([]);

  // --- Final Keep/Swap & Settlement ---
  const [finalChoicePending, setFinalChoicePending] = useState<{
    choice: 'KEEP' | 'SWAP';
    chosenCaseNumber: number;
    chosenMultiplier: number;
  } | null>(null);
  const [settledResult, setSettledResult] = useState<DealNoDealRoundResult | null>(null);

  // --- UI Modals & Feedback ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<DealNoDealRoundResult[]>(() => loadDealHistory());
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // --- Concurrency, Animation Timer & Single-Settlement Guards ---
  const settledRoundIdsRef = useRef<Set<string>>(new Set());
  const actionLockRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);
  const isMountedRef = useRef<boolean>(true);

  const stats = useMemo(() => calculateDealStats(history), [history]);

  const registerTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter(t => t !== id);
      if (isMountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // --- Derived Board Metrics ---
  const displayBet = gameState === 'BETTING' ? betInput : lockedBet;

  const eliminatedMultipliers = useMemo(() => {
    const set = new Set<number>();
    for (const c of briefcases) {
      if (c.isOpened) set.add(c.multiplier);
    }
    return set;
  }, [briefcases]);

  const remainingCases = useMemo(
    () => briefcases.filter(c => !c.isOpened),
    [briefcases]
  );

  const { lowestRemaining, highestRemaining } = useMemo(() => {
    if (remainingCases.length === 0) {
      return { lowestRemaining: null, highestRemaining: null };
    }
    let low = Infinity;
    let high = -Infinity;
    for (const c of remainingCases) {
      if (c.multiplier < low) low = c.multiplier;
      if (c.multiplier > high) high = c.multiplier;
    }
    return { lowestRemaining: low, highestRemaining: high };
  }, [remainingCases]);

  const otherFinalCase = useMemo(() => {
    if (remainingCases.length !== 2 || playerCaseNumber === null) return null;
    return remainingCases.find(c => c.caseNumber !== playerCaseNumber) ?? null;
  }, [remainingCases, playerCaseNumber]);

  const playerCaseObj = useMemo(() => {
    if (playerCaseNumber === null) return null;
    return briefcases.find(c => c.caseNumber === playerCaseNumber) ?? null;
  }, [briefcases, playerCaseNumber]);

  // --- Atomic Single Settlement Helper ---
  const settleGameOnce = useCallback(
    (params: {
      finalChoice: DealFinalChoice;
      finalMultiplier: number;
      grossPayout: number;
      finalCaseNumber: number | null;
      acceptedOffer: BankerOfferSnapshot | null;
      allOffers: BankerOfferSnapshot[];
    }) => {
      if (!activeRoundId || playerCaseObj === null) return;
      if (settledRoundIdsRef.current.has(activeRoundId)) {
        return; // Strictly prevent duplicate settlements or double payouts
      }
      settledRoundIdsRef.current.add(activeRoundId);

      const {
        finalChoice,
        finalMultiplier,
        grossPayout,
        finalCaseNumber,
        acceptedOffer,
        allOffers,
      } = params;

      const netProfit = grossPayout - lockedBet;

      if (grossPayout > 0) {
        const desc =
          finalChoice === 'DEAL'
            ? `Royal Deal or No Deal — Accepted Banker Deal (${formatDealMultiplier(finalMultiplier)})`
            : `Royal Deal or No Deal — ${finalChoice === 'KEEP' ? 'Kept' : 'Swapped to'} Case #${finalCaseNumber} (${formatDealMultiplier(finalMultiplier)})`;

        storageManager.executeTransaction('win', 'deal_no_deal', grossPayout, desc);
      }

      const isProfitable = netProfit > 0;
      storageManager.recordGameRound('deal_no_deal', isProfitable, grossPayout);

      // Update achievements cleanly
      if (finalChoice === 'DEAL' && netProfit > 0) {
        storageManager.updateAchievementProgress('dnd_first_deal', 1);
      }
      if (finalMultiplier >= 100) {
        storageManager.updateAchievementProgress('dnd_jackpot_case', 1);
      }

      onUpdateProfile();

      if (netProfit > 0) {
        soundManager.playWin();
        setShowCelebration(true);
        registerTimer(() => setShowCelebration(false), 3200);
      } else if (netProfit === 0) {
        soundManager.playOfferReveal();
      } else {
        soundManager.playLoss();
      }

      const openedCount = briefcases.filter(c => c.isOpened).length;

      const record: DealNoDealRoundResult = {
        id: activeRoundId,
        timestamp: Date.now(),
        bet: lockedBet,
        originalCaseNumber: playerCaseObj.caseNumber,
        originalCaseMultiplier: playerCaseObj.multiplier,
        finalCaseNumber,
        casesOpenedCount: openedCount,
        offersReceived: allOffers,
        acceptedOffer,
        finalChoice,
        finalMultiplier,
        grossPayout,
        netProfit,
      };

      const updatedHistory = appendDealHistoryRecord(record);
      setHistory(updatedHistory);
      setSettledResult(record);
      setCurrentOffer(null);
      setFinalChoicePending(null);
      setOpeningCase(null);
      setGameState('SETTLED');
      actionLockRef.current = false;
    },
    [activeRoundId, playerCaseObj, lockedBet, briefcases, onUpdateProfile, registerTimer]
  );

  // --- Betting Handlers ---
  const handleBetInputChange = (val: number) => {
    if (gameState !== 'BETTING') return;
    const clamped = Math.max(0, Math.min(DEAL_MAX_BET, Math.floor(val)));
    setBetInput(clamped);
    setErrorMessage(null);
  };

  const handleQuickReload = () => {
    if (gameState !== 'BETTING' && gameState !== 'SETTLED') return;
    const res = storageManager.claimEmergencyReload();
    if (res.success) {
      soundManager.playWin();
      onUpdateProfile();
      setErrorMessage(null);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleStartGame = () => {
    if (gameState !== 'BETTING' || actionLockRef.current) return;

    const check = validateDealBet(betInput, profile.coins);
    if (!check.valid) {
      setErrorMessage(check.error || 'Please enter a valid wager.');
      soundManager.playButtonClick();
      return;
    }

    actionLockRef.current = true;

    // Atomic single bet deduction BEFORE round starts
    const tx = storageManager.executeTransaction(
      'bet',
      'deal_no_deal',
      betInput,
      `Royal Deal or No Deal Entry Bet (${betInput.toLocaleString()} coins)`
    );
    if (!tx.success) {
      setErrorMessage(tx.error || 'Unable to start game.');
      actionLockRef.current = false;
      return;
    }
    onUpdateProfile();

    clearAllTimers();
    const freshCases = createShuffledBriefcases();
    const roundId = `dnd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setActiveRoundId(roundId);
    setLockedBet(betInput);
    setBriefcases(freshCases);
    setPlayerCaseNumber(null);
    setRoundNumber(1);
    setCasesToOpenInRound(getCasesToOpenForRound(1));
    setOpeningCase(null);
    setLastEliminatedMultiplier(null);
    setRecentlySelectedCase(null);
    setCurrentOffer(null);
    setOffersHistory([]);
    setFinalChoicePending(null);
    setSettledResult(null);
    setShowCelebration(false);
    setErrorMessage(null);
    setGameState('BRIEFCASE_SELECTION');
    soundManager.playChipStack();
    actionLockRef.current = false;
  };

  // --- Briefcase Selection & Opening ---
  const handleSelectBriefcase = (caseNumber: number) => {
    if (actionLockRef.current) return;

    // Phase A: Selecting Personal Case
    if (gameState === 'BRIEFCASE_SELECTION') {
      actionLockRef.current = true;
      soundManager.playBriefcaseSelect();
      setPlayerCaseNumber(caseNumber);
      setRecentlySelectedCase(caseNumber);
      setBriefcases(prev =>
        prev.map(c =>
          c.caseNumber === caseNumber ? { ...c, isPlayerCase: true } : c
        )
      );

      registerTimer(() => {
        setRecentlySelectedCase(null);
        setRoundNumber(1);
        setCasesToOpenInRound(getCasesToOpenForRound(1));
        setGameState('OPENING_CASES');
        actionLockRef.current = false;
      }, 420);
      return;
    }

    // Phase B: Opening an Elimination Briefcase
    if (gameState !== 'OPENING_CASES') return;
    if (casesToOpenInRound <= 0) return;

    const target = briefcases.find(c => c.caseNumber === caseNumber);
    if (!target || target.isOpened || target.isPlayerCase) return;

    actionLockRef.current = true;
    soundManager.playBriefcaseSelect();
    setOpeningCase({
      caseNumber: target.caseNumber,
      multiplier: target.multiplier,
    });
    setGameState('CASE_REVEAL');
  };

  // Triggered when CaseRevealModal completes for a regular elimination case
  const handleCaseRevealComplete = useCallback(() => {
    if (gameState !== 'CASE_REVEAL' || !openingCase) return;

    const openedNum = openingCase.caseNumber;
    const openedMult = openingCase.multiplier;

    const updatedCases = briefcases.map(c =>
      c.caseNumber === openedNum ? { ...c, isOpened: true } : c
    );

    setBriefcases(updatedCases);
    setLastEliminatedMultiplier(openedMult);
    setOpeningCase(null);

    const nextToOpen = Math.max(0, casesToOpenInRound - 1);
    setCasesToOpenInRound(nextToOpen);

    const remainingCount = updatedCases.filter(c => !c.isOpened).length;

    // Trigger Banker offer if round quota is done OR down to final 2 cases
    if (nextToOpen === 0 || remainingCount <= 2) {
      const nextOffer = calculateBankerOffer(updatedCases, lockedBet, roundNumber);
      setCurrentOffer(nextOffer);
      setGameState('BANKER_CALL');
      soundManager.playBankerPhoneRing();

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      registerTimer(() => {
        setGameState('BANKER_OFFER');
        soundManager.playOfferReveal();
        actionLockRef.current = false;
      }, prefersReducedMotion ? 220 : 1450);
    } else {
      setGameState('OPENING_CASES');
      actionLockRef.current = false;
    }
  }, [gameState, openingCase, briefcases, casesToOpenInRound, lockedBet, roundNumber, registerTimer]);

  // --- Banker Offer Decisions ---
  const handleClickDeal = () => {
    if (gameState !== 'BANKER_OFFER' || !currentOffer) return;
    soundManager.playButtonClick();
    setGameState('DEAL_CONFIRMATION');
  };

  const handleCancelDealConfirm = () => {
    if (gameState !== 'DEAL_CONFIRMATION') return;
    soundManager.playButtonClick();
    setGameState('BANKER_OFFER');
  };

  const handleConfirmDeal = () => {
    if (gameState !== 'DEAL_CONFIRMATION' || !currentOffer || actionLockRef.current) return;
    actionLockRef.current = true;

    const acceptedSnapshot: BankerOfferSnapshot = {
      ...currentOffer,
      decision: 'DEAL',
    };
    const updatedOffers = [...offersHistory, acceptedSnapshot];
    setOffersHistory(updatedOffers);

    settleGameOnce({
      finalChoice: 'DEAL',
      finalMultiplier: acceptedSnapshot.offerMultiplier,
      grossPayout: acceptedSnapshot.offerCoins,
      finalCaseNumber: null,
      acceptedOffer: acceptedSnapshot,
      allOffers: updatedOffers,
    });
  };

  const handleClickNoDeal = () => {
    if (gameState !== 'BANKER_OFFER' || !currentOffer || actionLockRef.current) return;
    actionLockRef.current = true;

    const rejectedSnapshot: BankerOfferSnapshot = {
      ...currentOffer,
      decision: 'NO_DEAL',
    };
    const updatedOffers = [...offersHistory, rejectedSnapshot];
    setOffersHistory(updatedOffers);
    soundManager.playNoDealSlam();
    setGameState('NO_DEAL_RESPONSE');

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    registerTimer(() => {
      const unopenedCount = briefcases.filter(c => !c.isOpened).length;
      setCurrentOffer(null);

      if (unopenedCount <= 2) {
        storageManager.updateAchievementProgress('dnd_nerves_of_steel', 1);
        setGameState('FINAL_DECISION');
        actionLockRef.current = false;
      } else {
        const nextRound = roundNumber + 1;
        setRoundNumber(nextRound);
        setCasesToOpenInRound(getCasesToOpenForRound(nextRound));
        setGameState('OPENING_CASES');
        actionLockRef.current = false;
      }
    }, prefersReducedMotion ? 300 : 1350);
  };

  // --- Final Keep or Swap Decision ---
  const handleFinalKeepOrSwap = (choice: 'KEEP' | 'SWAP') => {
    if (gameState !== 'FINAL_DECISION' || !playerCaseObj || !otherFinalCase || actionLockRef.current) {
      return;
    }
    actionLockRef.current = true;
    soundManager.playBriefcaseSelect();

    const chosen = choice === 'KEEP' ? playerCaseObj : otherFinalCase;
    setFinalChoicePending({
      choice,
      chosenCaseNumber: chosen.caseNumber,
      chosenMultiplier: chosen.multiplier,
    });
    setGameState('FINAL_REVEAL');
  };

  const handleFinalRevealComplete = useCallback(() => {
    if (gameState !== 'FINAL_REVEAL' || !finalChoicePending) return;

    const grossPayout = calculateDealCoins(lockedBet, finalChoicePending.chosenMultiplier);

    settleGameOnce({
      finalChoice: finalChoicePending.choice,
      finalMultiplier: finalChoicePending.chosenMultiplier,
      grossPayout,
      finalCaseNumber: finalChoicePending.chosenCaseNumber,
      acceptedOffer: null,
      allOffers: offersHistory,
    });
  }, [gameState, finalChoicePending, lockedBet, offersHistory, settleGameOnce]);

  const handlePlayAgain = () => {
    soundManager.playButtonClick();
    clearAllTimers();
    actionLockRef.current = false;
    setActiveRoundId(null);
    setBriefcases(createShuffledBriefcases());
    setPlayerCaseNumber(null);
    setRoundNumber(1);
    setCasesToOpenInRound(getCasesToOpenForRound(1));
    setOpeningCase(null);
    setLastEliminatedMultiplier(null);
    setRecentlySelectedCase(null);
    setCurrentOffer(null);
    setOffersHistory([]);
    setFinalChoicePending(null);
    setSettledResult(null);
    setShowCelebration(false);
    setErrorMessage(null);
    setGameState('BETTING');
  };

  const isRoundActive =
    gameState !== 'BETTING' && gameState !== 'SETTLED';

  const statusHeadline = useMemo(() => {
    switch (gameState) {
      case 'BETTING':
        return 'Place your wager to open the 26-briefcase stage';
      case 'BRIEFCASE_SELECTION':
        return 'Select your personal briefcase (1–26)';
      case 'OPENING_CASES':
        return `Round ${roundNumber} · Open ${casesToOpenInRound} more ${
          casesToOpenInRound === 1 ? 'case' : 'cases'
        } before the Banker calls`;
      case 'CASE_REVEAL':
        return openingCase ? `Revealing Briefcase #${openingCase.caseNumber}...` : 'Opening briefcase...';
      case 'BANKER_CALL':
        return 'The Banker is calling the studio...';
      case 'BANKER_OFFER':
        return 'Banker Offer on the table — Deal or No Deal?';
      case 'DEAL_CONFIRMATION':
        return 'Confirm your Deal acceptance';
      case 'NO_DEAL_RESPONSE':
        return 'No Deal! Preparing next round...';
      case 'FINAL_DECISION':
        return 'Final Two Cases — Keep Your Case or Swap?';
      case 'FINAL_REVEAL':
        return 'Opening your final briefcase...';
      case 'SETTLED':
        return 'Game Complete';
    }
  }, [gameState, roundNumber, casesToOpenInRound, openingCase]);

  const minPotentialCoins = calculateDealCoins(displayBet, 0.01);
  const maxPotentialCoins = calculateDealCoins(displayBet, 1000);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-slate-100 pb-10">
      <CoinCelebration active={showCelebration} />

      {/* Top Navigation & Wallet Bar */}
      <header className="sticky top-0 z-30 border-b border-amber-500/20 bg-[#080d1c]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToLobby}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300 sm:px-3 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Exit</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 shrink-0 text-amber-400" />
                <h1 className="truncate font-serif text-sm font-black tracking-wide text-amber-300 sm:text-lg">
                  ROYAL DEAL OR NO DEAL
                </h1>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                26 Briefcases · Dynamic Banker Offers · Up to 1,000x
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 tabular-nums sm:px-3 sm:text-sm">
              <Coins className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{profile.coins.toLocaleString()}</span>
            </div>

            {profile.coins < 50 && !isRoundActive && (
              <button
                type="button"
                onClick={handleQuickReload}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
                title="VIP Courtesy Reload (+1,000 coins)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">+1K</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setIsHistoryOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300"
              aria-label="Game History and Statistics"
            >
              <History className="h-4 w-4" />
              <span className="hidden md:inline">History</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setIsRulesOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300"
              aria-label="Deal or No Deal Rules"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline">Rules</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Content */}
      <main className="mx-auto mt-3 max-w-7xl px-3 sm:mt-5 sm:px-5">
        {/* BETTING SETUP STAGE */}
        {gameState === 'BETTING' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
            {/* Left / Main Wager Configuration Card */}
            <section className="min-w-0 lg:col-span-5">
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#0e1529] to-[#090e1c] p-4 shadow-2xl sm:p-6">
                <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  VIP Studio Entry
                </div>
                <h2 className="mt-1 font-serif text-xl sm:text-2xl font-black text-white">
                  Set Your Briefcase Stake
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Choose your virtual coin wager, claim 1 of 26 golden briefcases, eliminate the rest across progressive rounds, and outsmart the Banker.
                </p>

                {/* Wager Input */}
                <div className="mt-5">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <label
                      htmlFor="dnd-bet-input"
                      className="font-bold uppercase tracking-wider text-amber-300"
                    >
                      Entry Bet
                    </label>
                    <span className="text-slate-400 tabular-nums">
                      Min {DEAL_MIN_BET} · Max {DEAL_MAX_BET.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <Coins className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                      <input
                        id="dnd-bet-input"
                        type="number"
                        min={DEAL_MIN_BET}
                        max={DEAL_MAX_BET}
                        step={10}
                        value={betInput}
                        onChange={e => handleBetInputChange(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-8 pr-3 text-sm font-bold text-white tabular-nums focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleBetInputChange(Math.max(DEAL_MIN_BET, Math.floor(betInput / 2)))
                      }
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-400/50"
                    >
                      ½
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleBetInputChange(Math.min(DEAL_MAX_BET, profile.coins, betInput * 2))
                      }
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-400/50"
                    >
                      2×
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleBetInputChange(Math.min(DEAL_MAX_BET, profile.coins))
                      }
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-amber-300 hover:border-amber-400/50"
                    >
                      MAX
                    </button>
                  </div>

                  {/* Quick Bet Chips */}
                  <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {BET_PRESETS.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        disabled={preset > profile.coins}
                        onClick={() => {
                          soundManager.playButtonClick();
                          handleBetInputChange(preset);
                        }}
                        className={`rounded-lg border py-1.5 text-xs font-bold tabular-nums transition ${
                          betInput === preset
                            ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                            : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {preset >= 1000 ? '1K' : preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prize Range Preview */}
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-slate-950/90 p-3.5 tabular-nums">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Prize Multiplier Range</span>
                    <span className="font-bold text-slate-200">0.01x – 1,000x</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Potential Coin Range</span>
                    <span className="font-black text-amber-300">
                      {minPotentialCoins.toLocaleString()} – {maxPotentialCoins.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 border-t border-slate-800/90 pt-2 text-[11px] text-slate-400">
                    Your entry bet is deducted once when starting and stays locked for the complete game.
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={betInput < DEAL_MIN_BET || betInput > profile.coins}
                  onClick={handleStartGame}
                  className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  <span>Start Game ({betInput.toLocaleString()} Coins)</span>
                </button>
              </div>

              {/* Compact Career Overview */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Games / Deals Taken
                  </div>
                  <div className="mt-0.5 text-sm font-black tabular-nums text-white">
                    {stats.gamesPlayed} / <span className="text-amber-300">{stats.dealsAccepted}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Biggest Payout
                  </div>
                  <div className="mt-0.5 text-sm font-black tabular-nums text-emerald-400">
                    {stats.biggestPayout.toLocaleString()}
                  </div>
                </div>
              </div>
            </section>

            {/* Right: Live 26-Prize Board Preview */}
            <section className="min-w-0 lg:col-span-7">
              <div className="rounded-2xl border border-slate-800 bg-[#0b1325] p-3.5 shadow-xl sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-sm sm:text-base font-black text-amber-300">
                      Official 26-Case Prize Board
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Every multiplier below is secretly assigned to one unique briefcase (1–26)
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-300 tabular-nums">
                    Bet: {displayBet.toLocaleString()} coins
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <PrizeColumn
                    tier="low"
                    bet={displayBet}
                    eliminatedMultipliers={new Set()}
                    lastEliminatedMultiplier={null}
                    lowestRemaining={0.01}
                    highestRemaining={1000}
                    compact
                  />
                  <PrizeColumn
                    tier="high"
                    bet={displayBet}
                    eliminatedMultipliers={new Set()}
                    lastEliminatedMultiplier={null}
                    lowestRemaining={0.01}
                    highestRemaining={1000}
                    compact
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ACTIVE STUDIO STAGE (BRIEFCASE_SELECTION through FINAL_REVEAL) */}
        {gameState !== 'BETTING' && gameState !== 'SETTLED' && (
          <div className="space-y-4">
            {/* Compact Studio Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-[#0b1325] px-3.5 py-2.5 sm:px-5 sm:py-3">
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-amber-200">
                  {statusHeadline}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400 tabular-nums">
                  <span>Bet: {lockedBet.toLocaleString()} coins</span>
                  <span aria-hidden="true">·</span>
                  <span>Remaining Cases: {remainingCases.length} / 26</span>
                  {playerCaseNumber !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-amber-300">
                        Your Case: #{playerCaseNumber}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {gameState === 'OPENING_CASES' && (
                <div className="shrink-0 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-center tabular-nums">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    Open Left
                  </div>
                  <div className="text-base font-black text-amber-300 leading-tight">
                    {casesToOpenInRound}
                  </div>
                </div>
              )}
            </div>

            {/* 3-Zone Desktop Layout (Low Prizes | 26 Briefcases | High Prizes), Stacked Cleanly on Mobile/Tablet */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
              {/* Desktop Left Prize Column (Low Tier) */}
              <aside className="hidden min-w-0 rounded-2xl border border-slate-800 bg-[#0b1325] p-3 lg:block lg:col-span-3">
                <PrizeColumn
                  tier="low"
                  bet={lockedBet}
                  eliminatedMultipliers={eliminatedMultipliers}
                  lastEliminatedMultiplier={lastEliminatedMultiplier}
                  lowestRemaining={lowestRemaining}
                  highestRemaining={highestRemaining}
                />
              </aside>

              {/* Center Stage: Briefcase Grid OR Final Keep/Swap Decision */}
              <section className="min-w-0 space-y-4 lg:col-span-6">
                {gameState === 'FINAL_DECISION' && playerCaseObj && otherFinalCase ? (
                  /* FINAL TWO BRIEFCASES: KEEP OR SWAP */
                  <div className="rounded-3xl border-2 border-amber-400/60 bg-gradient-to-b from-[#141a2e] via-[#0c1120] to-[#080b14] p-5 text-center shadow-2xl sm:p-7">
                    <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                      Final Two Briefcases
                    </div>
                    <h2 className="mt-1 font-serif text-xl sm:text-2xl font-black text-white">
                      Keep Your Case or Swap?
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
                      Two prizes remain on the board:{' '}
                      <strong className="text-sky-300 tabular-nums">
                        {lowestRemaining !== null ? formatDealMultiplier(lowestRemaining) : ''}
                      </strong>{' '}
                      and{' '}
                      <strong className="text-amber-300 tabular-nums">
                        {highestRemaining !== null ? formatDealMultiplier(highestRemaining) : ''}
                      </strong>
                      . Make your final choice!
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* Keep Personal Case */}
                      <button
                        type="button"
                        onClick={() => handleFinalKeepOrSwap('KEEP')}
                        className="group flex flex-col items-center rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/20 via-[#151a2e] to-slate-950 p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(251,191,36,0.28)]"
                      >
                        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
                          <ShieldCheck className="h-4 w-4" />
                          Your Original Case
                        </span>
                        <div className="mt-3 flex h-16 w-20 items-center justify-center rounded-xl border-2 border-amber-300 bg-gradient-to-b from-amber-200 to-amber-500 text-3xl font-black tabular-nums text-slate-950 shadow-lg">
                          #{playerCaseObj.caseNumber}
                        </div>
                        <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 group-hover:brightness-110">
                          Keep My Case
                        </span>
                      </button>

                      {/* Swap To Other Case */}
                      <button
                        type="button"
                        onClick={() => handleFinalKeepOrSwap('SWAP')}
                        className="group flex flex-col items-center rounded-2xl border-2 border-sky-400/70 bg-gradient-to-b from-sky-500/20 via-[#121a2d] to-slate-950 p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(56,189,248,0.25)]"
                      >
                        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-sky-300">
                          <ArrowLeftRight className="h-4 w-4" />
                          Remaining Stage Case
                        </span>
                        <div className="mt-3 flex h-16 w-20 items-center justify-center rounded-xl border-2 border-sky-300 bg-gradient-to-b from-sky-200 to-sky-500 text-3xl font-black tabular-nums text-slate-950 shadow-lg">
                          #{otherFinalCase.caseNumber}
                        </div>
                        <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 group-hover:brightness-110">
                          Swap My Case
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 26 INTERACTIVE BRIEFCASES GRID */
                  <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#0e1529] to-[#080d1a] p-3 shadow-2xl sm:p-4">
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 sm:gap-2.5">
                      {briefcases.map(bc => {
                        const selectable =
                          gameState === 'BRIEFCASE_SELECTION' ||
                          (gameState === 'OPENING_CASES' &&
                            !bc.isOpened &&
                            !bc.isPlayerCase &&
                            casesToOpenInRound > 0);

                        return (
                          <BriefcaseTile
                            key={bc.caseNumber}
                            briefcase={bc}
                            isSelectable={selectable}
                            isHighlighted={recentlySelectedCase === bc.caseNumber}
                            isOpeningTarget={openingCase?.caseNumber === bc.caseNumber}
                            onSelect={handleSelectBriefcase}
                          />
                        );
                      })}
                    </div>

                    {/* Dedicated YOUR CASE Pedestal Bar */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-slate-950/85 px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-base font-black tabular-nums text-slate-950 shadow">
                          {playerCaseNumber !== null ? `#${playerCaseNumber}` : '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-300">
                            <Lock className="h-3 w-3" />
                            <span>Your Personal Case</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {playerCaseNumber !== null
                              ? 'Locked safely on your podium until the final decision'
                              : 'Tap any numbered briefcase above to claim it'}
                          </div>
                        </div>
                      </div>

                      {offersHistory.length > 0 && (
                        <div className="text-right text-[11px] text-slate-400 tabular-nums">
                          Last Offer:{' '}
                          <span className="font-bold text-amber-300">
                            {offersHistory[offersHistory.length - 1].offerCoins.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mobile & Tablet Combined 2-Column Prize Board (hidden on lg where side rails show) */}
                <div className="rounded-2xl border border-slate-800 bg-[#0b1325] p-3 lg:hidden">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Remaining Prize Board
                    </h3>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {remainingCases.length} left
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
                    <PrizeColumn
                      tier="low"
                      bet={lockedBet}
                      eliminatedMultipliers={eliminatedMultipliers}
                      lastEliminatedMultiplier={lastEliminatedMultiplier}
                      lowestRemaining={lowestRemaining}
                      highestRemaining={highestRemaining}
                      compact
                    />
                    <PrizeColumn
                      tier="high"
                      bet={lockedBet}
                      eliminatedMultipliers={eliminatedMultipliers}
                      lastEliminatedMultiplier={lastEliminatedMultiplier}
                      lowestRemaining={lowestRemaining}
                      highestRemaining={highestRemaining}
                      compact
                    />
                  </div>
                </div>
              </section>

              {/* Desktop Right Prize Column (High Tier) */}
              <aside className="hidden min-w-0 rounded-2xl border border-slate-800 bg-[#0b1325] p-3 lg:block lg:col-span-3">
                <PrizeColumn
                  tier="high"
                  bet={lockedBet}
                  eliminatedMultipliers={eliminatedMultipliers}
                  lastEliminatedMultiplier={lastEliminatedMultiplier}
                  lowestRemaining={lowestRemaining}
                  highestRemaining={highestRemaining}
                />
              </aside>
            </div>
          </div>
        )}

        {/* GAME RESULT SCREEN (SETTLED) */}
        {gameState === 'SETTLED' && settledResult && (
          <div className="mx-auto max-w-2xl">
            <div
              className={`rounded-3xl border-2 p-5 shadow-2xl sm:p-7 ${
                settledResult.netProfit > 0
                  ? 'border-emerald-400/60 bg-gradient-to-b from-emerald-950/35 via-[#0d162a] to-[#080c16]'
                  : settledResult.netProfit === 0
                  ? 'border-amber-400/50 bg-gradient-to-b from-amber-950/25 via-[#0d1527] to-[#080c16]'
                  : 'border-rose-500/45 bg-gradient-to-b from-rose-950/25 via-[#0d1323] to-[#080c16]'
              }`}
            >
              <div className="text-center">
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${
                    settledResult.netProfit > 0
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
                      : settledResult.netProfit === 0
                      ? 'border-sky-400/50 bg-sky-500/20 text-sky-300'
                      : 'border-rose-400/50 bg-rose-500/15 text-rose-300'
                  }`}
                >
                  <Trophy className="h-7 w-7" />
                </div>

                <div className="mt-3 text-xs font-bold uppercase tracking-widest text-amber-300/90">
                  {settledResult.finalChoice === 'DEAL'
                    ? 'Deal Accepted'
                    : settledResult.finalChoice === 'KEEP'
                    ? `Kept Personal Case #${settledResult.finalCaseNumber}`
                    : `Swapped to Case #${settledResult.finalCaseNumber}`}
                </div>

                <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-black text-white">
                  {settledResult.netProfit > 0
                    ? 'Congratulations — Big Payout!'
                    : settledResult.netProfit === 0
                    ? 'Break-Even Finish'
                    : 'Tough Round — Try Again!'}
                </h2>

                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-amber-400/35 bg-slate-950/85 px-4 py-4 tabular-nums">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    Final Gross Payout ({formatDealMultiplier(settledResult.finalMultiplier)})
                  </span>
                  <span className="mt-1 text-3xl sm:text-4xl font-black text-amber-300">
                    {settledResult.grossPayout.toLocaleString()} coins
                  </span>
                  <span
                    className={`mt-1 text-sm font-bold ${
                      settledResult.netProfit > 0
                        ? 'text-emerald-400'
                        : settledResult.netProfit === 0
                        ? 'text-slate-300'
                        : 'text-rose-400'
                    }`}
                  >
                    Net Profit / Loss: {settledResult.netProfit >= 0 ? '+' : ''}
                    {settledResult.netProfit.toLocaleString()} coins
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown Grid */}
              <div className="mt-5 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 tabular-nums">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/75 px-3.5 py-2.5">
                  <span className="text-slate-400">Original Bet</span>
                  <span className="font-bold text-white">
                    {settledResult.bet.toLocaleString()} coins
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/75 px-3.5 py-2.5">
                  <span className="text-slate-400">Personal Briefcase</span>
                  <span className="font-bold text-amber-300">
                    #{settledResult.originalCaseNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/75 px-3.5 py-2.5">
                  <span className="text-slate-400">Personal Case Contained</span>
                  <span className="font-bold text-slate-100">
                    {formatDealMultiplier(settledResult.originalCaseMultiplier)} (
                    {calculateDealCoins(
                      settledResult.bet,
                      settledResult.originalCaseMultiplier
                    ).toLocaleString()}
                    )
                  </span>
                </div>

                {settledResult.acceptedOffer ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2.5">
                    <span className="text-emerald-200/80">Accepted Banker Offer</span>
                    <span className="font-bold text-emerald-300">
                      {settledResult.acceptedOffer.offerCoins.toLocaleString()} (
                      {formatDealMultiplier(settledResult.acceptedOffer.offerMultiplier)})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-950/20 px-3.5 py-2.5">
                    <span className="text-sky-200/80">Final Selected Case</span>
                    <span className="font-bold text-sky-300">
                      #{settledResult.finalCaseNumber} ({settledResult.finalChoice})
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/75 px-3.5 py-2.5 sm:col-span-2">
                  <span className="text-slate-400">Updated ROYAL ACE Wallet Balance</span>
                  <span className="font-black text-amber-300">
                    {profile.coins.toLocaleString()} coins
                  </span>
                </div>
              </div>

              {/* Post-Deal Curiosity Reveal Note */}
              {settledResult.finalChoice === 'DEAL' && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-100">
                  <strong>Did you beat the Banker?</strong> Your original briefcase (#
                  {settledResult.originalCaseNumber}) actually held{' '}
                  <span className="font-black text-amber-300">
                    {formatDealMultiplier(settledResult.originalCaseMultiplier)} (
                    {calculateDealCoins(
                      settledResult.bet,
                      settledResult.originalCaseMultiplier
                    ).toLocaleString()}{' '}
                    coins)
                  </span>
                  .{' '}
                  {settledResult.grossPayout >=
                  calculateDealCoins(
                    settledResult.bet,
                    settledResult.originalCaseMultiplier
                  )
                    ? 'Great Deal — you walked away ahead of your briefcase!'
                    : 'Your briefcase held more, but you locked in a guaranteed Banker payout!'}
                  <span className="block mt-1 text-[11px] text-slate-400">
                    (Personal briefcase contents are revealed for suspense only and are not paid in addition to your accepted Deal.)
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToLobby}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to Games</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Briefcase Opening Reveal Overlay */}
      {gameState === 'CASE_REVEAL' && openingCase && (
        <CaseRevealModal
          caseNumber={openingCase.caseNumber}
          multiplier={openingCase.multiplier}
          bet={lockedBet}
          onComplete={handleCaseRevealComplete}
        />
      )}

      {/* Final Chosen Briefcase Reveal Overlay */}
      {gameState === 'FINAL_REVEAL' && finalChoicePending && (
        <CaseRevealModal
          caseNumber={finalChoicePending.chosenCaseNumber}
          multiplier={finalChoicePending.chosenMultiplier}
          bet={lockedBet}
          isFinalReveal
          finalLabel={
            finalChoicePending.choice === 'KEEP'
              ? `Final Reveal — Keeping Your Case #${finalChoicePending.chosenCaseNumber}`
              : `Final Reveal — Swapped to Case #${finalChoicePending.chosenCaseNumber}`
          }
          onComplete={handleFinalRevealComplete}
        />
      )}

      {/* Banker Call / Offer / Deal Confirmation / No Deal Overlay */}
      {(gameState === 'BANKER_CALL' ||
        gameState === 'BANKER_OFFER' ||
        gameState === 'DEAL_CONFIRMATION' ||
        gameState === 'NO_DEAL_RESPONSE') &&
        currentOffer &&
        playerCaseNumber !== null && (
          <BankerOfferModal
            gameState={gameState}
            offer={currentOffer}
            previousOffers={offersHistory}
            originalBet={lockedBet}
            playerCaseNumber={playerCaseNumber}
            onClickDeal={handleClickDeal}
            onConfirmDeal={handleConfirmDeal}
            onCancelDealConfirm={handleCancelDealConfirm}
            onClickNoDeal={handleClickNoDeal}
          />
        )}

      {/* History & Career Statistics Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-[#090f1f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <h2 className="font-serif text-base font-black text-amber-300">
                  Royal Deal or No Deal History
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 8 Career Statistics */}
            <div className="grid grid-cols-2 gap-2 border-b border-slate-800 p-4 sm:grid-cols-4 tabular-nums">
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Games</div>
                <div className="text-sm font-black text-white">{stats.gamesPlayed}</div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Wagered</div>
                <div className="text-sm font-black text-slate-200">
                  {stats.totalWagered.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Gross Won</div>
                <div className="text-sm font-black text-emerald-400">
                  {stats.totalGrossWon.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Net Profit</div>
                <div
                  className={`text-sm font-black ${
                    stats.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {stats.totalNetProfit >= 0 ? '+' : ''}
                  {stats.totalNetProfit.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Deals Accepted</div>
                <div className="text-sm font-black text-amber-300">{stats.dealsAccepted}</div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Offers Rejected</div>
                <div className="text-sm font-black text-rose-300">{stats.dealsRejected}</div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Biggest Payout</div>
                <div className="text-sm font-black text-emerald-300">
                  {stats.biggestPayout.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Top Multiplier</div>
                <div className="text-sm font-black text-amber-300">
                  {stats.highestMultiplierWon > 0
                    ? formatDealMultiplier(stats.highestMultiplierWon)
                    : '—'}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {history.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-400/60" />
                  No completed Deal or No Deal rounds yet. Start a game to face the Banker!
                </div>
              ) : (
                history.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 ${
                      item.netProfit > 0
                        ? 'border-emerald-500/35 bg-emerald-950/20'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                      <span className="font-bold text-slate-100">
                        {item.finalChoice === 'DEAL'
                          ? 'DEAL ACCEPTED'
                          : item.finalChoice === 'KEEP'
                          ? `KEPT CASE #${item.finalCaseNumber}`
                          : `SWAPPED TO #${item.finalCaseNumber}`}{' '}
                        · Bet {item.bet.toLocaleString()}
                      </span>
                      <span
                        className={`font-black ${
                          item.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.grossPayout.toLocaleString()} ({formatDealMultiplier(item.finalMultiplier)}) · Net{' '}
                        {item.netProfit >= 0 ? '+' : ''}
                        {item.netProfit.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 tabular-nums">
                      <span>
                        Orig Case #{item.originalCaseNumber} ({formatDealMultiplier(item.originalCaseMultiplier)}) ·{' '}
                        {item.casesOpenedCount} opened · {item.offersReceived.length} offers
                      </span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Game Rules Drawer */}
      <InGameRuleDrawer
        gameId="deal_no_deal"
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
};
