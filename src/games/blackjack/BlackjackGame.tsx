import React, { useState, useEffect } from 'react';
import { Card, ChipDenomination, UserProfile } from '../../types';
import { createDeck, calculateBlackjackScore, isNaturalBlackjack } from '../../utils/cards';
import { PlayingCard } from '../../components/common/PlayingCard';
import { ChipSelector } from '../../components/common/ChipSelector';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { RotateCcw, Shield, BookOpen, ArrowLeft } from 'lucide-react';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';

interface BlackjackGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface SplitHand {
  cards: Card[];
  bet: number;
  isStood: boolean;
  isBust: boolean;
  isDoubled: boolean;
  score: number;
  outcome?: 'win' | 'loss' | 'push' | 'blackjack' | 'bust';
}

export const BlackjackGame: React.FC<BlackjackGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [deck, setDeck] = useState<Card[]>([]);
  const [selectedChip, setSelectedChip] = useState<ChipDenomination>(50);
  const [bet, setBet] = useState<number>(100);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [splitHands, setSplitHands] = useState<SplitHand[]>([]);
  const [activeSplitIndex, setActiveSplitIndex] = useState<number>(0);
  const [phase, setPhase] = useState<'betting' | 'playing' | 'dealer_turn' | 'round_over'>('betting');
  const [insuranceBet, setInsuranceBet] = useState<number>(0);
  const [showInsurancePrompt, setShowInsurancePrompt] = useState<boolean>(false);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  // Initialize deck on mount
  useEffect(() => {
    setDeck(createDeck(6));
  }, []);

  const handleChipAdd = (chip: ChipDenomination) => {
    if (phase !== 'betting') return;
    if (profile.coins >= bet + chip) {
      setBet(prev => prev + chip);
    }
  };

  const handleClearBet = () => {
    if (phase !== 'betting') return;
    setBet(0);
  };

  const handleDoubleBet = () => {
    if (phase !== 'betting') return;
    if (profile.coins >= bet * 2) {
      setBet(prev => prev * 2);
    }
  };

  const handleAllIn = () => {
    if (phase !== 'betting') return;
    setBet(profile.coins);
  };

  // Start new deal
  const dealRound = () => {
    if (bet <= 0 || bet > profile.coins) return;

    // Deduct initial bet atomically
    const tx = storageManager.executeTransaction('bet', 'blackjack', bet, `Blackjack Wager: ${bet} coins`);
    if (!tx.success) return;
    onUpdateProfile();

    let curDeck = [...deck];
    if (curDeck.length < 20) {
      curDeck = createDeck(6);
    }

    soundManager.playCardDeal();

    const pCard1 = curDeck.pop()!;
    const dCard1 = curDeck.pop()!;
    const pCard2 = curDeck.pop()!;
    const dCard2 = { ...curDeck.pop()!, isHidden: true }; // Hole card

    setDeck(curDeck);
    setPlayerCards([pCard1, pCard2]);
    setDealerCards([dCard1, dCard2]);
    setSplitHands([]);
    setRoundResult(null);
    setInsuranceBet(0);

    // Check if dealer shows Ace for Insurance
    if (dCard1.rank === 'A' && profile.coins >= Math.floor(bet / 2)) {
      setShowInsurancePrompt(true);
    } else {
      setShowInsurancePrompt(false);
      checkInitialNaturals([pCard1, pCard2], [dCard1, dCard2]);
    }

    setPhase('playing');
  };

  const handleInsurance = (take: boolean) => {
    setShowInsurancePrompt(false);
    if (take) {
      const insAmount = Math.floor(bet / 2);
      const tx = storageManager.executeTransaction('insurance', 'blackjack', insAmount, 'Blackjack Insurance Bet');
      if (tx.success) {
        setInsuranceBet(insAmount);
        onUpdateProfile();
      }
    }
    checkInitialNaturals(playerCards, dealerCards);
  };

  const checkInitialNaturals = (pCards: Card[], dCards: Card[]) => {
    const playerNat = isNaturalBlackjack(pCards);
    const dealerNat = isNaturalBlackjack(dCards);

    if (playerNat || dealerNat) {
      // Reveal dealer hole card
      const revealedDealer = dCards.map(c => ({ ...c, isHidden: false }));
      setDealerCards(revealedDealer);
      setPhase('round_over');

      if (playerNat && dealerNat) {
        // Push
        storageManager.executeTransaction('win', 'blackjack', bet, 'Blackjack Push - Bet Returned');
        setRoundResult('Both have Blackjack! Push.');
        storageManager.recordGameRound('blackjack', false);
      } else if (playerNat) {
        // Player Blackjack payout (bet + 1.5 * bet)
        const payout = Math.floor(bet + bet * 1.5);
        storageManager.executeTransaction('win', 'blackjack', payout, `Natural Blackjack Win (+${payout})`);
        setRoundResult('BLACKJACK! Natural 21 Winner!');
        soundManager.playBigWin();
        setCelebrateWin(true);
        storageManager.recordGameRound('blackjack', true, payout);
        storageManager.updateAchievementProgress('blackjack_natural', 1);
      } else {
        // Dealer Blackjack
        if (insuranceBet > 0) {
          const insPayout = insuranceBet * 3;
          storageManager.executeTransaction('win', 'blackjack', insPayout, 'Insurance Won');
          setRoundResult('Dealer Blackjack! Insurance protected your bet.');
        } else {
          setRoundResult('Dealer has Natural Blackjack. House wins.');
        }
        soundManager.playLoss();
        storageManager.recordGameRound('blackjack', false);
      }
      onUpdateProfile();
    }
  };

  // Player Actions: Hit
  const handleHit = () => {
    if (phase !== 'playing') return;
    soundManager.playCardDeal();

    const curDeck = [...deck];
    const newCard = curDeck.pop()!;
    setDeck(curDeck);

    if (splitHands.length > 0) {
      const activeHand = { ...splitHands[activeSplitIndex] };
      activeHand.cards = [...activeHand.cards, newCard];
      const score = calculateBlackjackScore(activeHand.cards);
      activeHand.score = score.score;
      if (score.isBust) {
        activeHand.isBust = true;
        activeHand.isStood = true;
      }
      const updatedSplit = [...splitHands];
      updatedSplit[activeSplitIndex] = activeHand;
      setSplitHands(updatedSplit);

      if (score.isBust) {
        if (activeSplitIndex < splitHands.length - 1) {
          setActiveSplitIndex(activeSplitIndex + 1);
        } else {
          startDealerTurn(updatedSplit);
        }
      }
    } else {
      const newPlayerCards = [...playerCards, newCard];
      setPlayerCards(newPlayerCards);
      const score = calculateBlackjackScore(newPlayerCards);
      if (score.isBust) {
        // Player Busts
        const revealedDealer = dealerCards.map(c => ({ ...c, isHidden: false }));
        setDealerCards(revealedDealer);
        setPhase('round_over');
        setRoundResult('Bust! Over 21.');
        soundManager.playLoss();
        storageManager.recordGameRound('blackjack', false);
        onUpdateProfile();
      }
    }
  };

  // Stand
  const handleStand = () => {
    if (phase !== 'playing') return;
    soundManager.playButtonClick();

    if (splitHands.length > 0) {
      const updated = [...splitHands];
      updated[activeSplitIndex].isStood = true;
      setSplitHands(updated);

      if (activeSplitIndex < splitHands.length - 1) {
        setActiveSplitIndex(activeSplitIndex + 1);
      } else {
        startDealerTurn(updated);
      }
    } else {
      startDealerTurn();
    }
  };

  // Double Down
  const handleDoubleDown = () => {
    if (phase !== 'playing' || playerCards.length !== 2) return;
    if (profile.coins < bet) return;

    // Deduct double bet
    const tx = storageManager.executeTransaction('bet', 'blackjack', bet, `Double Down Additional Bet: ${bet}`);
    if (!tx.success) return;
    onUpdateProfile();

    soundManager.playCardDeal();
    const curDeck = [...deck];
    const doubleCard = curDeck.pop()!;
    setDeck(curDeck);

    const newCards = [...playerCards, doubleCard];
    setPlayerCards(newCards);

    const score = calculateBlackjackScore(newCards);
    if (score.isBust) {
      const revealedDealer = dealerCards.map(c => ({ ...c, isHidden: false }));
      setDealerCards(revealedDealer);
      setPhase('round_over');
      setRoundResult('Bust on Double Down! Over 21.');
      soundManager.playLoss();
      storageManager.recordGameRound('blackjack', false);
      onUpdateProfile();
    } else {
      startDealerTurn(undefined, bet * 2);
    }
  };

  // Split Hands
  const handleSplit = () => {
    if (phase !== 'playing' || playerCards.length !== 2) return;
    if (playerCards[0].rank !== playerCards[1].rank) return;
    if (profile.coins < bet) return;

    // Deduct bet for 2nd split hand
    const tx = storageManager.executeTransaction('split_bet', 'blackjack', bet, `Split Hand Additional Bet: ${bet}`);
    if (!tx.success) return;
    onUpdateProfile();

    const curDeck = [...deck];
    const card1 = playerCards[0];
    const card2 = playerCards[1];
    const newCard1 = curDeck.pop()!;
    const newCard2 = curDeck.pop()!;
    setDeck(curDeck);

    soundManager.playCardDeal();

    const hand1: SplitHand = {
      cards: [card1, newCard1],
      bet,
      isStood: false,
      isBust: false,
      isDoubled: false,
      score: calculateBlackjackScore([card1, newCard1]).score,
    };

    const hand2: SplitHand = {
      cards: [card2, newCard2],
      bet,
      isStood: false,
      isBust: false,
      isDoubled: false,
      score: calculateBlackjackScore([card2, newCard2]).score,
    };

    setSplitHands([hand1, hand2]);
    setActiveSplitIndex(0);
  };

  // Dealer Turn & Final Settlement
  const startDealerTurn = (activeSplits?: SplitHand[], finalSingleBet?: number) => {
    setPhase('dealer_turn');

    let curDealer: Card[] = dealerCards.map(c => ({ ...c, isHidden: false }));
    setDealerCards(curDealer);

    const curDeck = [...deck];
    let dScore = calculateBlackjackScore(curDealer).score;

    // Dealer draws to at least 17
    const drawDealerCards = () => {
      if (dScore < 17) {
        soundManager.playCardDeal();
        const dCard = curDeck.pop()!;
        curDealer = [...curDealer, dCard];
        setDealerCards(curDealer);
        dScore = calculateBlackjackScore(curDealer).score;
        setTimeout(drawDealerCards, 600);
      } else {
        setDeck(curDeck);
        resolveRound(curDealer, activeSplits, finalSingleBet);
      }
    };

    setTimeout(drawDealerCards, 500);
  };

  const resolveRound = (finalDealerCards: Card[], activeSplits?: SplitHand[], effectiveBet?: number) => {
    const dScoreInfo = calculateBlackjackScore(finalDealerCards);
    const dScore = dScoreInfo.score;
    const currentBetAmount = effectiveBet || bet;

    if (activeSplits && activeSplits.length > 0) {
      let totalPayout = 0;
      let wonAny = false;

      const evaluated = activeSplits.map(hand => {
        if (hand.isBust) {
          return { ...hand, outcome: 'bust' as const };
        }
        if (dScoreInfo.isBust || hand.score > dScore) {
          totalPayout += hand.bet * 2;
          wonAny = true;
          return { ...hand, outcome: 'win' as const };
        } else if (hand.score === dScore) {
          totalPayout += hand.bet;
          return { ...hand, outcome: 'push' as const };
        } else {
          return { ...hand, outcome: 'loss' as const };
        }
      });

      setSplitHands(evaluated);
      setPhase('round_over');

      if (totalPayout > 0) {
        storageManager.executeTransaction('win', 'blackjack', totalPayout, `Split Hands Return: +${totalPayout}`);
        soundManager.playWin();
        if (wonAny) setCelebrateWin(true);
        setRoundResult(`Dealer finished with ${dScore}. Split hands resolved! Total Return: ${totalPayout.toLocaleString()}`);
        storageManager.recordGameRound('blackjack', wonAny, totalPayout);
        storageManager.updateAchievementProgress('split_victory', 1);
      } else {
        soundManager.playLoss();
        setRoundResult(`Dealer finished with ${dScore}. House wins split hands.`);
        storageManager.recordGameRound('blackjack', false);
      }
      onUpdateProfile();
      return;
    }

    // Single Hand Evaluation
    const pScoreInfo = calculateBlackjackScore(playerCards);
    const pScore = pScoreInfo.score;

    setPhase('round_over');

    if (dScoreInfo.isBust) {
      const payout = currentBetAmount * 2;
      storageManager.executeTransaction('win', 'blackjack', payout, `Dealer Busts! Player Wins +${payout}`);
      setRoundResult(`Dealer BUSTS with ${dScore}! Player Wins +${payout.toLocaleString()}!`);
      soundManager.playWin();
      setCelebrateWin(true);
      storageManager.recordGameRound('blackjack', true, payout);
      if (effectiveBet && effectiveBet > bet) {
        storageManager.updateAchievementProgress('double_down_win', 1);
      }
    } else if (pScore > dScore) {
      const payout = currentBetAmount * 2;
      storageManager.executeTransaction('win', 'blackjack', payout, `Player Wins (${pScore} vs ${dScore})`);
      setRoundResult(`Player Wins! ${pScore} beats Dealer's ${dScore} (+${payout.toLocaleString()})`);
      soundManager.playWin();
      setCelebrateWin(true);
      storageManager.recordGameRound('blackjack', true, payout);
      if (effectiveBet && effectiveBet > bet) {
        storageManager.updateAchievementProgress('double_down_win', 1);
      }
    } else if (pScore === dScore) {
      storageManager.executeTransaction('win', 'blackjack', currentBetAmount, 'Push - Bet Returned');
      setRoundResult(`Push! Both have ${pScore}. Bet returned.`);
      storageManager.recordGameRound('blackjack', false);
    } else {
      setRoundResult(`Dealer Wins. ${dScore} beats ${pScore}.`);
      soundManager.playLoss();
      storageManager.recordGameRound('blackjack', false);
    }
    onUpdateProfile();
  };

  const playerScore = calculateBlackjackScore(playerCards);
  const dealerScore = calculateBlackjackScore(dealerCards);
  const canSplit =
    phase === 'playing' &&
    playerCards.length === 2 &&
    playerCards[0].rank === playerCards[1].rank &&
    splitHands.length === 0 &&
    profile.coins >= bet;
  const canDouble =
    phase === 'playing' && playerCards.length === 2 && splitHands.length === 0 && profile.coins >= bet;

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#071d13]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rule Drawer */}
      <InGameRuleDrawer
        gameId="blackjack"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Table Felt Header Bar */}
      <div className="w-full bg-[#0a2318]/90 border-b border-emerald-900/60 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-200 shadow-md">
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
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">Blackjack VIP 21</span>
            <span className="text-[10px] text-emerald-300/80">Dealer Stands on Soft 17</span>
          </div>
        </div>

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

      {/* Felt Playing Area */}
      <div className="casino-felt-surface flex-1 flex flex-col items-center justify-around py-4 px-3 sm:px-6 relative select-none">
        {/* Table Print Centerpiece */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
          <div className="w-64 sm:w-96 h-36 sm:h-48 border-2 border-amber-300 rounded-full flex flex-col items-center justify-center p-4 text-center">
            <span className="font-serif font-black text-amber-300 text-lg sm:text-2xl tracking-widest uppercase">
              ROYAL ACE VIP
            </span>
            <span className="text-xs text-amber-200 mt-1 uppercase tracking-wider">Royal Ace VIP Table</span>
            <span className="text-[10px] text-amber-200/80 mt-0.5">Dealer must stand on 17</span>
          </div>
        </div>

        {/* Dealer Zone */}
        <div className="flex flex-col items-center gap-2 z-10">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300/90 tracking-wide uppercase">
            <span>Dealer Hand</span>
            {dealerCards.length > 0 && !dealerCards[1]?.isHidden && (
              <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30 text-amber-300 font-mono tabular-nums">
                {dealerScore.score}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 min-h-[96px]">
            {dealerCards.map((c, i) => (
              <PlayingCard key={c.id || i} card={c} size="md" />
            ))}
          </div>
        </div>

        {/* Center Round Banner / Insurance Prompt */}
        <div className="z-10 my-1 w-full max-w-md px-2 text-center">
          {showInsurancePrompt && (
            <div className="bg-[#12141c]/95 border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl animate-in zoom-in-95">
              <div className="text-amber-400 font-serif font-bold text-sm sm:text-base">Dealer shows Ace! Take Insurance?</div>
              <div className="text-xs text-slate-300 mt-1">
                Cost: {Math.floor(bet / 2).toLocaleString()} coins · Protects against Dealer Blackjack
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => handleInsurance(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Yes, Take Insurance
                </button>
                <button
                  type="button"
                  onClick={() => handleInsurance(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
                >
                  Pass
                </button>
              </div>
            </div>
          )}

          {roundResult && !showInsurancePrompt && (
            <div className="inline-block bg-black/85 border border-amber-400/50 rounded-xl px-4 py-2 shadow-xl backdrop-blur-md">
              <div className="font-serif font-bold text-amber-300 text-sm sm:text-base">{roundResult}</div>
            </div>
          )}
        </div>

        {/* Player Zone */}
        <div className="flex flex-col items-center gap-2 z-10">
          {splitHands.length > 0 ? (
            /* Split Hands View */
            <div className="flex items-start gap-4 sm:gap-8">
              {splitHands.map((sh, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                    activeSplitIndex === idx && phase === 'playing'
                      ? 'bg-amber-500/10 border-2 border-amber-400'
                      : 'border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs text-emerald-200 mb-1">
                    <span>Hand {idx + 1}</span>
                    <span className="font-mono text-amber-300">({sh.score})</span>
                    {sh.outcome && (
                      <span className="text-[10px] font-bold uppercase text-amber-400">· {sh.outcome}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sh.cards.map((c, i) => (
                      <PlayingCard key={c.id || i} card={c} size="md" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Standard Single Hand View */
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 min-h-[96px]">
                {playerCards.map((c, i) => (
                  <PlayingCard key={c.id || i} card={c} size="md" />
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300/90 tracking-wide uppercase">
                <span>Player Hand</span>
                {playerCards.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30 text-amber-300 font-mono tabular-nums">
                    {playerScore.score} {playerScore.isSoft ? '(Soft)' : ''}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* In-Game Action Buttons */}
        {phase === 'playing' && !showInsurancePrompt && (
          <div className="z-20 flex items-center justify-center gap-2 sm:gap-3 my-2 flex-wrap">
            <button
              type="button"
              onClick={handleHit}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 transition-transform active:scale-95"
            >
              HIT
            </button>
            <button
              type="button"
              onClick={handleStand}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold text-sm shadow-lg shadow-red-950/60 transition-transform active:scale-95"
            >
              STAND
            </button>
            {canDouble && (
              <button
                type="button"
                onClick={handleDoubleDown}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-950/60 transition-transform active:scale-95"
              >
                DOUBLE
              </button>
            )}
            {canSplit && (
              <button
                type="button"
                onClick={handleSplit}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-950/60 transition-transform active:scale-95"
              >
                SPLIT
              </button>
            )}
          </div>
        )}

        {/* Round Over New Deal Button */}
        {phase === 'round_over' && (
          <div className="z-20 my-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setPhase('betting');
                setDealerCards([]);
                setPlayerCards([]);
                setSplitHands([]);
                setRoundResult(null);
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-wider uppercase shadow-xl shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Next Hand</span>
            </button>
          </div>
        )}

        {/* Betting Phase Deal Button */}
        {phase === 'betting' && (
          <div className="z-20 my-2">
            <button
              type="button"
              onClick={dealRound}
              disabled={bet <= 0 || bet > profile.coins}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-base tracking-widest uppercase shadow-xl shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              DEAL CARDS
            </button>
          </div>
        )}
      </div>

      {/* Chip Denomination Tray */}
      <ChipSelector
        selectedChip={selectedChip}
        onSelectChip={chip => {
          setSelectedChip(chip);
          handleChipAdd(chip);
        }}
        currentBet={bet}
        availableBalance={profile.coins}
        onClearBets={handleClearBet}
        onDoubleBet={handleDoubleBet}
        onAllIn={handleAllIn}
        disabled={phase !== 'betting'}
      />
    </div>
  );
};
