import React, { useState, useRef, useEffect } from 'react';
import { ChipDenomination, UserProfile, RouletteBetType, RoulettePlacedBet, RouletteHistoryItem } from '../../types';
import { ChipSelector } from '../../components/common/ChipSelector';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { ArrowLeft, BookOpen, RotateCcw, Volume2 } from 'lucide-react';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';

interface RouletteGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// European wheel pocket order (standard sequence)
const WHEEL_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RouletteGame: React.FC<RouletteGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [selectedChip, setSelectedChip] = useState<ChipDenomination>(50);
  const [bets, setBets] = useState<RoulettePlacedBet[]>([]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<RouletteHistoryItem[]>([
    { number: 26, color: 'black' },
    { number: 7, color: 'red' },
    { number: 0, color: 'green' },
    { number: 17, color: 'black' },
    { number: 32, color: 'red' },
  ]);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);

  const totalBet = bets.reduce((acc, b) => acc + b.amount, 0);

  const getNumberColor = (num: number): 'red' | 'black' | 'green' => {
    if (num === 0) return 'green';
    return RED_NUMBERS.includes(num) ? 'red' : 'black';
  };

  const handlePlaceBet = (type: RouletteBetType, number?: number) => {
    if (isSpinning) return;
    if (profile.coins < totalBet + selectedChip) return;

    soundManager.playChipClick();
    const existingIndex = bets.findIndex(
      b => b.type === type && (type !== 'straight' || b.number === number)
    );

    if (existingIndex >= 0) {
      const updated = [...bets];
      updated[existingIndex].amount += selectedChip;
      setBets(updated);
    } else {
      const newBet: RoulettePlacedBet = {
        id: 'rbet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type,
        number,
        amount: selectedChip,
      };
      setBets([...bets, newBet]);
    }
  };

  const handleClearBets = () => {
    if (isSpinning) return;
    soundManager.playButtonClick();
    setBets([]);
  };

  const handleDoubleBets = () => {
    if (isSpinning || bets.length === 0) return;
    if (profile.coins < totalBet * 2) return;
    soundManager.playChipStack();
    const doubled = bets.map(b => ({ ...b, amount: b.amount * 2 }));
    setBets(doubled);
  };

  // Spin Wheel
  const spinWheel = () => {
    if (isSpinning || totalBet <= 0 || totalBet > profile.coins) return;

    // Deduct total bet atomically
    const tx = storageManager.executeTransaction('bet', 'roulette', totalBet, `Roulette Wager: ${totalBet} coins`);
    if (!tx.success) return;
    onUpdateProfile();

    setIsSpinning(true);
    setWinningNumber(null);
    setRoundResult(null);

    // Pick random winning number
    const targetNum = Math.floor(Math.random() * 37);
    const targetIndex = WHEEL_SEQUENCE.indexOf(targetNum);
    const degPerPocket = 360 / 37;

    // Mathematically exact alignment with the 12 o'clock needle:
    // Initial angle of pocket targetIndex is (targetIndex * degPerPocket)
    // To land at 12 o'clock (0 deg), (targetIndex * degPerPocket + targetDeg) % 360 must equal 0
    const targetRemainder = (360 - (targetIndex * degPerPocket)) % 360;
    const currentMod = wheelRotation % 360;
    let delta = targetRemainder - currentMod;
    if (delta <= 0) delta += 360;
    const fullSpins = 360 * 6; // 6 full clockwise spins for smooth deceleration
    const targetDeg = wheelRotation + fullSpins + delta;
    setWheelRotation(targetDeg);

    // Sound effect ticks
    const tickInterval = setInterval(() => {
      soundManager.playRouletteTick(1.2);
    }, 180);

    setTimeout(() => {
      clearInterval(tickInterval);
      soundManager.playRouletteTick(0.8);
      finishSpin(targetNum);
    }, 3800);
  };

  const finishSpin = (num: number) => {
    setIsSpinning(false);
    setWinningNumber(num);
    const numColor = getNumberColor(num);

    // Update history
    setHistory(prev => [{ number: num, color: numColor }, ...prev.slice(0, 9)]);

    // Evaluate all bets
    let totalWon = 0;
    let hasWinningBet = false;

    bets.forEach(b => {
      let isWin = false;
      let payoutMultiplier = 0;

      if (b.type === 'straight' && b.number === num) {
        isWin = true;
        payoutMultiplier = 36; // 35:1 profit + original bet
        storageManager.updateAchievementProgress('roulette_straight', 1);
      } else if (b.type === 'red' && numColor === 'red') {
        isWin = true;
        payoutMultiplier = 2; // 1:1
      } else if (b.type === 'black' && numColor === 'black') {
        isWin = true;
        payoutMultiplier = 2;
      } else if (b.type === 'even' && num !== 0 && num % 2 === 0) {
        isWin = true;
        payoutMultiplier = 2;
      } else if (b.type === 'odd' && num % 2 === 1) {
        isWin = true;
        payoutMultiplier = 2;
      } else if (b.type === 'low' && num >= 1 && num <= 18) {
        isWin = true;
        payoutMultiplier = 2;
      } else if (b.type === 'high' && num >= 19 && num <= 36) {
        isWin = true;
        payoutMultiplier = 2;
      } else if (b.type === 'dozen1' && num >= 1 && num <= 12) {
        isWin = true;
        payoutMultiplier = 3; // 2:1
      } else if (b.type === 'dozen2' && num >= 13 && num <= 24) {
        isWin = true;
        payoutMultiplier = 3;
      } else if (b.type === 'dozen3' && num >= 25 && num <= 36) {
        isWin = true;
        payoutMultiplier = 3;
      } else if (b.type === 'col1' && num > 0 && num % 3 === 1) {
        isWin = true;
        payoutMultiplier = 3;
      } else if (b.type === 'col2' && num > 0 && num % 3 === 2) {
        isWin = true;
        payoutMultiplier = 3;
      } else if (b.type === 'col3' && num > 0 && num % 3 === 0) {
        isWin = true;
        payoutMultiplier = 3;
      }

      if (isWin) {
        hasWinningBet = true;
        totalWon += b.amount * payoutMultiplier;
      }
    });

    if (totalWon > 0) {
      storageManager.executeTransaction('win', 'roulette', totalWon, `Roulette Win on ${num} (${numColor}): +${totalWon}`);
      soundManager.playWin();
      setCelebrateWin(true);
      setRoundResult(`Number ${num} (${numColor.toUpperCase()})! You won +${totalWon.toLocaleString()} coins!`);
      storageManager.recordGameRound('roulette', true, totalWon);
    } else {
      soundManager.playLoss();
      setRoundResult(`Number ${num} (${numColor.toUpperCase()}). House wins.`);
      storageManager.recordGameRound('roulette', false);
    }

    onUpdateProfile();
  };

  const getBetOnType = (type: RouletteBetType, number?: number): number => {
    const found = bets.find(b => b.type === type && (type !== 'straight' || b.number === number));
    return found ? found.amount : 0;
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#0a1f16]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rule Drawer */}
      <InGameRuleDrawer
        gameId="roulette"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Header */}
      <div className="w-full bg-[#0d2a1e]/90 border-b border-emerald-900/60 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-emerald-200">
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
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">European Roulette</span>
            <span className="text-[10px] text-emerald-300/80">European Single Zero Wheel</span>
          </div>
        </div>

        {/* History Trail */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 hidden sm:inline">History:</span>
          <div className="flex items-center gap-1">
            {history.slice(0, 5).map((h, i) => (
              <span
                key={i}
                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-sm ${
                  h.color === 'red' ? 'bg-red-600' : h.color === 'black' ? 'bg-slate-900 border border-slate-700' : 'bg-emerald-600'
                }`}
              >
                {h.number}
              </span>
            ))}
          </div>
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

      {/* Main Game Stage */}
      <div className="casino-felt-surface flex-1 flex flex-col items-center justify-center p-3 sm:p-5 select-none relative">
        {/* Animated Roulette Wheel & Results Header */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-3 w-full max-w-4xl">
          {/* Wheel SVG */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-amber-500/80 p-1.5 bg-gradient-to-br from-[#4a2411] to-[#1a0a03] shadow-2xl flex items-center justify-center">
            {/* Spinning Rotor */}
            <div
              className="w-full h-full rounded-full transition-transform duration-[3800ms] cubic-bezier(0.12, 0.8, 0.2, 1) relative overflow-hidden"
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="48" fill="#1e130c" stroke="#d4af37" strokeWidth="2" />
                {WHEEL_SEQUENCE.map((num, i) => {
                  const angle = (i * 360) / 37;
                  const color = getNumberColor(num);
                  const fillColor = color === 'red' ? '#dc2626' : color === 'black' ? '#0f172a' : '#15803d';
                  const isWinningPocket = winningNumber === num && !isSpinning;
                  return (
                    <g key={num} transform={`rotate(${angle} 50 50)`}>
                      <path
                        d="M50 50 L46 3 A47 47 0 0 1 54 3 Z"
                        fill={isWinningPocket ? '#facc15' : fillColor}
                        stroke={isWinningPocket ? '#ffffff' : '#7a5e18'}
                        strokeWidth={isWinningPocket ? '1.2' : '0.4'}
                      />
                      <text
                        x="50"
                        y="10"
                        fontSize={isWinningPocket ? '4.5' : '3.8'}
                        fill={isWinningPocket ? '#0a0b0e' : '#fef08a'}
                        fontWeight="black"
                        textAnchor="middle"
                        transform={`rotate(180 50 10)`}
                      >
                        {num}
                      </text>
                    </g>
                  );
                })}
                {/* Center brass hub */}
                <circle cx="50" cy="50" r="14" fill="url(#brassGrad)" stroke="#fef08a" strokeWidth="1.5" />
                <defs>
                  <radialGradient id="brassGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff3c4" />
                    <stop offset="60%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#7a5e18" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
            {/* Precision Golden Needle at 12 O'Clock (Center of Top Edge) */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
              <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[16px] border-t-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-300 border border-amber-600 -mt-1 shadow" />
            </div>
          </div>

          {/* Outcome & Spin Button */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">Winning Pocket:</span>
              {winningNumber !== null ? (
                <div
                  className={`px-3 py-1 rounded-lg font-serif font-black text-xl text-white shadow-lg ${
                    getNumberColor(winningNumber) === 'red'
                      ? 'bg-red-600'
                      : getNumberColor(winningNumber) === 'black'
                      ? 'bg-slate-900 border border-slate-700'
                      : 'bg-emerald-600'
                  }`}
                >
                  {winningNumber} {getNumberColor(winningNumber).toUpperCase()}
                </div>
              ) : (
                <span className="text-slate-400 text-xs italic">Awaiting Spin</span>
              )}
            </div>

            {roundResult && (
              <div className="mt-2 text-xs sm:text-sm font-semibold text-amber-300 bg-black/60 px-3 py-1.5 rounded-lg border border-amber-500/30">
                {roundResult}
              </div>
            )}

            <button
              type="button"
              onClick={spinWheel}
              disabled={isSpinning || totalBet <= 0 || totalBet > profile.coins}
              className="mt-3 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm tracking-widest uppercase shadow-xl shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              {isSpinning ? 'SPINNING...' : 'SPIN WHEEL'}
            </button>
          </div>
        </div>

        {/* European Roulette Betting Grid */}
        <div className="w-full max-w-3xl overflow-x-auto pb-2">
          <div className="min-w-[580px] bg-[#0c2f21] border-2 border-amber-500/50 rounded-xl p-2 shadow-2xl flex flex-col gap-1.5">
            {/* Top: 0 Pocket + 3x12 Numbers Grid + 2:1 Column Bets */}
            <div className="flex items-stretch gap-1">
              {/* 0 Pocket (Green) */}
              <button
                type="button"
                onClick={() => handlePlaceBet('straight', 0)}
                className="w-12 bg-emerald-800 hover:bg-emerald-700 border border-emerald-500/60 rounded flex flex-col items-center justify-center relative font-serif font-black text-base text-white transition-colors"
              >
                0
                {getBetOnType('straight', 0) > 0 && (
                  <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-sans text-[10px] font-bold shadow">
                    {getBetOnType('straight', 0)}
                  </span>
                )}
              </button>

              {/* 12 Columns of 3 rows: [3,6,9...36], [2,5,8...35], [1,4,7...34] */}
              <div className="flex-1 grid grid-rows-3 gap-1">
                {/* Row 3 (3, 6, 9 ... 36) */}
                <div className="grid grid-cols-12 gap-1">
                  {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(num => {
                    const color = getNumberColor(num);
                    const betAmt = getBetOnType('straight', num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePlaceBet('straight', num)}
                        className={`h-9 rounded flex items-center justify-center font-bold text-xs text-white relative transition-all ${
                          color === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                        } border border-slate-700/60`}
                      >
                        {num}
                        {betAmt > 0 && (
                          <span className="absolute -top-1.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 font-sans text-[9px] font-bold">
                            {betAmt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Row 2 (2, 5, 8 ... 35) */}
                <div className="grid grid-cols-12 gap-1">
                  {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(num => {
                    const color = getNumberColor(num);
                    const betAmt = getBetOnType('straight', num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePlaceBet('straight', num)}
                        className={`h-9 rounded flex items-center justify-center font-bold text-xs text-white relative transition-all ${
                          color === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                        } border border-slate-700/60`}
                      >
                        {num}
                        {betAmt > 0 && (
                          <span className="absolute -top-1.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 font-sans text-[9px] font-bold">
                            {betAmt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Row 1 (1, 4, 7 ... 34) */}
                <div className="grid grid-cols-12 gap-1">
                  {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(num => {
                    const color = getNumberColor(num);
                    const betAmt = getBetOnType('straight', num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePlaceBet('straight', num)}
                        className={`h-9 rounded flex items-center justify-center font-bold text-xs text-white relative transition-all ${
                          color === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                        } border border-slate-700/60`}
                      >
                        {num}
                        {betAmt > 0 && (
                          <span className="absolute -top-1.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 font-sans text-[9px] font-bold">
                            {betAmt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column Bets */}
              <div className="w-12 grid grid-rows-3 gap-1">
                {[
                  { key: 'col3', label: 'COL 3' },
                  { key: 'col2', label: 'COL 2' },
                  { key: 'col1', label: 'COL 1' },
                ].map(col => {
                  const betAmt = getBetOnType(col.key as RouletteBetType);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => handlePlaceBet(col.key as RouletteBetType)}
                      className="rounded bg-emerald-900 hover:bg-emerald-800 border border-emerald-600/50 flex items-center justify-center text-[10px] font-bold text-amber-300 relative"
                    >
                      {col.label}
                      {betAmt > 0 && (
                        <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-bold">
                          {betAmt}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dozen Bets (1st 12, 2nd 12, 3rd 12) */}
            <div className="grid grid-cols-3 gap-1 pl-12 pr-12">
              {[
                { type: 'dozen1', label: '1st 12' },
                { type: 'dozen2', label: '2nd 12' },
                { type: 'dozen3', label: '3rd 12' },
              ].map(d => {
                const betAmt = getBetOnType(d.type as RouletteBetType);
                return (
                  <button
                    key={d.type}
                    type="button"
                    onClick={() => handlePlaceBet(d.type as RouletteBetType)}
                    className="py-1.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/50 text-xs font-semibold text-amber-200 relative"
                  >
                    {d.label}
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-bold">
                        {betAmt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Outside 1:1 Bets (1-18, Even, Red, Black, Odd, 19-36) */}
            <div className="grid grid-cols-6 gap-1 pl-12 pr-12">
              {[
                { type: 'low', label: '1 to 18' },
                { type: 'even', label: 'EVEN' },
                { type: 'red', label: 'RED', isRed: true },
                { type: 'black', label: 'BLACK', isBlack: true },
                { type: 'odd', label: 'ODD' },
                { type: 'high', label: '19 to 36' },
              ].map(ob => {
                const betAmt = getBetOnType(ob.type as RouletteBetType);
                return (
                  <button
                    key={ob.type}
                    type="button"
                    onClick={() => handlePlaceBet(ob.type as RouletteBetType)}
                    className={`py-1.5 rounded text-xs font-bold relative transition-colors ${
                      ob.isRed
                        ? 'bg-red-700 hover:bg-red-600 text-white'
                        : ob.isBlack
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200'
                    } border border-emerald-600/40`}
                  >
                    {ob.label}
                    {betAmt > 0 && (
                      <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-bold">
                        {betAmt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Chip Denomination Bar */}
      <ChipSelector
        selectedChip={selectedChip}
        onSelectChip={chip => setSelectedChip(chip)}
        currentBet={totalBet}
        availableBalance={profile.coins}
        onClearBets={handleClearBets}
        onDoubleBet={handleDoubleBets}
        disabled={isSpinning}
      />
    </div>
  );
};
