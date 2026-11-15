import React, { useState, useEffect } from 'react';
import { Card, UserProfile, PokerPlayer, PokerStage, AiPersonality } from '../../types';
import { createDeck, evaluate7CardPokerHand, PokerEvaluation } from '../../utils/cards';
import { PlayingCard } from '../../components/common/PlayingCard';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { ArrowLeft, BookOpen, RotateCcw, User, ShieldAlert, Cpu } from 'lucide-react';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';

interface PokerGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

const AI_OPPONENTS: { name: string; avatar: string; personality: AiPersonality }[] = [
  { name: 'Vegas Shark', avatar: 'Crown', personality: 'aggressive' },
  { name: 'Count Monte', avatar: 'Gem', personality: 'experienced' },
  { name: 'Lady Luck', avatar: 'Sparkles', personality: 'balanced' },
  { name: 'Rookie Ray', avatar: 'Smile', personality: 'beginner' },
];

export const PokerGame: React.FC<PokerGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [deck, setDeck] = useState<Card[]>([]);
  const [players, setPlayers] = useState<PokerPlayer[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState<number>(0);
  const [currentBetToCall, setCurrentBetToCall] = useState<number>(20);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [stage, setStage] = useState<PokerStage>('preflop');
  const [raiseAmount, setRaiseAmount] = useState<number>(50);
  const [statusMessage, setStatusMessage] = useState<string>('Welcome to VIP Texas Hold\'em.');
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [isHandOver, setIsHandOver] = useState<boolean>(false);
  const [winningAnnouncement, setWinningAnnouncement] = useState<string | null>(null);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  const SMALL_BLIND = 10;
  const BIG_BLIND = 20;

  // Initialize table
  useEffect(() => {
    startNewHand();
  }, []);

  const startNewHand = () => {
    setIsHandOver(false);
    setWinningAnnouncement(null);
    setCommunityCards([]);
    setStage('preflop');

    const freshDeck = createDeck(1);

    // Human player (Index 0)
    const userChips = Math.max(1000, profile.coins);
    const human: PokerPlayer = {
      id: profile.id,
      name: profile.username || 'You',
      avatar: 'user',
      chips: userChips,
      currentBet: 0,
      cards: [],
      isFolded: false,
      isAllIn: false,
      isAi: false,
    };

    // 3 AI Opponents
    const aiPlayers: PokerPlayer[] = AI_OPPONENTS.slice(0, 3).map((opp, idx) => ({
      id: `ai_${idx}`,
      name: opp.name,
      avatar: opp.avatar,
      chips: 2500,
      currentBet: 0,
      cards: [],
      isFolded: false,
      isAllIn: false,
      isAi: true,
      personality: opp.personality,
    }));

    const tablePlayers = [human, ...aiPlayers];

    // Deal 2 hole cards to each player
    tablePlayers.forEach(p => {
      p.cards = [freshDeck.pop()!, freshDeck.pop()!];
      // Hide AI cards initially
      if (p.isAi) {
        p.cards = p.cards.map(c => ({ ...c, isHidden: true }));
      }
    });

    // Post Blinds: Human is Small Blind (10), AI 1 is Big Blind (20)
    tablePlayers[0].chips -= SMALL_BLIND;
    tablePlayers[0].currentBet = SMALL_BLIND;

    tablePlayers[1].chips -= BIG_BLIND;
    tablePlayers[1].currentBet = BIG_BLIND;

    const initialPot = SMALL_BLIND + BIG_BLIND;

    // Deduct user small blind from storage
    storageManager.executeTransaction('bet', 'poker', SMALL_BLIND, `Texas Hold'em Small Blind: ${SMALL_BLIND}`);
    onUpdateProfile();

    setPlayers(tablePlayers);
    setDeck(freshDeck);
    setPot(initialPot);
    setCurrentBetToCall(BIG_BLIND);
    setRaiseAmount(BIG_BLIND * 2);

    soundManager.playCardDeal();
    setStatusMessage('Hand started. Blinds posted. Your action.');
    setActivePlayerIndex(0); // Human turn
  };

  // Human Action: Fold
  const handleFold = () => {
    if (activePlayerIndex !== 0 || isHandOver) return;
    soundManager.playButtonClick();

    const updated = [...players];
    updated[0].isFolded = true;
    setPlayers(updated);
    setStatusMessage('You folded. Simulating remaining hands...');

    // Continue round with AI
    processNextTurn(updated, 1, stage, pot, currentBetToCall);
  };

  // Human Action: Check / Call
  const handleCheckOrCall = () => {
    if (activePlayerIndex !== 0 || isHandOver) return;

    const user = players[0];
    const callCost = currentBetToCall - user.currentBet;

    if (callCost > 0) {
      if (profile.coins < callCost) {
        return; // Can't afford
      }
      soundManager.playChipClick();
      storageManager.executeTransaction('bet', 'poker', callCost, `Poker Call: ${callCost}`);
      onUpdateProfile();

      const updated = [...players];
      updated[0].chips -= callCost;
      updated[0].currentBet += callCost;
      const newPot = pot + callCost;
      setPot(newPot);
      setPlayers(updated);
      setStatusMessage(`You called ${callCost} coins.`);
      processNextTurn(updated, 1, stage, newPot, currentBetToCall);
    } else {
      // Check
      soundManager.playButtonClick();
      setStatusMessage('You checked.');
      processNextTurn(players, 1, stage, pot, currentBetToCall);
    }
  };

  // Human Action: Raise
  const handleRaise = () => {
    if (activePlayerIndex !== 0 || isHandOver) return;

    const user = players[0];
    const totalWager = raiseAmount;
    const additionalCost = totalWager - user.currentBet;

    if (additionalCost <= 0 || profile.coins < additionalCost) return;

    soundManager.playChipStack();
    storageManager.executeTransaction('bet', 'poker', additionalCost, `Poker Raise to: ${totalWager}`);
    onUpdateProfile();

    const updated = [...players];
    updated[0].chips -= additionalCost;
    updated[0].currentBet = totalWager;
    const newPot = pot + additionalCost;
    setPot(newPot);
    setCurrentBetToCall(totalWager);
    setPlayers(updated);
    setStatusMessage(`You raised to ${totalWager} coins!`);

    processNextTurn(updated, 1, stage, newPot, totalWager);
  };

  // AI Decision Logic
  const processNextTurn = (
    currentPlayers: PokerPlayer[],
    nextPlayerIdx: number,
    curStage: PokerStage,
    curPot: number,
    curBet: number
  ) => {
    const activePlayers = currentPlayers.filter(p => !p.isFolded);

    // If only 1 player remains, they win uncontested
    if (activePlayers.length === 1) {
      resolveHand(activePlayers[0], curPot, currentPlayers);
      return;
    }

    // If we've completed a full betting round (index >= 4 or back to 0 where bets are equal)
    const isRoundComplete = currentPlayers.every(
      p => p.isFolded || p.isAllIn || p.currentBet === curBet
    );

    if (nextPlayerIdx >= currentPlayers.length || (nextPlayerIdx === 0 && isRoundComplete)) {
      advanceStage(curStage, currentPlayers, curPot);
      return;
    }

    const curPlayer = currentPlayers[nextPlayerIdx];

    if (curPlayer.isFolded || curPlayer.isAllIn) {
      processNextTurn(currentPlayers, nextPlayerIdx + 1, curStage, curPot, curBet);
      return;
    }

    if (curPlayer.isAi) {
      // AI decision with personality
      setTimeout(() => {
        const toCall = curBet - curPlayer.currentBet;
        const personality = curPlayer.personality || 'balanced';

        let action: 'fold' | 'call' | 'raise' = 'call';
        const rand = Math.random();

        if (personality === 'aggressive') {
          if (rand > 0.45 && curPlayer.chips >= toCall + 40) {
            action = 'raise';
          } else if (toCall > 300 && rand < 0.2) {
            action = 'fold';
          } else {
            action = 'call';
          }
        } else if (personality === 'beginner') {
          if (toCall > 100 && rand < 0.4) {
            action = 'fold';
          } else {
            action = 'call';
          }
        } else {
          // Balanced / Experienced
          if (toCall > 250 && rand < 0.3) {
            action = 'fold';
          } else if (rand > 0.75 && curPlayer.chips >= toCall + 50) {
            action = 'raise';
          } else {
            action = 'call';
          }
        }

        const updated = [...currentPlayers];
        let nextPot = curPot;
        let nextBet = curBet;

        if (action === 'fold') {
          updated[nextPlayerIdx].isFolded = true;
          soundManager.playCardFlip();
          setStatusMessage(`${curPlayer.name} folds.`);
        } else if (action === 'raise') {
          const raiseBy = 40;
          const totalAiBet = curBet + raiseBy;
          const cost = totalAiBet - curPlayer.currentBet;
          updated[nextPlayerIdx].chips -= cost;
          updated[nextPlayerIdx].currentBet = totalAiBet;
          nextPot += cost;
          nextBet = totalAiBet;
          soundManager.playChipClick();
          setStatusMessage(`${curPlayer.name} raises to ${totalAiBet}!`);
        } else {
          // Call / Check
          if (toCall > 0) {
            updated[nextPlayerIdx].chips -= toCall;
            updated[nextPlayerIdx].currentBet += toCall;
            nextPot += toCall;
            soundManager.playChipClick();
            setStatusMessage(`${curPlayer.name} calls ${toCall}.`);
          } else {
            setStatusMessage(`${curPlayer.name} checks.`);
          }
        }

        setPlayers(updated);
        setPot(nextPot);
        setCurrentBetToCall(nextBet);

        // Move to next player
        processNextTurn(updated, nextPlayerIdx + 1, curStage, nextPot, nextBet);
      }, 700);
    } else {
      // Back to human
      setActivePlayerIndex(0);
    }
  };

  // Advance Community Cards (Flop, Turn, River, Showdown)
  const advanceStage = (curStage: PokerStage, currentPlayers: PokerPlayer[], curPot: number) => {
    // Reset round bets
    const resetBets = currentPlayers.map(p => ({ ...p, currentBet: 0 }));
    setPlayers(resetBets);
    setCurrentBetToCall(0);

    const curDeck = [...deck];
    soundManager.playCardDeal();

    if (curStage === 'preflop') {
      // Deal Flop (3 cards)
      const flop = [curDeck.pop()!, curDeck.pop()!, curDeck.pop()!];
      setCommunityCards(flop);
      setDeck(curDeck);
      setStage('flop');
      setStatusMessage('Flop dealt. Your action.');
      setActivePlayerIndex(0);
    } else if (curStage === 'flop') {
      // Deal Turn (4th card)
      const turnCard = curDeck.pop()!;
      setCommunityCards(prev => [...prev, turnCard]);
      setDeck(curDeck);
      setStage('turn');
      setStatusMessage('Turn card dealt. Your action.');
      setActivePlayerIndex(0);
    } else if (curStage === 'turn') {
      // Deal River (5th card)
      const riverCard = curDeck.pop()!;
      const fullBoard = [...communityCards, riverCard];
      setCommunityCards(fullBoard);
      setDeck(curDeck);
      setStage('river');
      setStatusMessage('River card dealt. Final betting round.');
      setActivePlayerIndex(0);
    } else {
      // Showdown!
      performShowdown(resetBets, curPot);
    }
  };

  // Showdown Evaluation
  const performShowdown = (finalPlayers: PokerPlayer[], finalPot: number) => {
    setStage('showdown');
    setIsHandOver(true);

    // Reveal all AI hole cards
    const revealedPlayers = finalPlayers.map(p => ({
      ...p,
      cards: p.cards.map(c => ({ ...c, isHidden: false })),
    }));

    // Evaluate each remaining active player's hand
    let bestScore = -1;
    let winningPlayer: PokerPlayer = revealedPlayers[0];
    let winningHandName = '';

    revealedPlayers.forEach(p => {
      if (!p.isFolded) {
        const full7 = [...p.cards, ...communityCards];
        const evaluation = evaluate7CardPokerHand(full7);
        p.handDescription = evaluation.name;
        p.handScore = evaluation.score;

        if (evaluation.score > bestScore) {
          bestScore = evaluation.score;
          winningPlayer = p;
          winningHandName = evaluation.name;
        }
      }
    });

    setPlayers(revealedPlayers);
    resolveHand(winningPlayer, finalPot, revealedPlayers, winningHandName);
  };

  const resolveHand = (
    winner: PokerPlayer,
    finalPot: number,
    tablePlayers: PokerPlayer[],
    handName?: string
  ) => {
    setIsHandOver(true);
    setWinningAnnouncement(`${winner.name} wins ${finalPot.toLocaleString()} pot with ${handName || 'best hand'}!`);

    if (!winner.isAi) {
      // Human won!
      storageManager.executeTransaction('win', 'poker', finalPot, `Texas Hold'em Pot Won: +${finalPot}`);
      soundManager.playBigWin();
      setCelebrateWin(true);
      storageManager.recordGameRound('poker', true, finalPot);
      storageManager.updateAchievementProgress('poker_showdown', 1);
    } else {
      soundManager.playLoss();
      storageManager.recordGameRound('poker', false);
    }

    onUpdateProfile();
  };

  const human = players[0];
  const userToCall = currentBetToCall - (human?.currentBet || 0);

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#0a1e14]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rule Drawer */}
      <InGameRuleDrawer
        gameId="poker"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Header */}
      <div className="w-full bg-[#0c2a1c]/90 border-b border-emerald-900/60 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-200">
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
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">Texas Hold'em Poker</span>
            <span className="text-[10px] text-emerald-300/80">Blinds: {SMALL_BLIND}/{BIG_BLIND} · No Limit Hold'em</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setShowRulesDrawer(true);
            }}
            className="p-1.5 px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-amber-300 font-bold flex items-center gap-1 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Rules</span>
          </button>
        </div>
      </div>

      {/* Poker Table Arena */}
      <div className="casino-felt-surface flex-1 flex flex-col items-center justify-between p-3 sm:p-5 select-none relative">
        {/* Top: AI Opponents */}
        <div className="w-full max-w-4xl flex items-center justify-around gap-2 z-10">
          {players.slice(1).map(ai => (
            <div
              key={ai.id}
              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                ai.isFolded ? 'opacity-40 grayscale' : 'bg-black/40 border border-emerald-500/30'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-200 mb-1">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold">{ai.name}</span>
                <span className="text-[10px] text-amber-300">({ai.chips.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-1">
                {ai.cards.map((c, i) => (
                  <PlayingCard key={c.id || i} card={c} size="sm" />
                ))}
              </div>
              {ai.currentBet > 0 && (
                <div className="mt-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                  Bet: {ai.currentBet}
                </div>
              )}
              {ai.handDescription && (
                <div className="text-[10px] text-amber-300 font-bold mt-0.5">{ai.handDescription}</div>
              )}
            </div>
          ))}
        </div>

        {/* Center: Community Cards & Pot */}
        <div className="flex flex-col items-center my-2 z-10">
          {/* Pot Display */}
          <div className="flex items-center gap-2 bg-black/60 border border-amber-500/40 rounded-full px-4 py-1.5 shadow-xl mb-3">
            <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold">Total Pot:</span>
            <span className="font-serif font-black text-amber-300 text-lg sm:text-xl tabular-nums">
              {pot.toLocaleString()}
            </span>
            <span className="text-xs text-amber-200/80">coins</span>
          </div>

          {/* 5 Community Cards */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-h-[96px] bg-[#0c2a1a]/80 p-2 sm:p-3 rounded-2xl border border-emerald-700/50 shadow-inner">
            {communityCards.length > 0 ? (
              communityCards.map((c, i) => <PlayingCard key={c.id || i} card={c} size="md" />)
            ) : (
              <div className="text-xs text-emerald-400/60 font-serif italic px-6 py-4">
                Community Cards will appear on the Flop
              </div>
            )}
          </div>

          {/* Round Status & Showdown Message */}
          <div className="mt-2 text-center">
            {winningAnnouncement ? (
              <div className="bg-gradient-to-r from-amber-600 to-yellow-500 text-slate-950 px-4 py-1.5 rounded-xl font-serif font-black text-sm shadow-xl">
                {winningAnnouncement}
              </div>
            ) : (
              <div className="text-xs text-emerald-300/90 font-medium bg-black/40 px-3 py-1 rounded-full border border-emerald-800">
                {statusMessage}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Player's Hand */}
        {human && (
          <div className="flex flex-col items-center gap-2 z-10">
            <div className="flex items-center gap-2">
              {human.cards.map((c, i) => (
                <PlayingCard key={c.id || i} card={c} size="lg" />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Your Hand</span>
              <span className="text-amber-300 font-mono">({human.chips.toLocaleString()} chips)</span>
              {human.currentBet > 0 && (
                <span className="text-emerald-400">· Bet this round: {human.currentBet}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Controls Bar */}
      <div className="w-full bg-[#111319]/95 border-t border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
        {isHandOver ? (
          <div className="w-full flex items-center justify-center">
            <button
              type="button"
              onClick={startNewHand}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-xl shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Deal Next Hand</span>
            </button>
          </div>
        ) : (
          <>
            {/* Fold & Check/Call Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={handleFold}
                disabled={activePlayerIndex !== 0}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-500/30 font-bold text-xs sm:text-sm disabled:opacity-40 transition-colors"
              >
                FOLD
              </button>

              <button
                type="button"
                onClick={handleCheckOrCall}
                disabled={activePlayerIndex !== 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md disabled:opacity-40 transition-transform active:scale-95"
              >
                {userToCall > 0 ? `CALL ${userToCall}` : 'CHECK'}
              </button>
            </div>

            {/* Raise Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Raise to:</span>
                <span className="text-amber-400 font-mono font-bold text-sm tabular-nums">{raiseAmount}</span>
              </div>

              <input
                type="range"
                min={currentBetToCall + 20}
                max={Math.min(500, profile.coins)}
                step="20"
                value={raiseAmount}
                onChange={e => setRaiseAmount(parseInt(e.target.value, 10))}
                className="accent-amber-400 w-24 sm:w-32 cursor-pointer"
              />

              <button
                type="button"
                onClick={handleRaise}
                disabled={activePlayerIndex !== 0 || profile.coins < raiseAmount - (human?.currentBet || 0)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 disabled:opacity-40 transition-transform active:scale-95"
              >
                RAISE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
