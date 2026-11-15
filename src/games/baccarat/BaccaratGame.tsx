import React, { useState, useEffect } from 'react';
import { Card, ChipDenomination, UserProfile, BaccaratBetChoice, BaccaratHistoryItem } from '../../types';
import { createDeck, calculateBaccaratHandTotal, determineBaccaratThirdCards } from '../../utils/cards';
import { PlayingCard } from '../../components/common/PlayingCard';
import { ChipSelector } from '../../components/common/ChipSelector';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { ArrowLeft, BookOpen, RotateCcw } from 'lucide-react';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';

interface BaccaratGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

export const BaccaratGame: React.FC<BaccaratGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [selectedChip, setSelectedChip] = useState<ChipDenomination>(50);
  const [bets, setBets] = useState<Record<BaccaratBetChoice, number>>({
    player: 0,
    banker: 100,
    tie: 0,
    player_pair: 0,
    banker_pair: 0,
  });
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [bankerCards, setBankerCards] = useState<Card[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [history, setHistory] = useState<BaccaratHistoryItem[]>([
    { id: '1', winner: 'banker', playerScore: 4, bankerScore: 7, playerPair: false, bankerPair: false },
    { id: '2', winner: 'player', playerScore: 8, bankerScore: 6, playerPair: false, bankerPair: false },
    { id: '3', winner: 'banker', playerScore: 5, bankerScore: 9, playerPair: false, bankerPair: true },
    { id: '4', winner: 'tie', playerScore: 6, bankerScore: 6, playerPair: false, bankerPair: false },
    { id: '5', winner: 'banker', playerScore: 3, bankerScore: 8, playerPair: false, bankerPair: false },
  ]);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

  const handleAddBet = (choice: BaccaratBetChoice) => {
    if (isPlaying) return;
    if (profile.coins < totalBet + selectedChip) return;

    soundManager.playChipClick();
    setBets(prev => ({ ...prev, [choice]: prev[choice] + selectedChip }));
  };

  const handleClearBets = () => {
    if (isPlaying) return;
    soundManager.playButtonClick();
    setBets({ player: 0, banker: 0, tie: 0, player_pair: 0, banker_pair: 0 });
  };

  const handleDoubleBets = () => {
    if (isPlaying || totalBet === 0) return;
    if (profile.coins < totalBet * 2) return;
    soundManager.playChipStack();
    setBets(prev => ({
      player: prev.player * 2,
      banker: prev.banker * 2,
      tie: prev.tie * 2,
      player_pair: prev.player_pair * 2,
      banker_pair: prev.banker_pair * 2,
    }));
  };

  // Deal Baccarat Round
  const dealBaccarat = () => {
    if (isPlaying || totalBet <= 0 || totalBet > profile.coins) return;

    // Deduct bet atomically
    const tx = storageManager.executeTransaction('bet', 'baccarat', totalBet, `Baccarat Bet: ${totalBet} coins`);
    if (!tx.success) return;
    onUpdateProfile();

    setIsPlaying(true);
    setPlayerCards([]);
    setBankerCards([]);
    setRoundResult(null);

    const deck = createDeck(8);

    // Initial 2 cards for Player and Banker
    const p1 = deck.pop()!;
    const b1 = deck.pop()!;
    const p2 = deck.pop()!;
    const b2 = deck.pop()!;

    soundManager.playCardDeal();
    setPlayerCards([p1, p2]);
    setBankerCards([b1, b2]);

    setTimeout(() => {
      // Evaluate third card rules
      const { playerDraws, bankerDraws } = determineBaccaratThirdCards([p1, p2], [b1, b2]);

      let finalPlayerCards = [p1, p2];
      let finalBankerCards = [b1, b2];
      let p3: Card | null = null;

      if (playerDraws) {
        p3 = deck.pop()!;
        finalPlayerCards = [...finalPlayerCards, p3];
        soundManager.playCardDeal();
        setPlayerCards(finalPlayerCards);
      }

      setTimeout(() => {
        if (bankerDraws(p3)) {
          const b3 = deck.pop()!;
          finalBankerCards = [...finalBankerCards, b3];
          soundManager.playCardDeal();
          setBankerCards(finalBankerCards);
        }

        setTimeout(() => {
          resolveBaccaratRound(finalPlayerCards, finalBankerCards);
        }, 500);
      }, playerDraws ? 600 : 100);
    }, 700);
  };

  const resolveBaccaratRound = (pCards: Card[], bCards: Card[]) => {
    setIsPlaying(false);
    const pScore = calculateBaccaratHandTotal(pCards);
    const bScore = calculateBaccaratHandTotal(bCards);

    let winner: 'player' | 'banker' | 'tie' = 'tie';
    if (pScore > bScore) winner = 'player';
    else if (bScore > pScore) winner = 'banker';

    const pPair = pCards.length >= 2 && pCards[0].rank === pCards[1].rank;
    const bPair = bCards.length >= 2 && bCards[0].rank === bCards[1].rank;

    // Record history item
    const historyItem: BaccaratHistoryItem = {
      id: Date.now().toString(),
      winner,
      playerScore: pScore,
      bankerScore: bScore,
      playerPair: pPair,
      bankerPair: bPair,
    };
    setHistory(prev => [historyItem, ...prev.slice(0, 11)]);

    // Calculate payouts
    let totalWon = 0;

    if (winner === 'player' && bets.player > 0) {
      totalWon += bets.player * 2; // 1:1 payout + return bet
    } else if (winner === 'banker' && bets.banker > 0) {
      totalWon += Math.floor(bets.banker + bets.banker * 0.95); // 0.95:1 payout (5% commission)
    } else if (winner === 'tie') {
      if (bets.tie > 0) {
        totalWon += bets.tie * 9; // 8:1 payout + return bet
      }
      // On tie, Player and Banker bets push (returned)
      totalWon += bets.player + bets.banker;
    }

    // Side bets
    if (pPair && bets.player_pair > 0) {
      totalWon += bets.player_pair * 12; // 11:1
    }
    if (bPair && bets.banker_pair > 0) {
      totalWon += bets.banker_pair * 12; // 11:1
    }

    if (totalWon > 0) {
      storageManager.executeTransaction('win', 'baccarat', totalWon, `Baccarat Win (${winner.toUpperCase()}): +${totalWon}`);
      soundManager.playWin();
      setCelebrateWin(true);
      setRoundResult(`${winner.toUpperCase()} Wins (${bScore} vs ${pScore})! You won +${totalWon.toLocaleString()} coins!`);
      storageManager.recordGameRound('baccarat', true, totalWon);
      if (pScore >= 8 || bScore >= 8) {
        storageManager.updateAchievementProgress('baccarat_natural', 1);
      }
    } else {
      soundManager.playLoss();
      setRoundResult(`${winner.toUpperCase()} Wins (${bScore} to ${pScore}). Better luck next coup.`);
      storageManager.recordGameRound('baccarat', false);
    }

    onUpdateProfile();
  };

  const pScore = calculateBaccaratHandTotal(playerCards);
  const bScore = calculateBaccaratHandTotal(bankerCards);

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#0c1a16]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rule Drawer */}
      <InGameRuleDrawer
        gameId="baccarat"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Header */}
      <div className="w-full bg-[#0e241e]/90 border-b border-emerald-900/60 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-200">
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
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">VIP Baccarat</span>
            <span className="text-[10px] text-emerald-300/80">Punto Banco · Natural 8 & 9 Payouts</span>
          </div>
        </div>

        {/* Macau Bead Plate Roadmap */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
          {history.slice(0, 8).map(h => (
            <span
              key={h.id}
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-sm ${
                h.winner === 'banker'
                  ? 'bg-red-700 border border-red-500'
                  : h.winner === 'player'
                  ? 'bg-blue-700 border border-blue-500'
                  : 'bg-emerald-600 border border-emerald-400'
              }`}
              title={`${h.winner.toUpperCase()} (${h.bankerScore}-${h.playerScore})`}
            >
              {h.winner === 'banker' ? 'B' : h.winner === 'player' ? 'P' : 'T'}
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setShowRulesDrawer(true);
            }}
            className="p-1.5 px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-amber-300 font-bold flex items-center gap-1 transition-colors ml-2"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-xs">Rules</span>
          </button>
        </div>
      </div>

      {/* Main Table Felt */}
      <div className="casino-felt-surface flex-1 flex flex-col items-center justify-around p-3 sm:p-5 select-none relative">
        {/* Dealing Table Zones */}
        <div className="grid grid-cols-2 gap-4 sm:gap-12 w-full max-w-2xl z-10">
          {/* Player Hand Zone */}
          <div className="flex flex-col items-center p-3 rounded-2xl bg-black/40 border border-blue-500/40 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-serif font-bold text-blue-300 tracking-wider uppercase text-sm">PLAYER</span>
              {playerCards.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-400/40 text-blue-300 font-mono font-bold text-xs">
                  {pScore}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 min-h-[96px]">
              {playerCards.map((c, i) => (
                <PlayingCard key={c.id || i} card={c} size="md" />
              ))}
            </div>
          </div>

          {/* Banker Hand Zone */}
          <div className="flex flex-col items-center p-3 rounded-2xl bg-black/40 border border-red-500/40 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-serif font-bold text-red-300 tracking-wider uppercase text-sm">BANKER</span>
              {bankerCards.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-400/40 text-red-300 font-mono font-bold text-xs">
                  {bScore}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 min-h-[96px]">
              {bankerCards.map((c, i) => (
                <PlayingCard key={c.id || i} card={c} size="md" />
              ))}
            </div>
          </div>
        </div>

        {/* Center Round Banner */}
        {roundResult && (
          <div className="z-10 my-2 text-center">
            <div className="inline-block bg-black/85 border border-amber-400/60 rounded-xl px-5 py-2 shadow-2xl backdrop-blur-md">
              <div className="font-serif font-black text-amber-300 text-sm sm:text-base">{roundResult}</div>
            </div>
          </div>
        )}

        {/* Baccarat Betting Areas (Player, Tie, Banker + Pairs) */}
        <div className="w-full max-w-xl grid grid-cols-3 gap-2 sm:gap-3 z-10">
          {/* Player Bet */}
          <button
            type="button"
            onClick={() => handleAddBet('player')}
            disabled={isPlaying}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-blue-950/70 hover:bg-blue-900/80 border-2 border-blue-500/60 transition-all text-center relative"
          >
            <span className="font-serif font-bold text-blue-300 text-xs sm:text-sm uppercase tracking-wide">
              PLAYER
            </span>
            <span className="text-[10px] text-blue-200/70 mt-0.5">Wager on Punto</span>
            {bets.player > 0 && (
              <span className="mt-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow-md">
                {bets.player}
              </span>
            )}
          </button>

          {/* Tie Bet */}
          <button
            type="button"
            onClick={() => handleAddBet('tie')}
            disabled={isPlaying}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border-2 border-emerald-500/60 transition-all text-center relative"
          >
            <span className="font-serif font-bold text-emerald-300 text-xs sm:text-sm uppercase tracking-wide">
              TIE
            </span>
            <span className="text-[10px] text-emerald-200/70 mt-0.5">Egalité</span>
            {bets.tie > 0 && (
              <span className="mt-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow-md">
                {bets.tie}
              </span>
            )}
          </button>

          {/* Banker Bet */}
          <button
            type="button"
            onClick={() => handleAddBet('banker')}
            disabled={isPlaying}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl bg-red-950/70 hover:bg-red-900/80 border-2 border-red-500/60 transition-all text-center relative"
          >
            <span className="font-serif font-bold text-red-300 text-xs sm:text-sm uppercase tracking-wide">
              BANKER
            </span>
            <span className="text-[10px] text-red-200/70 mt-0.5">Banco</span>
            {bets.banker > 0 && (
              <span className="mt-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow-md">
                {bets.banker}
              </span>
            )}
          </button>
        </div>

        {/* Deal Coup Button */}
        <div className="z-20 my-2">
          <button
            type="button"
            onClick={dealBaccarat}
            disabled={isPlaying || totalBet <= 0 || totalBet > profile.coins}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-serif font-black text-sm tracking-widest uppercase shadow-xl shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95"
          >
            {isPlaying ? 'DEALING COUP...' : 'DEAL COUP'}
          </button>
        </div>
      </div>

      {/* Chip Selector Tray */}
      <ChipSelector
        selectedChip={selectedChip}
        onSelectChip={chip => setSelectedChip(chip)}
        currentBet={totalBet}
        availableBalance={profile.coins}
        onClearBets={handleClearBets}
        onDoubleBet={handleDoubleBets}
        disabled={isPlaying}
      />
    </div>
  );
};
