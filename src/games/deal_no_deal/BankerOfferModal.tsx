import React, { useEffect, useState } from 'react';
import { BankerOfferSnapshot, DealNoDealState } from '../../types';
import {
  calculateDealCoins,
  formatDealMultiplier,
  getBankerPercentageForRound,
} from './dealMath';
import {
  PhoneCall,
  Handshake,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  Coins,
} from 'lucide-react';

interface BankerOfferModalProps {
  gameState: DealNoDealState;
  offer: BankerOfferSnapshot;
  previousOffers: BankerOfferSnapshot[];
  originalBet: number;
  playerCaseNumber: number;
  onClickDeal: () => void;
  onConfirmDeal: () => void;
  onCancelDealConfirm: () => void;
  onClickNoDeal: () => void;
}

/**
 * Animated Banker studio call, offer count-up reveal, DEAL confirmation,
 * and NO DEAL dramatic rejection overlay.
 */
export const BankerOfferModal: React.FC<BankerOfferModalProps> = ({
  gameState,
  offer,
  previousOffers,
  originalBet,
  playerCaseNumber,
  onClickDeal,
  onConfirmDeal,
  onCancelDealConfirm,
  onClickNoDeal,
}) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [animatedCoins, setAnimatedCoins] = useState<number>(
    prefersReducedMotion ? offer.offerCoins : 0
  );

  // Smooth count-up animation when entering BANKER_OFFER
  useEffect(() => {
    if (gameState !== 'BANKER_OFFER') return;
    if (prefersReducedMotion) {
      setAnimatedCoins(offer.offerCoins);
      return;
    }

    let rafId = 0;
    const durationMs = 780;
    const startTs = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedCoins(Math.round(offer.offerCoins * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [gameState, offer.offerCoins, prefersReducedMotion]);

  const { stageLabel } = getBankerPercentageForRound(
    offer.roundNumber,
    offer.remainingCasesCount
  );

  const lowestCoins = calculateDealCoins(originalBet, offer.lowestRemainingMultiplier);
  const highestCoins = calculateDealCoins(originalBet, offer.highestRemainingMultiplier);
  const potentialNet = offer.offerCoins - originalBet;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Banker Offer"
    >
      {/* 1. BANKER IS CALLING */}
      {gameState === 'BANKER_CALL' && (
        <div className="my-auto w-full max-w-sm rounded-3xl border border-rose-500/45 bg-gradient-to-b from-[#1a0d16] via-[#0e0c18] to-[#080a12] p-7 text-center shadow-[0_0_60px_rgba(225,29,72,0.3)]">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <span className="animate-dnd-ring-pulse absolute inset-0 rounded-full border-2 border-amber-400/70" />
            <span
              className="animate-dnd-ring-pulse absolute inset-2 rounded-full border-2 border-rose-400/70"
              style={{ animationDelay: '0.35s' }}
            />
            <div className="animate-dnd-phone-ring relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-br from-rose-600 to-amber-600 text-white shadow-xl">
              <PhoneCall className="h-8 w-8" />
            </div>
          </div>

          <h2 className="mt-5 font-serif text-xl sm:text-2xl font-black tracking-wider text-amber-300">
            BANKER IS CALLING
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300">
            Calculating your Round {offer.roundNumber} offer from {offer.remainingCasesCount} remaining briefcases...
          </p>
        </div>
      )}

      {/* 2. BANKER OFFER PRESENTATION */}
      {gameState === 'BANKER_OFFER' && (
        <div className="my-auto w-full max-w-lg rounded-3xl border-2 border-amber-400/55 bg-gradient-to-b from-[#14192c] via-[#0c1120] to-[#070a13] p-4 sm:p-6 shadow-[0_0_70px_rgba(245,158,11,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                Round {offer.roundNumber} · {stageLabel}
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-black text-white">
                The Banker&apos;s Offer
              </h2>
            </div>
            <div className="text-right text-xs text-slate-400 tabular-nums">
              <div>Your Case: #{playerCaseNumber}</div>
              <div>{offer.remainingCasesCount} cases left</div>
            </div>
          </div>

          {/* Main Offer Hero Box */}
          <div className="mt-4 rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-500/15 via-[#101628] to-slate-950/90 px-4 py-5 text-center shadow-inner">
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-200/80">
              Guaranteed Payout If You Deal
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-3xl sm:text-4xl font-black tabular-nums text-amber-300">
              <Coins className="h-7 w-7 shrink-0 text-amber-400" />
              <span>{animatedCoins.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm font-bold tabular-nums text-slate-200">
              {formatDealMultiplier(offer.offerMultiplier)} of your {originalBet.toLocaleString()} coin bet
              <span
                className={`ml-2 ${
                  potentialNet > 0
                    ? 'text-emerald-400'
                    : potentialNet === 0
                    ? 'text-slate-300'
                    : 'text-rose-400'
                }`}
              >
                ({potentialNet >= 0 ? '+' : ''}
                {potentialNet.toLocaleString()} net)
              </span>
            </div>
          </div>

          {/* Transparent EV & Board Breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs tabular-nums sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 text-center">
              <div className="text-[10px] text-slate-400">Avg Remaining</div>
              <div className="mt-0.5 font-black text-slate-100">
                {formatDealMultiplier(offer.averageRemainingMultiplier)}
              </div>
              <div className="text-[10px] text-amber-300/80">
                {Math.round(offer.bankerPercentage * 100)}% of EV
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 text-center">
              <div className="text-[10px] text-slate-400">Lowest Left</div>
              <div className="mt-0.5 font-black text-sky-300">
                {formatDealMultiplier(offer.lowestRemainingMultiplier)}
              </div>
              <div className="text-[10px] text-slate-400">{lowestCoins.toLocaleString()}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 text-center">
              <div className="text-[10px] text-slate-400">Highest Left</div>
              <div className="mt-0.5 font-black text-amber-300">
                {formatDealMultiplier(offer.highestRemainingMultiplier)}
              </div>
              <div className="text-[10px] text-slate-400">{highestCoins.toLocaleString()}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 text-center">
              <div className="text-[10px] text-slate-400">Original Bet</div>
              <div className="mt-0.5 font-black text-white">
                {originalBet.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">Locked</div>
            </div>
          </div>

          {/* Previous Offers Ledger */}
          {previousOffers.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 tabular-nums">
              <span className="font-semibold text-slate-300">Past Offers:</span>
              {previousOffers.map(prev => (
                <span key={prev.roundNumber}>
                  R{prev.roundNumber}: {prev.offerCoins.toLocaleString()} ({formatDealMultiplier(prev.offerMultiplier)})
                </span>
              ))}
            </div>
          )}

          {/* Decision Buttons: DEAL vs NO DEAL */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClickDeal}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300 px-4 py-3 text-sm sm:text-base font-black uppercase tracking-wider text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition hover:brightness-110 active:scale-95"
            >
              <Handshake className="h-5 w-5 shrink-0" />
              <span>DEAL</span>
            </button>

            <button
              type="button"
              onClick={onClickNoDeal}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 px-4 py-3 text-sm sm:text-base font-black uppercase tracking-wider text-white shadow-[0_8px_24px_rgba(225,29,72,0.35)] transition hover:brightness-110 active:scale-95"
            >
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>NO DEAL</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. DEAL CONFIRMATION DIALOG */}
      {gameState === 'DEAL_CONFIRMATION' && (
        <div className="my-auto w-full max-w-md rounded-3xl border-2 border-emerald-400/60 bg-gradient-to-b from-[#0e1c24] via-[#0b1320] to-[#080b14] p-5 sm:p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/50 bg-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-3 font-serif text-xl font-black text-white">
            Confirm Your Deal?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300">
            Accepting ends the game immediately and credits the exact Banker offer below. Your personal briefcase (#{playerCaseNumber}) will be revealed for suspense only and will not be paid in addition.
          </p>

          <div className="mt-4 rounded-2xl border border-amber-400/35 bg-slate-950/85 p-4 tabular-nums">
            <div className="text-xs text-slate-400">Final Accepted Payout</div>
            <div className="mt-1 text-3xl font-black text-amber-300">
              {offer.offerCoins.toLocaleString()} coins
            </div>
            <div className="mt-0.5 text-xs font-semibold text-slate-300">
              {formatDealMultiplier(offer.offerMultiplier)} · Net{' '}
              <span className={potentialNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {potentialNet >= 0 ? '+' : ''}
                {potentialNet.toLocaleString()} coins
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancelDealConfirm}
              className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-200 transition hover:border-amber-400/50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Go Back</span>
            </button>
            <button
              type="button"
              onClick={onConfirmDeal}
              className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-amber-300 px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110"
            >
              <Handshake className="h-4 w-4" />
              <span>Confirm Deal</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. NO DEAL DRAMATIC RESPONSE */}
      {gameState === 'NO_DEAL_RESPONSE' && (
        <div className="animate-dnd-slam my-auto w-full max-w-md rounded-3xl border-2 border-rose-500/70 bg-gradient-to-b from-rose-950/90 via-[#150b12] to-[#090a12] p-7 text-center shadow-[0_0_70px_rgba(225,29,72,0.45)]">
          <div className="text-xs font-bold uppercase tracking-widest text-rose-300">
            Offer Rejected ({offer.offerCoins.toLocaleString()} coins)
          </div>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-black tracking-wide text-white">
            THE PLAYER SAYS NO DEAL!
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-rose-200/85">
            {offer.remainingCasesCount <= 2
              ? 'Preparing the final Keep or Swap showdown...'
              : 'Unlocking the next round of briefcases...'}
          </p>
        </div>
      )}
    </div>
  );
};
