import React, { useState, useEffect } from 'react';
import { Card, UserProfile, TeenPattiPlayer, TeenPattiEvaluation } from '../../types';
import { createDeck, evaluateTeenPattiHand, compareTeenPattiPlayers } from '../../utils/cards';
import { PlayingCard } from '../../components/common/PlayingCard';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  RotateCcw,
  Eye,
  Crown,
  Cpu,
  User,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface TeenPattiGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface FlyingMoney {
  id: string;
  from: 'top' | 'left' | 'right' | 'bottom';
  amount: number;
}

const AI_PLAYERS_CONFIG = [
  { name: 'Rani Meera', avatar: 'Sparkles', position: 'top' as const, personality: 'balanced' as const },
  { name: 'Raja Vikram', avatar: 'Crown', position: 'left' as const, personality: 'aggressive' as const },
  { name: 'Thakur Dev', avatar: 'Gem', position: 'right' as const, personality: 'beginner' as const },
];

export const TeenPattiGame: React.FC<TeenPattiGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [bootAmount, setBootAmount] = useState<number>(20);
  const [currentStake, setCurrentStake] = useState<number>(20);
  const [pot, setPot] = useState<number>(0);
  const [players, setPlayers] = useState<TeenPattiPlayer[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [isHandOver, setIsHandOver] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Welcome to Teen Patti Royal.');
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState<string | null>(null);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);
  const [flyingMoneys, setFlyingMoneys] = useState<FlyingMoney[]>([]);
  const [potRippling, setPotRippling] = useState<boolean>(false);

  // Teen Patti Limits
  const MAX_BLIND_ROUNDS = 4;
  const POT_LIMIT = bootAmount * 512; // Pot cap
  const MAX_STAKE = bootAmount * 32;

  useEffect(() => {
    startNewHand();
  }, [bootAmount]);

  // Trigger Money Flying Animation into Pot
  const animateMoneyToPot = (from: 'top' | 'left' | 'right' | 'bottom', amount: number) => {
    const id = 'fm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setFlyingMoneys(prev => [...prev, { id, from, amount }]);

    setTimeout(() => {
      soundManager.playChipClick();
      setPotRippling(true);
      setTimeout(() => setPotRippling(false), 400);
      setFlyingMoneys(prev => prev.filter(m => m.id !== id));
    }, 650);
  };

  const startNewHand = () => {
    setIsHandOver(false);
    setWinnerAnnouncement(null);

    const deck = createDeck(1);

    // Human player (bottom)
    const userChips = Math.max(1000, profile.coins);
    const human: TeenPattiPlayer = {
      id: profile.id,
      name: profile.username || 'You',
      avatar: profile.avatar || 'crown',
      chips: userChips - bootAmount,
      currentRoundBet: bootAmount,
      totalHandBet: bootAmount,
      cards: [],
      isFolded: false,
      isSeen: false,
      isAi: false,
      blindTurnsCount: 0,
    };

    // 3 AI Players (Top, Left, Right)
    const aiPlayers: TeenPattiPlayer[] = AI_PLAYERS_CONFIG.map((cfg, idx) => ({
      id: `ai_${idx}`,
      name: cfg.name,
      avatar: cfg.avatar,
      chips: 2500 - bootAmount,
      currentRoundBet: bootAmount,
      totalHandBet: bootAmount,
      cards: [],
      isFolded: false,
      isSeen: false,
      isAi: true,
      blindTurnsCount: 0,
      personality: cfg.personality,
    }));

    // Player 0 = Human (bottom), Player 1 = Rani Meera (top), Player 2 = Raja Vikram (left), Player 3 = Thakur Dev (right)
    const tablePlayers = [human, aiPlayers[0], aiPlayers[1], aiPlayers[2]];

    tablePlayers.forEach(p => {
      const dealtCards = [deck.pop()!, deck.pop()!, deck.pop()!];
      p.cards = dealtCards.map(c => ({ ...c, isHidden: true }));
      const evaluation = evaluateTeenPattiHand(dealtCards);
      p.handRankName = evaluation.name;
      p.handRankLevel = evaluation.level;
      p.handScore = evaluation.score;
    });

    const initialPot = bootAmount * 4;

    // Deduct user boot
    const tx = storageManager.executeTransaction('bet', 'teen_patti', bootAmount, `Teen Patti Boot: ${bootAmount}`);
    if (!tx.success) return;
    onUpdateProfile();

    soundManager.playCardDeal();

    // Trigger boot money animation for all 4 players
    animateMoneyToPot('bottom', bootAmount);
    setTimeout(() => animateMoneyToPot('top', bootAmount), 120);
    setTimeout(() => animateMoneyToPot('left', bootAmount), 240);
    setTimeout(() => animateMoneyToPot('right', bootAmount), 360);

    setPlayers(tablePlayers);
    setPot(initialPot);
    setCurrentStake(bootAmount);
    setStatusMessage(`Boot chips collected. You are in Blind play.`);
    setActivePlayerIndex(0);
  };

  const human = players[0];
  const activePlayers = players.filter(p => !p.isFolded);
  const remainingCount = activePlayers.length;

  // See Cards
  const handleSeeCards = () => {
    if (!human || human.isSeen || isHandOver) return;
    soundManager.playCardFlip();

    const revealed = human.cards.map(c => ({ ...c, isHidden: false }));
    const evaluation = evaluateTeenPattiHand(revealed);
    const updated = [...players];
    updated[0].cards = revealed;
    updated[0].isSeen = true;
    updated[0].handRankName = evaluation.name;
    updated[0].handRankLevel = evaluation.level;
    updated[0].handScore = evaluation.score;
    setPlayers(updated);
    setStatusMessage(`Hand inspected: ${evaluation.name}`);
  };

  // Pack (Fold)
  const handlePack = () => {
    if (activePlayerIndex !== 0 || isHandOver) return;
    soundManager.playButtonClick();

    const updated = [...players];
    updated[0].isFolded = true;
    setPlayers(updated);
    setStatusMessage('You packed. Table is simulating...');

    advanceToNextPlayer(updated, 1, pot, currentStake);
  };

  // Chaal or Blind
  const handleChaalOrBlind = (isRaise: boolean = false) => {
    if (activePlayerIndex !== 0 || isHandOver) return;

    const user = players[0];
    const isSeen = user.isSeen;

    let betAmount = 0;
    let nextStake = currentStake;

    if (!isSeen) {
      betAmount = isRaise ? currentStake * 2 : currentStake;
      if (isRaise) nextStake = currentStake * 2;
    } else {
      betAmount = isRaise ? currentStake * 4 : currentStake * 2;
      if (isRaise) nextStake = currentStake * 2;
    }

    if (profile.coins < betAmount) return;

    // Animate user's money flying into pot from bottom
    animateMoneyToPot('bottom', betAmount);

    const tx = storageManager.executeTransaction(
      'bet',
      'teen_patti',
      betAmount,
      `Teen Patti ${isSeen ? 'Chaal' : 'Blind'}: ${betAmount} coins`
    );
    if (!tx.success) return;
    onUpdateProfile();

    const updated = [...players];
    updated[0].chips -= betAmount;
    updated[0].currentRoundBet = betAmount;
    updated[0].totalHandBet += betAmount;
    if (!isSeen) {
      updated[0].blindTurnsCount += 1;
      if (updated[0].blindTurnsCount >= MAX_BLIND_ROUNDS) {
        updated[0].isSeen = true;
        updated[0].cards = updated[0].cards.map(c => ({ ...c, isHidden: false }));
      }
    }

    const nextPot = pot + betAmount;
    setPot(nextPot);
    setCurrentStake(nextStake);
    setPlayers(updated);
    setStatusMessage(`You played ${isSeen ? 'Chaal' : 'Blind'} (${betAmount} chips).`);

    if (nextPot >= POT_LIMIT) {
      triggerShowdown(updated, nextPot, 'Pot limit reached! Automatic Showdown.');
      return;
    }

    advanceToNextPlayer(updated, 1, nextPot, nextStake);
  };

  // Show
  const handleShow = () => {
    if (activePlayerIndex !== 0 || isHandOver || remainingCount !== 2) return;

    const user = players[0];
    const showCost = user.isSeen ? currentStake * 2 : currentStake;
    if (profile.coins < showCost) return;

    animateMoneyToPot('bottom', showCost);

    storageManager.executeTransaction('bet', 'teen_patti', showCost, `Teen Patti Show: ${showCost} coins`);
    onUpdateProfile();

    const updated = [...players];
    updated[0].chips -= showCost;
    updated[0].totalHandBet += showCost;

    const nextPot = pot + showCost;
    setPot(nextPot);
    setPlayers(updated);

    triggerShowdown(updated, nextPot, 'Showdown requested by You!', user.id);
  };

  // Sideshow (Compromise with immediate previous Seen player)
  const handleRequestSideshow = () => {
    if (activePlayerIndex !== 0 || isHandOver || !human.isSeen) return;

    let prevIdx = -1;
    for (let i = players.length - 1; i > 0; i--) {
      if (!players[i].isFolded) {
        prevIdx = i;
        break;
      }
    }

    if (prevIdx === -1) return;
    const prevPlayer = players[prevIdx];
    if (!prevPlayer || !prevPlayer.isSeen) return;

    const sideshowCost = currentStake * 2;
    if (profile.coins < sideshowCost) return;

    animateMoneyToPot('bottom', sideshowCost);
    storageManager.executeTransaction('bet', 'teen_patti', sideshowCost, `Teen Patti Sideshow: ${sideshowCost} coins`);
    onUpdateProfile();

    const updated = [...players];
    updated[0].chips -= sideshowCost;
    updated[0].totalHandBet += sideshowCost;
    const nextPot = pot + sideshowCost;
    setPot(nextPot);

    // AI acceptance logic: If AI has at least Pair, or aggressive personality, or confident
    const prevLevel = prevPlayer.handRankLevel || 1;
    const accepts = prevLevel >= 2 || prevPlayer.personality === 'aggressive' || Math.random() > 0.35;

    if (accepts) {
      soundManager.playCardDeal();
      const comp = compareTeenPattiPlayers(updated[0], updated[prevIdx], updated[0].id);
      if (comp.winnerId === updated[0].id) {
        updated[prevIdx].isFolded = true;
        setStatusMessage(`Sideshow: ${comp.explanation}. ${prevPlayer.name} folded.`);
      } else {
        updated[0].isFolded = true;
        setStatusMessage(`Sideshow: ${comp.explanation}. You packed.`);
      }
    } else {
      setStatusMessage(`${prevPlayer.name} declined the Sideshow request.`);
    }

    setPlayers(updated);
    const nowRemaining = updated.filter(p => !p.isFolded);
    if (nowRemaining.length === 1) {
      declareWinner(nowRemaining[0], nextPot, updated, 'Remaining player wins by default!');
      return;
    }

    advanceToNextPlayer(updated, 1, nextPot, currentStake);
  };

  // AI Turns
  const advanceToNextPlayer = (
    currentPlayers: TeenPattiPlayer[],
    nextIdx: number,
    curPot: number,
    curStake: number
  ) => {
    const active = currentPlayers.filter(p => !p.isFolded);
    if (active.length === 1) {
      declareWinner(active[0], curPot, currentPlayers, 'All opponents packed!');
      return;
    }

    if (curPot >= POT_LIMIT) {
      triggerShowdown(currentPlayers, curPot, 'Pot limit reached! Automatic Table Showdown.');
      return;
    }

    const actualIdx = nextIdx % currentPlayers.length;
    const curPlayer = currentPlayers[actualIdx];

    if (curPlayer.isFolded) {
      advanceToNextPlayer(currentPlayers, actualIdx + 1, curPot, curStake);
      return;
    }

    if (curPlayer.isAi) {
      setActivePlayerIndex(actualIdx);

      setTimeout(() => {
        const personality = curPlayer.personality || 'balanced';
        const updated = [...currentPlayers];
        let nextPot = curPot;
        let nextStake = curStake;

        // Position of this AI: 1 is top, 2 is left, 3 is right
        const aiPosition = actualIdx === 1 ? 'top' : actualIdx === 2 ? 'left' : 'right';

        if (!curPlayer.isSeen) {
          if (
            curPlayer.blindTurnsCount >= 2 ||
            (personality === 'beginner' && Math.random() > 0.4) ||
            (personality === 'balanced' && curPlayer.blindTurnsCount >= 1)
          ) {
            curPlayer.isSeen = true;
          } else {
            curPlayer.blindTurnsCount += 1;
          }
        }

        const handRankLevel = curPlayer.handRankLevel || 1;
        const remainingActive = updated.filter(p => !p.isFolded).length;

        let action: 'pack' | 'chaal' | 'raise' | 'show' = 'chaal';

        // When 2 players remain, AI can call show if confident or playing aggressive
        if (remainingActive === 2 && (handRankLevel >= 2 || Math.random() > 0.45)) {
          action = 'show';
        } else if (curPlayer.isSeen) {
          if (handRankLevel === 1 && Math.random() < 0.5) {
            action = 'pack';
          } else if (handRankLevel >= 3 || (personality === 'aggressive' && Math.random() > 0.45)) {
            // Level 3 (Color/Flush), Level 4 (Sequence), Level 5 (Pure Seq), Level 6 (Trail)
            action = curStake * 2 <= MAX_STAKE && Math.random() > 0.35 ? 'raise' : 'chaal';
          } else {
            action = 'chaal';
          }
        } else {
          if (personality === 'aggressive' && Math.random() > 0.5) {
            action = 'raise';
          } else {
            action = 'chaal';
          }
        }

        if (action === 'pack') {
          curPlayer.isFolded = true;
          soundManager.playCardFlip();
          setStatusMessage(`${curPlayer.name} packed.`);
        } else if (action === 'show') {
          const showCost = curPlayer.isSeen ? curStake * 2 : curStake;
          animateMoneyToPot(aiPosition, showCost);
          curPlayer.chips -= showCost;
          curPlayer.totalHandBet += showCost;
          nextPot += showCost;
          triggerShowdown(updated, nextPot, `${curPlayer.name} called for Showdown!`, curPlayer.id);
          return;
        } else if (action === 'raise') {
          const betAmount = curPlayer.isSeen ? curStake * 4 : curStake * 2;
          animateMoneyToPot(aiPosition, betAmount);
          curPlayer.chips -= betAmount;
          curPlayer.totalHandBet += betAmount;
          nextPot += betAmount;
          nextStake = curStake * 2;
          setStatusMessage(`${curPlayer.name} raised to ${nextStake} chips!`);
        } else {
          const betAmount = curPlayer.isSeen ? curStake * 2 : curStake;
          animateMoneyToPot(aiPosition, betAmount);
          curPlayer.chips -= betAmount;
          curPlayer.totalHandBet += betAmount;
          nextPot += betAmount;
          setStatusMessage(`${curPlayer.name} placed ${curPlayer.isSeen ? 'Chaal' : 'Blind'} (${betAmount}).`);
        }

        setPlayers(updated);
        setPot(nextPot);
        setCurrentStake(nextStake);

        const activeAfter = updated.filter(p => !p.isFolded);
        if (activeAfter.length === 1) {
          declareWinner(activeAfter[0], nextPot, updated, 'All opponents packed!');
          return;
        }

        advanceToNextPlayer(updated, actualIdx + 1, nextPot, nextStake);
      }, 750);
    } else {
      setActivePlayerIndex(0);
    }
  };

  // Showdown with official Teen Patti ranking hierarchy & tie-breaker rules
  const triggerShowdown = (
    finalPlayers: TeenPattiPlayer[],
    finalPot: number,
    reason: string,
    callerId?: string
  ) => {
    setIsHandOver(true);

    // Freshly evaluate all active players' cards and reveal them
    const revealed = finalPlayers.map(p => {
      if (!p.isFolded) {
        const freshEval = evaluateTeenPattiHand(p.cards);
        return {
          ...p,
          isSeen: true,
          handRankName: freshEval.name,
          handRankLevel: freshEval.level,
          handScore: freshEval.score,
          cards: p.cards.map(c => ({ ...c, isHidden: false })),
        };
      }
      return p;
    });

    const active = revealed.filter(p => !p.isFolded);
    let winner: TeenPattiPlayer = active[0] || revealed[0];
    let matchExplanation: string = reason;

    if (active.length === 2) {
      const comp = compareTeenPattiPlayers(active[0], active[1], callerId);
      const foundWinner = active.find(p => p.id === comp.winnerId);
      if (foundWinner) winner = foundWinner;
      matchExplanation = comp.explanation;
    } else if (active.length > 2) {
      // Sort active by handScore descending
      active.sort((a, b) => (b.handScore || 0) - (a.handScore || 0));
      winner = active[0];
      matchExplanation = `${winner.name} won table showdown with ${winner.handRankName}!`;
    }

    setPlayers(revealed);
    declareWinner(winner, finalPot, revealed, reason, matchExplanation);
  };

  const declareWinner = (
    winner: TeenPattiPlayer,
    finalPot: number,
    allPlayers: TeenPattiPlayer[],
    reasonText?: string,
    matchExplanation?: string
  ) => {
    setIsHandOver(true);
    const winText = matchExplanation
      ? `${winner.name} wins: ${matchExplanation} (+${finalPot.toLocaleString()} pot)`
      : `${winner.name} wins the pot of ${finalPot.toLocaleString()} chips with ${
          winner.handRankName || 'last standing'
        }!`;
    setWinnerAnnouncement(winText);

    if (!winner.isAi) {
      storageManager.executeTransaction('win', 'teen_patti', finalPot, `Teen Patti Royal Pot Won: +${finalPot}`);
      soundManager.playBigWin();
      setCelebrateWin(true);
      storageManager.recordGameRound('teen_patti', true, finalPot);
    } else {
      soundManager.playLoss();
      storageManager.recordGameRound('teen_patti', false);
    }

    onUpdateProfile();
  };

  const userBetAmount = human?.isSeen ? currentStake * 2 : currentStake;
  const userRaiseAmount = human?.isSeen ? currentStake * 4 : currentStake * 2;

  // Seated players:
  // player 0: Human (Bottom)
  // player 1: Rani Meera (Top)
  // player 2: Raja Vikram (Left)
  // player 3: Thakur Dev (Right)
  const topAi = players[1];
  const leftAi = players[2];
  const rightAi = players[3];

  const getHandRankBadge = (player?: TeenPattiPlayer) => {
    if (!player || !player.handRankName || player.isFolded) return null;
    const level = player.handRankLevel || 1;
    const badgeStyle = {
      6: 'bg-amber-400 text-slate-950 font-black border-amber-300 ring-1 ring-amber-300 shadow-amber-400/30',
      5: 'bg-emerald-500 text-slate-950 font-black border-emerald-300 shadow-emerald-400/20',
      4: 'bg-teal-500 text-slate-950 font-bold border-teal-300 shadow-teal-400/20',
      3: 'bg-purple-950/95 text-purple-200 font-bold border-purple-400 shadow-purple-900/30 ring-1 ring-purple-500/30',
      2: 'bg-blue-950/95 text-blue-200 font-semibold border-blue-500/60 shadow-blue-900/30',
      1: 'bg-slate-900/95 text-slate-300 font-medium border-slate-700 shadow-slate-900/40',
    }[level] || 'bg-black/80 text-amber-300 border-amber-500/30';

    return (
      <span
        className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded border shadow-sm mt-0.5 text-center truncate max-w-[130px] sm:max-w-[150px] inline-block ${badgeStyle}`}
        title={player.handRankName}
      >
        {player.handRankName}
      </span>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#07170f]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rules Drawer */}
      <InGameRuleDrawer
        gameId="teen_patti"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Header Bar */}
      <div className="w-full bg-[#0a2015]/95 border-b border-emerald-900/60 px-3 sm:px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-200 shadow-md z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onBackToLobby();
            }}
            className="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
          <div className="flex flex-col">
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">Teen Patti Royal</span>
            <span className="text-[10px] text-emerald-300/80">
              Boot: {bootAmount} · Current Stake: {currentStake} · Pot Cap: {POT_LIMIT.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Boot Selector */}
          <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-emerald-800 text-xs">
            <span className="text-slate-400 text-[10px] sm:text-xs">Boot:</span>
            {[10, 20, 50, 100].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setBootAmount(amt)}
                disabled={!isHandOver && pot > bootAmount * 4}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                  bootAmount === amt ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                } disabled:opacity-40`}
              >
                {amt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowRulesDrawer(true)}
            className="p-1.5 px-2.5 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/60 text-amber-300 font-bold flex items-center gap-1 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Rules</span>
          </button>
        </div>
      </div>

      {/* COMPACT SHORT CASINO TABLE ARENA (All 4 players and cards fully visible on screen) */}
      <div className="flex-1 flex flex-col items-center justify-center p-1.5 sm:p-3 select-none relative overflow-hidden">
        {/* The Short Oval Green Table */}
        <div className="relative w-full max-w-[500px] mx-auto h-[330px] sm:h-[370px] bg-gradient-to-b from-[#0e3b28] via-[#09291b] to-[#061e14] rounded-[60px] sm:rounded-[80px] border-[8px] sm:border-[12px] border-[#2c1308] shadow-[inset_0_0_40px_rgba(0,0,0,0.85),0_12px_35px_rgba(0,0,0,0.9)] flex items-center justify-center p-1">
          {/* Inner Golden Table Inscription */}
          <div className="absolute inset-3 rounded-[48px] sm:rounded-[68px] border border-amber-400/20 pointer-events-none flex items-center justify-center">
            <div className="font-serif font-black text-amber-300/10 text-2xl sm:text-3xl tracking-widest uppercase select-none">
              TEEN PATTI
            </div>
          </div>

          {/* FLYING MONEY CHIP ANIMATIONS INTO CENTER POT */}
          {flyingMoneys.map(m => {
            const flyClass = {
              top: 'top-6 left-1/2 animate-fly-top',
              left: 'left-6 top-1/2 animate-fly-left',
              right: 'right-6 top-1/2 animate-fly-right',
              bottom: 'bottom-6 left-1/2 animate-fly-bottom',
            }[m.from];

            return (
              <div
                key={m.id}
                className={`absolute z-40 pointer-events-none ${flyClass} flex items-center gap-1 drop-shadow-[0_4px_10px_rgba(245,158,11,0.5)]`}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 border border-yellow-200 text-slate-950 font-black text-[9px] flex items-center justify-center shadow-lg">
                  $
                </div>
                <span className="font-mono font-bold text-amber-300 text-[10px] bg-black/80 px-1 py-0.5 rounded border border-amber-400/40">
                  +{m.amount}
                </span>
              </div>
            );
          })}

          {/* 1. TOP SEATED PLAYER (Rani Meera) */}
          {topAi && (
            <div
              className={`absolute top-1.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-all ${
                topAi.isFolded ? 'opacity-30 grayscale' : ''
              } ${activePlayerIndex === 1 ? 'scale-105' : ''}`}
            >
              <div
                className={`px-2 py-0.5 rounded-lg flex items-center gap-1 backdrop-blur-md transition-all ${
                  activePlayerIndex === 1
                    ? 'bg-amber-500/30 border border-amber-400 shadow-md shadow-amber-400/30 ring-1 ring-amber-300'
                    : 'bg-black/60 border border-emerald-500/30'
                }`}
              >
                <Cpu className="w-2.5 h-2.5 text-amber-400" />
                <span className="font-semibold text-[10px] text-slate-200">{topAi.name}</span>
                <span className="text-[9px] font-mono text-amber-300">({topAi.chips.toLocaleString()})</span>
                <span
                  className={`text-[8px] font-bold px-1 rounded ${
                    topAi.isFolded ? 'bg-red-950 text-red-400' : topAi.isSeen ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {topAi.isFolded ? 'Fold' : topAi.isSeen ? 'Seen' : 'Blind'}
                </span>
              </div>
              {/* Overlapping Cards for screen fit */}
              <div className="flex items-center -space-x-3 mt-0.5">
                {topAi.cards.map((c, i) => (
                  <PlayingCard key={c.id || i} card={c} size="sm" />
                ))}
              </div>
              {topAi.cards.some(c => !c.isHidden) && getHandRankBadge(topAi)}
            </div>
          )}

          {/* 2. LEFT SEATED PLAYER (Raja Vikram) */}
          {leftAi && (
            <div
              className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all ${
                leftAi.isFolded ? 'opacity-30 grayscale' : ''
              } ${activePlayerIndex === 2 ? 'scale-105' : ''}`}
            >
              <div
                className={`px-1.5 py-0.5 rounded-lg flex flex-col items-center backdrop-blur-md transition-all ${
                  activePlayerIndex === 2
                    ? 'bg-amber-500/30 border border-amber-400 shadow-md shadow-amber-400/30 ring-1 ring-amber-300'
                    : 'bg-black/60 border border-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5 text-amber-400" />
                  <span className="font-semibold text-[9px] sm:text-[10px] text-slate-200">{leftAi.name}</span>
                </div>
                <span className="text-[8px] font-mono text-amber-300">{leftAi.chips.toLocaleString()}</span>
                <span
                  className={`text-[7px] font-bold px-1 rounded ${
                    leftAi.isFolded ? 'bg-red-950 text-red-400' : leftAi.isSeen ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {leftAi.isFolded ? 'Fold' : leftAi.isSeen ? 'Seen' : 'Blind'}
                </span>
              </div>
              {/* Overlapping Cards for screen fit */}
              <div className="flex items-center -space-x-3.5 mt-0.5">
                {leftAi.cards.map((c, i) => (
                  <PlayingCard key={c.id || i} card={c} size="sm" />
                ))}
              </div>
              {leftAi.cards.some(c => !c.isHidden) && getHandRankBadge(leftAi)}
            </div>
          )}

          {/* 3. RIGHT SEATED PLAYER (Thakur Dev) */}
          {rightAi && (
            <div
              className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all ${
                rightAi.isFolded ? 'opacity-30 grayscale' : ''
              } ${activePlayerIndex === 3 ? 'scale-105' : ''}`}
            >
              <div
                className={`px-1.5 py-0.5 rounded-lg flex flex-col items-center backdrop-blur-md transition-all ${
                  activePlayerIndex === 3
                    ? 'bg-amber-500/30 border border-amber-400 shadow-md shadow-amber-400/30 ring-1 ring-amber-300'
                    : 'bg-black/60 border border-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-1">
                  <User className="w-2.5 h-2.5 text-amber-400" />
                  <span className="font-semibold text-[9px] sm:text-[10px] text-slate-200">{rightAi.name}</span>
                </div>
                <span className="text-[8px] font-mono text-amber-300">{rightAi.chips.toLocaleString()}</span>
                <span
                  className={`text-[7px] font-bold px-1 rounded ${
                    rightAi.isFolded ? 'bg-red-950 text-red-400' : rightAi.isSeen ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {rightAi.isFolded ? 'Fold' : rightAi.isSeen ? 'Seen' : 'Blind'}
                </span>
              </div>
              {/* Overlapping Cards for screen fit */}
              <div className="flex items-center -space-x-3.5 mt-0.5">
                {rightAi.cards.map((c, i) => (
                  <PlayingCard key={c.id || i} card={c} size="sm" />
                ))}
              </div>
              {rightAi.cards.some(c => !c.isHidden) && getHandRankBadge(rightAi)}
            </div>
          )}

          {/* 4. CENTER POT & ORNATE BRASS BOWL */}
          <div className="flex flex-col items-center justify-center z-10 text-center px-1">
            <div
              className={`relative p-2.5 sm:p-3 rounded-2xl bg-black/80 border-2 border-amber-400/70 shadow-2xl flex flex-col items-center transition-transform duration-300 ${
                potRippling ? 'scale-110 ring-4 ring-amber-400/50' : ''
              }`}
            >
              <div className="text-[8px] uppercase tracking-widest text-amber-300 font-bold">Center Pot</div>
              <div className="font-serif font-black text-lg sm:text-xl text-amber-300 tabular-nums">
                {pot.toLocaleString()}
              </div>
              <div className="text-[8px] text-amber-200/70 font-mono">
                Cap: {POT_LIMIT.toLocaleString()}
              </div>
            </div>

            {/* Status / Announcement Box */}
            <div className="mt-1.5 max-w-[200px] sm:max-w-xs">
              {winnerAnnouncement ? (
                <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2.5 py-0.5 rounded-lg font-serif font-black text-[10px] sm:text-xs shadow-xl animate-in zoom-in-95">
                  {winnerAnnouncement}
                </div>
              ) : (
                <div className="text-[10px] text-emerald-200/90 font-medium bg-black/60 px-2.5 py-0.5 rounded-full border border-emerald-800/60 truncate">
                  {statusMessage}
                </div>
              )}
            </div>
          </div>

          {/* 5. BOTTOM SEATED PLAYER (YOU) */}
          {human && (
            <div
              className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-all ${
                human.isFolded ? 'opacity-40 grayscale' : ''
              } ${activePlayerIndex === 0 ? 'scale-105' : ''}`}
            >
              {/* User 3 Cards */}
              <div className="flex items-center -space-x-1 sm:gap-1">
                {human.cards.map((c, i) => (
                  <PlayingCard key={c.id || i} card={c} size="sm" />
                ))}
              </div>

              {/* User Info Bar */}
              <div className="flex items-center gap-1.5 mt-0.5 bg-black/75 px-2.5 py-0.5 rounded-lg border border-amber-500/40 shadow-lg">
                <span className="font-bold text-[10px] text-slate-100">You</span>
                <span className="text-amber-300 font-mono text-[10px]">({human.chips.toLocaleString()})</span>
                <span
                  className={`text-[8px] font-bold px-1 rounded uppercase ${
                    human.isSeen ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {human.isSeen ? 'Seen' : `Blind (${human.blindTurnsCount}/${MAX_BLIND_ROUNDS})`}
                </span>
                {!human.isSeen && !isHandOver && (
                  <button
                    type="button"
                    onClick={handleSeeCards}
                    className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-black uppercase flex items-center gap-0.5"
                  >
                    <Eye className="w-2.5 h-2.5" />
                    <span>See</span>
                  </button>
                )}
              </div>

              {(human.isSeen || isHandOver) && getHandRankBadge(human)}
            </div>
          )}
        </div>

        {/* Quick Winning Rules strip */}
        <div className="mt-2 text-[9px] text-amber-300/80 flex items-center justify-center gap-1.5 flex-wrap px-2.5 py-1 rounded-full bg-black/50 border border-emerald-900/60 shadow">
          <span className="text-amber-400 font-bold uppercase tracking-wider text-[8px]">Hierarchy:</span>
          <span>Trail (AAA)</span>
          <span className="text-slate-500">&gt;</span>
          <span>Pure Run</span>
          <span className="text-slate-500">&gt;</span>
          <span>Run</span>
          <span className="text-slate-500">&gt;</span>
          <span className="text-purple-300 font-bold">Color (Same Suit)</span>
          <span className="text-slate-500">&gt;</span>
          <span>Pair</span>
          <span className="text-slate-500">&gt;</span>
          <span>High Card</span>
        </div>
      </div>

      {/* ACTION CONTROLS BAR (Thumb zone at bottom, responsive) */}
      <div className="w-full bg-[#101319]/95 border-t border-slate-800 p-2.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xl backdrop-blur-md z-30">
        {isHandOver ? (
          <div className="w-full flex items-center justify-center">
            <button
              type="button"
              onClick={startNewHand}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Deal Next Hand</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            {/* Pack (Fold) */}
            <button
              type="button"
              onClick={handlePack}
              disabled={activePlayerIndex !== 0}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/30 font-bold text-xs disabled:opacity-40 transition-colors"
            >
              PACK
            </button>

            {/* Sideshow */}
            {human?.isSeen && (
              <button
                type="button"
                onClick={handleRequestSideshow}
                disabled={activePlayerIndex !== 0 || profile.coins < userBetAmount}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-600/40 text-purple-300 font-bold text-xs disabled:opacity-40 transition-colors"
              >
                SIDESHOW
              </button>
            )}

            {/* Chaal / Blind Bet */}
            <button
              type="button"
              onClick={() => handleChaalOrBlind(false)}
              disabled={activePlayerIndex !== 0 || profile.coins < userBetAmount}
              className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-bold text-xs shadow-md disabled:opacity-40 transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <span>{human?.isSeen ? 'CHAAL' : 'BLIND'}</span>
              <span className="font-mono text-amber-300 tabular-nums">({userBetAmount})</span>
            </button>

            {/* Raise Stake */}
            {userRaiseAmount <= MAX_STAKE && (
              <button
                type="button"
                onClick={() => handleChaalOrBlind(true)}
                disabled={activePlayerIndex !== 0 || profile.coins < userRaiseAmount}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 text-slate-950 font-bold text-xs shadow-md disabled:opacity-40 transition-transform active:scale-95 flex items-center gap-1"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>RAISE</span>
                <span className="font-mono tabular-nums">({userRaiseAmount})</span>
              </button>
            )}

            {/* Show */}
            {remainingCount === 2 && (
              <button
                type="button"
                onClick={handleShow}
                disabled={activePlayerIndex !== 0 || profile.coins < userBetAmount}
                className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs shadow-lg shadow-amber-500/20 disabled:opacity-40 transition-transform active:scale-95"
              >
                SHOW ({userBetAmount})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
