import React, { useState } from 'react';
import { ChipDenomination, UserProfile, DiceBetType, DicePlacedBet, DiceRollResult } from '../../types';
import { ChipSelector } from '../../components/common/ChipSelector';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { ArrowLeft, BookOpen, RotateCcw, Dices } from 'lucide-react';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';

interface DiceGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

const EXACT_ODDS: Record<number, number> = {
  2: 30.0,
  3: 15.0,
  4: 10.0,
  5: 8.0,
  6: 6.0,
  7: 5.0,
  8: 6.0,
  9: 8.0,
  10: 10.0,
  11: 15.0,
  12: 30.0,
};

export const DiceGame: React.FC<DiceGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [selectedChip, setSelectedChip] = useState<ChipDenomination>(50);
  const [bets, setBets] = useState<DicePlacedBet[]>([]);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [dice, setDice] = useState<[number, number]>([3, 4]);
  const [diceRotations, setDiceRotations] = useState<{ d1: number; d2: number }>({ d1: 0, d2: 0 });
  const [history, setHistory] = useState<DiceRollResult[]>([
    { die1: 4, die2: 5, total: 9, isDouble: false },
    { die1: 3, die2: 3, total: 6, isDouble: true },
    { die1: 1, die2: 6, total: 7, isDouble: false },
    { die1: 5, die2: 6, total: 11, isDouble: false },
  ]);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  const totalBet = bets.reduce((a, b) => a + b.amount, 0);

  const handleAddBet = (type: DiceBetType, exactNumber?: number) => {
    if (isRolling) return;
    if (profile.coins < totalBet + selectedChip) return;

    soundManager.playChipClick();
    const existingIndex = bets.findIndex(
      b => b.type === type && (type !== 'exact' || b.exactNumber === exactNumber)
    );

    let multiplier = 2.0;
    if (type === 'lucky7') multiplier = 5.0;
    if (type === 'doubles') multiplier = 6.0;
    if (type === 'exact' && exactNumber) multiplier = EXACT_ODDS[exactNumber] || 5.0;

    if (existingIndex >= 0) {
      const updated = [...bets];
      updated[existingIndex].amount += selectedChip;
      setBets(updated);
    } else {
      const newBet: DicePlacedBet = {
        type,
        exactNumber,
        amount: selectedChip,
        multiplier,
      };
      setBets([...bets, newBet]);
    }
  };

  const handleClearBets = () => {
    if (isRolling) return;
    soundManager.playButtonClick();
    setBets([]);
  };

  const handleDoubleBets = () => {
    if (isRolling || bets.length === 0) return;
    if (profile.coins < totalBet * 2) return;
    soundManager.playChipStack();
    setBets(bets.map(b => ({ ...b, amount: b.amount * 2 })));
  };

  // Roll the Dice
  const rollDice = () => {
    if (isRolling || totalBet <= 0 || totalBet > profile.coins) return;

    const tx = storageManager.executeTransaction('bet', 'dice', totalBet, `Dice Arena Wager: ${totalBet} coins`);
    if (!tx.success) return;
    onUpdateProfile();

    setIsRolling(true);
    setRoundResult(null);
    soundManager.playDiceRoll();

    // Random tumble animations
    const targetD1 = Math.floor(Math.random() * 6) + 1;
    const targetD2 = Math.floor(Math.random() * 6) + 1;

    setDiceRotations({
      d1: diceRotations.d1 + 720 + Math.floor(Math.random() * 360),
      d2: diceRotations.d2 - 720 - Math.floor(Math.random() * 360),
    });

    // Rapid flicker
    let count = 0;
    const interval = setInterval(() => {
      setDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      count++;
      if (count > 10) {
        clearInterval(interval);
        setDice([targetD1, targetD2]);
        finishRoll(targetD1, targetD2);
      }
    }, 90);
  };

  const finishRoll = (d1: number, d2: number) => {
    setIsRolling(false);
    const sum = d1 + d2;
    const isDouble = d1 === d2;

    const result: DiceRollResult = { die1: d1, die2: d2, total: sum, isDouble };
    setHistory(prev => [result, ...prev.slice(0, 9)]);

    let totalWon = 0;

    bets.forEach(b => {
      let won = false;
      if (b.type === 'over' && sum > 7) won = true;
      else if (b.type === 'under' && sum < 7) won = true;
      else if (b.type === 'lucky7' && sum === 7) {
        won = true;
        storageManager.updateAchievementProgress('dice_lucky7', 1);
      } else if (b.type === 'doubles' && isDouble) won = true;
      else if (b.type === 'exact' && b.exactNumber === sum) won = true;

      if (won) {
        totalWon += Math.floor(b.amount * b.multiplier);
      }
    });

    if (totalWon > 0) {
      storageManager.executeTransaction('win', 'dice', totalWon, `Dice Win (Sum ${sum}): +${totalWon}`);
      soundManager.playWin();
      setCelebrateWin(true);
      setRoundResult(`Rolled ${d1} & ${d2} = ${sum}${isDouble ? ' (DOUBLES!)' : ''}! Won +${totalWon.toLocaleString()} coins!`);
      storageManager.recordGameRound('dice', true, totalWon);
    } else {
      soundManager.playLoss();
      setRoundResult(`Rolled ${d1} & ${d2} = ${sum}. House wins.`);
      storageManager.recordGameRound('dice', false);
    }

    onUpdateProfile();
  };

  const getBetAmount = (type: DiceBetType, exactNum?: number): number => {
    const found = bets.find(b => b.type === type && (type !== 'exact' || b.exactNumber === exactNum));
    return found ? found.amount : 0;
  };

  const renderDieFace = (num: number, rot: number) => {
    // 3D Die Pip Rendering
    const pips: Record<number, number[][]> = {
      1: [[50, 50]],
      2: [[25, 25], [75, 75]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[25, 25], [75, 25], [25, 75], [75, 75]],
      5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
      6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
    };

    return (
      <div
        className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-400 rounded-2xl shadow-2xl p-2 relative flex items-center justify-center transition-transform duration-700 select-none"
        style={{ transform: `rotate(${rot}deg)` }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {pips[num]?.map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={num === 1 ? 14 : 9}
              fill={num === 1 ? '#dc2626' : '#0f172a'}
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#10141f]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rule Drawer */}
      <InGameRuleDrawer
        gameId="dice"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Header */}
      <div className="w-full bg-[#141926]/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onBackToLobby();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
          <div className="flex flex-col">
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">Dice Arena</span>
            <span className="text-[10px] text-slate-400">High / Low / Lucky 7 · Multipliers up to 30x</span>
          </div>
        </div>

        {/* Recent Rolls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 hidden sm:inline">Recent:</span>
          <div className="flex items-center gap-1">
            {history.slice(0, 5).map((h, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  h.total === 7
                    ? 'bg-amber-500 text-slate-950'
                    : h.total > 7
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : 'bg-blue-950 text-blue-300 border border-blue-800'
                }`}
              >
                {h.total}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setShowRulesDrawer(true);
            }}
            className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1 transition-colors ml-2"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-xs">Rules</span>
          </button>
        </div>
      </div>

      {/* Main Dice Arena Stage */}
      <div className="flex-1 flex flex-col items-center justify-around p-3 sm:p-5 select-none relative">
        {/* Dice Rolling Arena */}
        <div className="flex flex-col items-center gap-4 my-2 z-10">
          <div className="flex items-center gap-6 p-4 rounded-3xl bg-[#090b10]/80 border border-amber-500/30 shadow-2xl">
            {renderDieFace(dice[0], diceRotations.d1)}
            {renderDieFace(dice[1], diceRotations.d2)}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Dice Total:</span>
            <span className="font-serif font-black text-2xl text-amber-300 tabular-nums">
              {dice[0] + dice[1]}
            </span>
          </div>

          {roundResult && (
            <div className="text-xs sm:text-sm font-semibold text-amber-300 bg-black/60 px-4 py-1.5 rounded-xl border border-amber-500/30">
              {roundResult}
            </div>
          )}

          <button
            type="button"
            onClick={rollDice}
            disabled={isRolling || totalBet <= 0 || totalBet > profile.coins}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-serif font-black text-sm tracking-widest uppercase shadow-xl shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95 flex items-center gap-2"
          >
            <Dices className="w-4 h-4" />
            <span>{isRolling ? 'ROLLING...' : 'ROLL DICE'}</span>
          </button>
        </div>

        {/* Primary Bets: Under 7, Lucky 7, Over 7, Any Double */}
        <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-4 gap-2 z-10">
          <button
            type="button"
            onClick={() => handleAddBet('under')}
            disabled={isRolling}
            className="p-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/40 text-center relative transition-all"
          >
            <div className="font-serif font-bold text-blue-300 text-xs sm:text-sm">UNDER 7</div>
            <div className="text-[10px] text-blue-200/60">2.0x Payout</div>
            {getBetAmount('under') > 0 && (
              <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">
                {getBetAmount('under')}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleAddBet('lucky7')}
            disabled={isRolling}
            className="p-3 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/60 text-center relative transition-all"
          >
            <div className="font-serif font-black text-amber-300 text-xs sm:text-sm">LUCKY 7</div>
            <div className="text-[10px] text-amber-200/60">5.0x Payout</div>
            {getBetAmount('lucky7') > 0 && (
              <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">
                {getBetAmount('lucky7')}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleAddBet('over')}
            disabled={isRolling}
            className="p-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-center relative transition-all"
          >
            <div className="font-serif font-bold text-red-300 text-xs sm:text-sm">OVER 7</div>
            <div className="text-[10px] text-red-200/60">2.0x Payout</div>
            {getBetAmount('over') > 0 && (
              <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">
                {getBetAmount('over')}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleAddBet('doubles')}
            disabled={isRolling}
            className="p-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-center relative transition-all"
          >
            <div className="font-serif font-bold text-purple-300 text-xs sm:text-sm">ANY DOUBLE</div>
            <div className="text-[10px] text-purple-200/60">6.0x Payout</div>
            {getBetAmount('doubles') > 0 && (
              <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">
                {getBetAmount('doubles')}
              </span>
            )}
          </button>
        </div>

        {/* Exact Sum Grid (2 to 12) */}
        <div className="w-full max-w-2xl bg-[#0b0d14] p-3 rounded-xl border border-slate-800 z-10">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
            Exact Outcome Predictions (High Multipliers)
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => {
              const odds = EXACT_ODDS[num];
              const betAmt = getBetAmount('exact', num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleAddBet('exact', num)}
                  disabled={isRolling}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 flex flex-col items-center justify-center relative transition-colors"
                >
                  <span className="font-bold text-amber-300 text-xs">{num}</span>
                  <span className="text-[9px] text-slate-400 font-mono">{odds}x</span>
                  {betAmt > 0 && (
                    <span className="absolute -top-1.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 font-bold text-[9px]">
                      {betAmt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
        disabled={isRolling}
      />
    </div>
  );
};
