import React from 'react';
import { X, BookOpen, CheckCircle, Shield, Award, Sparkles, ChevronRight } from 'lucide-react';
import { GameId } from '../../types';
import { soundManager } from '../../services/sound';

interface InGameRuleDrawerProps {
  gameId: GameId;
  isOpen: boolean;
  onClose: () => void;
}

export const InGameRuleDrawer: React.FC<InGameRuleDrawerProps> = ({ gameId, isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleClose = () => {
    soundManager.playButtonClick();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#11131a] border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#161823]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base sm:text-lg text-slate-100">
                {gameId === 'teen_patti' && 'Teen Patti Royal – Game Rules & Strategy'}
                {gameId === 'blackjack' && 'Blackjack 21 – Table Rules & Payouts'}
                {gameId === 'roulette' && 'European Roulette – Betting Guide'}
                {gameId === 'poker' && "Texas Hold'em Poker – Rules & Hand Ranks"}
                {gameId === 'baccarat' && 'VIP Baccarat – Punto Banco Rules'}
                {gameId === 'dice' && 'Dice Arena – Prediction Guide'}
                {gameId === 'slots' && 'Royal Ace Slots – Paytable & Bonus Guide'}
                {gameId === 'plinko' && 'Royal Plinko – Peg Board & Risk Guide'}
                {gameId === 'crash' && 'Rocket Crash – Flight & Cash-Out Guide'}
                {gameId === 'mines' && 'Royal Mines – Vault Grid & Multiplier Guide'}
                {gameId === 'keno' && 'Royal Keno – Numbers, Hits & Hypergeometric Paytable Guide'}
                {gameId === 'hilo' && 'Royal Hi-Lo – Rules, Card Ranks & Dynamic Odds Guide'}
                {gameId === 'horse_racing' && 'Royal Horse Racing – Derby Betting & Plackett-Luce Odds Guide'}
                {gameId === 'bingo' && 'Royal Bingo – Official 90-Ball Ticket & Milestone Guide'}
                {gameId === 'deal_no_deal' && 'Royal Deal or No Deal – Briefcase & Banker Rules Guide'}
              </h2>
              <p className="text-[11px] text-slate-400">Everything you need to master this table</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rules Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* TEEN PATTI RULES */}
          {gameId === 'teen_patti' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Hold the best 3-card hand according to Teen Patti rankings, or bluff your opponents into packing (folding) before the final showdown.
              </div>

              <div className="space-y-2">
                <h3 className="font-serif font-bold text-amber-300 text-sm uppercase tracking-wide">
                  1. Blind vs. Seen (Chaal) Mechanics
                </h3>
                <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                  <li><strong className="text-slate-100">Boot Amount:</strong> Every seated player contributes the initial boot into the center pot.</li>
                  <li><strong className="text-slate-100">Blind Player:</strong> Bets without seeing cards. Wagers the current stake amount. Maximum 4 blind turns per player.</li>
                  <li><strong className="text-slate-100">See Cards:</strong> Click anytime on your turn to inspect your hand. Once seen, you play as a Seen player.</li>
                  <li><strong className="text-slate-100">Seen Player (Chaal):</strong> Must bet at least double the blind stake amount.</li>
                  <li><strong className="text-slate-100">Raise:</strong> A player can double the active stake to put pressure on remaining competitors.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-serif font-bold text-amber-300 text-sm uppercase tracking-wide">
                  2. Table Limits & Special Actions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="font-semibold text-amber-400">Pot Limit Cap</div>
                    <p className="text-[11px] text-slate-400">
                      When the center pot reaches the designated table cap, a mandatory Showdown triggers automatically between all active players.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                    <div className="font-semibold text-amber-400">Sideshow & Show</div>
                    <p className="text-[11px] text-slate-400">
                      Sideshow allows comparing cards secretly with the previous Seen player. When 2 players remain, either can request a final Show!
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-serif font-bold text-amber-300 text-sm uppercase tracking-wide">
                  3. Official Teen Patti Hand Rankings (Highest to Lowest)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-400">1. Trail / Trio / Set:</span>
                    <p className="text-[11px] text-slate-300">3 cards of identical rank. AAA is the highest trail, 222 is the lowest trail.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-400">2. Pure Sequence (Pakki Round):</span>
                    <p className="text-[11px] text-slate-300">Straight Flush: 3 consecutive cards of the SAME suit. Order: A-K-Q (highest) &gt; A-2-3 (second highest) &gt; K-Q-J down to 4-3-2.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-400">3. Sequence (Normal Run):</span>
                    <p className="text-[11px] text-slate-300">Straight: 3 consecutive cards of mixed suits. Order: A-K-Q &gt; A-2-3 &gt; K-Q-J down to 4-3-2.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/40 space-y-1">
                    <span className="font-bold text-purple-300">4. Color / Flush / Rung:</span>
                    <p className="text-[11px] text-slate-200">
                      <strong>3 cards of the exact SAME SUIT</strong> (♠, ♥, ♦, or ♣). <em>Strictly beats all Pairs and High Cards</em>, regardless of card values! Higher card in flush breaks flush ties.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-400">5. Pair / Double:</span>
                    <p className="text-[11px] text-slate-300">Two cards of identical rank + 1 kicker. Higher pair rank wins; tied pairs are decided by kicker.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-400">6. High Card:</span>
                    <p className="text-[11px] text-slate-300">No matching combo. Evaluated by highest card, then second, then third.</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] space-y-1">
                <span className="font-bold text-amber-300">Official Tie-Breaker Rule:</span>
                <p className="text-slate-300">
                  Suits have equal ranking in Teen Patti. If two active hands have completely identical card ranks during Showdown or Sideshow, <strong>the player who requested and paid for the Show/Sideshow loses the tie</strong>!
                </p>
              </div>
            </div>
          )}

          {/* BLACKJACK RULES */}
          {gameId === 'blackjack' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Build a hand totaling as close to 21 as possible without busting (going over 21), and beat the dealer’s hand total.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Card Values:</strong> Aces count as 1 or 11. Face cards (K, Q, J) count as 10. Number cards count at face value.</li>
                <li><strong className="text-slate-100">Hit:</strong> Take another card to increase hand total.</li>
                <li><strong className="text-slate-100">Stand:</strong> Hold your current total and end your turn.</li>
                <li><strong className="text-slate-100">Double Down:</strong> Double your wager and receive exactly one final card.</li>
                <li><strong className="text-slate-100">Split:</strong> Split any pair of identical ranks into two separate hands with equal bets.</li>
                <li><strong className="text-slate-100">Insurance:</strong> Offered when the dealer's face-up card is an Ace.</li>
                <li><strong className="text-slate-100">Dealer Rules:</strong> Dealer must hit until reaching at least 17, and stand on 17 or higher.</li>
              </ul>
            </div>
          )}

          {/* ROULETTE RULES */}
          {gameId === 'roulette' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Predict which numbered pocket the spinning ball will come to rest in on the European 37-pocket wheel (0 to 36).
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Straight Bet:</strong> Bet directly on any single number (0 through 36). Highest payout!</li>
                <li><strong className="text-slate-100">Outside Bets:</strong> Red or Black, Even or Odd, Low (1–18) or High (19–36).</li>
                <li><strong className="text-slate-100">Dozens & Columns:</strong> 1st 12 (1–12), 2nd 12 (13–24), 3rd 12 (25–36), or any of the 3 vertical columns.</li>
                <li><strong className="text-slate-100">Zero (0):</strong> The green pocket belongs exclusively to the house for outside bets.</li>
              </ul>
            </div>
          )}

          {/* POKER RULES */}
          {gameId === 'poker' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Form the best 5-card poker hand using your 2 private hole cards and the 5 shared community cards.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Rounds:</strong> Pre-flop (2 private cards), Flop (3 community cards), Turn (4th card), River (5th card), Showdown.</li>
                <li><strong className="text-slate-100">Actions:</strong> Check, Call, Raise, or Fold at each betting round.</li>
                <li><strong className="text-slate-100">Rankings:</strong> Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, One Pair, High Card.</li>
              </ul>
            </div>
          )}

          {/* BACCARAT RULES */}
          {gameId === 'baccarat' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Wager on whether the Player hand or Banker hand will finish with a total closest to 9, or if they will Tie.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Card Scoring:</strong> Aces count as 1. Tens and face cards count as 0. 2–9 count at face value. Only the last digit of the sum counts (e.g., 7 + 8 = 15 &rarr; 5).</li>
                <li><strong className="text-slate-100">Natural:</strong> An initial total of 8 or 9 on 2 cards is a Natural win.</li>
                <li><strong className="text-slate-100">Third-Card Rules:</strong> Automated strictly according to official international tableau rules.</li>
              </ul>
            </div>
          )}

          {/* DICE ARENA RULES */}
          {gameId === 'dice' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Roll two 6-sided dice and correctly predict the combined outcome or special roll combinations.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Under 7 / Over 7:</strong> Predict whether total is 2–6 (Under) or 8–12 (Over).</li>
                <li><strong className="text-slate-100">Lucky 7:</strong> Hits when combined roll is exactly 7.</li>
                <li><strong className="text-slate-100">Any Double:</strong> Hits when both dice show the exact same number (1-1, 2-2, etc.).</li>
                <li><strong className="text-slate-100">Exact Sums:</strong> Wager on exact totals from 2 to 12. Snake Eyes (2) and Boxcars (12) have high payouts!</li>
              </ul>
            </div>
          )}

          {/* SLOTS RULES */}
          {gameId === 'slots' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Spin the 5 video reels and align 3, 4, or 5 matching symbols across the 20 active winning paylines.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Royal Crown (Wild):</strong> Substitutes for any regular symbol to complete winning lines.</li>
                <li><strong className="text-slate-100">Gold Scatter:</strong> 3 or more Scatters anywhere on the reels trigger 10 Free Spins with an active 2x Multiplier.</li>
                <li><strong className="text-slate-100">Rolling Reels:</strong> Click spin to trigger smooth rolling reel animation that stops consecutively across each reel.</li>
              </ul>
            </div>
          )}

          {/* PLINKO RULES */}
          {gameId === 'plinko' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Drop a ball from the top of the peg pyramid and land in the highest-multiplier pocket at the base. Edge slots pay the biggest multipliers!
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Betting Limits:</strong> Wager between 10 and 5,000 virtual coins per drop. Use 1/2, 2x, Max, or +/- buttons to adjust stakes quickly.</li>
                <li><strong className="text-slate-100">Rows (8–16):</strong> Choose between 8 and 16 peg rows. More rows add more slots (rows + 1) and widen outer multipliers.</li>
                <li><strong className="text-slate-100">Risk Levels:</strong> <strong>LOW</strong> delivers steadier center returns; <strong>MEDIUM</strong> balances variance; <strong>HIGH</strong> concentrates massive payouts in outer edge pockets.</li>
                <li><strong className="text-slate-100">Payout &amp; RTP:</strong> Payouts equal Bet &times; Landed Slot Multiplier (rounded to whole coins). All 27 boards target ~97% theoretical RTP under a symmetric binomial distribution.</li>
                <li><strong className="text-slate-100">Auto-Drop:</strong> Schedule sequential automated drops and click Stop Auto at any moment to halt cleanly after the active drop settles.</li>
                <li><strong className="text-slate-100">Local RNG Notice:</strong> Outcomes are generated locally using browser cryptographic randomness (crypto.getRandomValues) with virtual coins only.</li>
              </ul>
            </div>
          )}

          {/* CRASH RULES */}
          {gameId === 'crash' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Launch the rocket and click <strong>CASH OUT</strong> before the flight crashes to lock in your bet multiplied by the current climb value.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Betting &amp; Launch:</strong> Wager 10 to 5,000 virtual coins per flight. The multiplier begins at 1.00x and accelerates smoothly upward up to 1,000.00x.</li>
                <li><strong className="text-slate-100">Manual Cash-Out:</strong> Click CASH OUT strictly before the crash point to win Bet &times; Cash-Out Multiplier (rounded to whole coins).</li>
                <li><strong className="text-slate-100">Auto Cash-Out:</strong> Optionally set a target (1.01x–1,000x) before launch. If the flight reaches your target before crashing, it settles automatically.</li>
                <li><strong className="text-slate-100">Immediate 1.00x Crash:</strong> Under the 97% RTP inverse curve, ~3% of flights crash immediately at 1.00x before any cash-out is possible.</li>
                <li><strong className="text-slate-100">Local RNG Notice:</strong> The crash point is generated locally via browser cryptographic randomness (crypto.getRandomValues) before liftoff, using fictional virtual coins only.</li>
              </ul>
            </div>
          )}

          {/* MINES RULES */}
          {gameId === 'mines' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Reveal safe diamond tiles on the 5×5 grid without triggering a hidden mine. Cash out anytime after at least one diamond reveal to lock in your multiplied virtual coin payout.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Board &amp; Mine Setup:</strong> Pick between 1 and 24 mines before starting a round (Safe tiles = 25 − Mines). Wager 10 to 5,000 virtual coins.</li>
                <li><strong className="text-slate-100">Exact Multiplier Formula:</strong> After K safe diamonds, survival probability is <span className="font-mono text-slate-200">P(K) = Π (S−i)/(25−i)</span> and multiplier equals <span className="font-mono text-emerald-300">0.97 / P(K)</span> (97% theoretical RTP).</li>
                <li><strong className="text-slate-100">Cash Out or Full Clear:</strong> Cash out after 1 or more diamonds for <span className="font-mono text-slate-200">Bet × Multiplier</span> rounded to whole coins. Revealing every safe tile automatically awards the maximum payout.</li>
                <li><strong className="text-slate-100">Mine Hit:</strong> Uncovering a mine ends the round immediately, reveals all remaining mines, and forfeits the stake.</li>
                <li><strong className="text-slate-100">Auto Play &amp; Local RNG:</strong> Optionally configure automated rounds with safe pick counts and profit/loss limits. Mine positions are fixed before the first click using <span className="font-mono text-slate-200">crypto.getRandomValues</span> with fictional coins only.</li>
              </ul>
            </div>
          )}

          {/* KENO RULES */}
          {gameId === 'keno' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Select 1 to 10 numbers on the 80-number board. The royal machine draws 20 unique numbers at random. Match your chosen numbers to hit payout tiers!
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Number Selection (1–10 spots):</strong> Click any numbers on the 1–80 card to toggle selection, or use Quick Pick buttons (Pick 3, 5, 8, 10).</li>
                <li><strong className="text-slate-100">20 Ball Draw:</strong> 20 unique balls are drawn sequentially from the 80-ball cage using cryptographic Fisher-Yates randomness (<span className="font-mono text-slate-200">crypto.getRandomValues</span>).</li>
                <li><strong className="text-slate-100">Hypergeometric Distribution:</strong> True mathematical probabilities: <span className="font-mono text-slate-200">P(H) = C(S, H) × C(80−S, 20−H) / C(80, 20)</span>.</li>
                <li><strong className="text-slate-100">Calibrated ~97% RTP:</strong> Every spot selection (1 through 10) provides ~97.00% theoretical return to player. High multipliers reach up to 60,000x for a 10-of-10 catch!</li>
                <li><strong className="text-slate-100">Auto Play:</strong> Run automated consecutive draws with automatic stop conditions on profit targets or bankroll loss thresholds.</li>
                <li><strong className="text-slate-100">Virtual Currency:</strong> All bets, wins, and balances utilize fictional entertainment coins with zero real-money risk.</li>
              </ul>
            </div>
          )}

          {/* HI-LO RULES */}
          {gameId === 'hilo' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Predict whether the next card dealt will have a Higher or Lower rank than the active reference card. Cash out anytime after a correct prediction!
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Card Rankings:</strong> 2 (lowest) up to Ace (14, highest). 52 unique cards per round shuffled with cryptographic randomness.</li>
                <li><strong className="text-slate-100">Higher:</strong> Wins if revealed card rank &gt; current card rank.</li>
                <li><strong className="text-slate-100">Lower:</strong> Wins if revealed card rank &lt; current card rank.</li>
                <li><strong className="text-cyan-300 font-bold">Push on Equal Rank:</strong> If the next card has the EXACT same rank, the round pushes! Multiplier does not change, and you continue from the new card.</li>
                <li><strong className="text-slate-100">Dynamic Multipliers (97% RTP):</strong> Calculated as <span className="font-mono text-emerald-400">0.97 / P(Outcome)</span> based on the actual composition of remaining cards.</li>
                <li><strong className="text-slate-100">Streak Compounding:</strong> Multipliers compound across consecutive wins: <span className="font-mono text-slate-200">Potential Payout = Bet × Total Multiplier</span>.</li>
                <li><strong className="text-slate-100">Cash Out:</strong> Available after every correct prediction. Collect your multiplied payout instantly.</li>
                <li><strong className="text-slate-100">Incorrect Guess:</strong> Ends the round immediately and forfeits the initial wager.</li>
              </ul>
            </div>
          )}

          {/* HORSE RACING RULES */}
          {gameId === 'horse_racing' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Study the 6 thoroughbreds, choose your wager type and horse picks, and watch the live derby sprint down the emerald turf to the photo finish.
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Win (1 Horse):</strong> Your chosen horse must finish 1st.</li>
                <li><strong className="text-slate-100">Place (1 Horse):</strong> Your chosen horse must finish 1st or 2nd.</li>
                <li><strong className="text-slate-100">Show (1 Horse):</strong> Your chosen horse must finish 1st, 2nd, or 3rd.</li>
                <li><strong className="text-slate-100">Exacta (2 Horses):</strong> Your two picks must finish 1st and 2nd in exact order.</li>
                <li><strong className="text-slate-100">Quinella (2 Horses):</strong> Your two picks must finish 1st and 2nd in either order.</li>
                <li><strong className="text-slate-100">Trifecta (3 Horses):</strong> Your three picks must finish 1st, 2nd, and 3rd in exact order.</li>
                <li><strong className="text-slate-100">Exact Plackett-Luce Odds (95% RTP):</strong> Every race evaluates all 720 possible 6-horse finishing orders from the horses&apos; strength weights. Outcomes are locked via <span className="font-mono text-slate-200">crypto.getRandomValues</span> before the starting gate opens.</li>
                <li><strong className="text-slate-100">Payouts:</strong> Gross Payout = <span className="font-mono text-emerald-300">round(Bet × Multiplier)</span> in fictional virtual coins only.</li>
              </ul>
            </div>
          )}

          {/* BINGO RULES */}
          {gameId === 'bingo' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Play an official 90-ball 3×9 Bingo ticket and complete One Line, Two Lines, and Full House within their challenge call targets to stack cumulative virtual coin rewards!
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Official 3×9 Ticket:</strong> 3 rows × 9 columns with exactly 5 numbers and 4 blanks per row (15 numbers total). Columns span 1–9, 10–19, …, 80–90 in ascending vertical order.</li>
                <li><strong className="text-slate-100">One Line (≤ 35 Calls):</strong> Complete any 1 horizontal row (5 numbers) within 35 calls to earn <span className="text-amber-300 font-bold">5.0x</span> your bet.</li>
                <li><strong className="text-slate-100">Two Lines (≤ 55 Calls):</strong> Complete any 2 horizontal rows (10 numbers) within 55 calls to earn <span className="text-amber-300 font-bold">10.0x</span> your bet.</li>
                <li><strong className="text-slate-100">Full House (≤ 75 Calls):</strong> Mark all 15 numbers within 75 calls to earn <span className="text-amber-300 font-bold">13.9x</span> your bet (up to <span className="text-emerald-300 font-bold">28.9x</span> combined!).</li>
                <li><strong className="text-slate-100">Continuous Draw &amp; Fairness:</strong> Missing an earlier target never stops the draw—later milestones remain live up to Full House or call 90. Draws use unbiased cryptographic Fisher-Yates shuffling (~95.05% theoretical RTP).</li>
                <li><strong className="text-slate-100">Draw Controls:</strong> Draw balls manually one-by-one, toggle Auto-Draw (Normal / Fast), or click Finish Draw at any time.</li>
              </ul>
            </div>
          )}

          {/* DEAL OR NO DEAL RULES */}
          {gameId === 'deal_no_deal' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200">
                <span className="font-bold text-amber-300">Objective:</span> Claim 1 of 26 golden briefcases containing hidden prize multipliers from 0.01x up to 1,000x, eliminate other briefcases round by round, and decide whether to accept the Banker&apos;s dynamic offer or trust your briefcase to the end!
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-100">Entry Bet &amp; Wallet:</strong> Wager 10 to 2,000 virtual coins. Your stake is deducted once at game start and remains locked for the entire game.</li>
                <li><strong className="text-slate-100">26 Unique Briefcases:</strong> Multipliers (0.01x, 0.05x, 0.10x, 0.25x, 0.50x, 0.75x, 1x, 2x, 3x, 5x, 7.5x, 10x, 15x, 20x, 25x, 35x, 50x, 75x, 100x, 150x, 200x, 250x, 350x, 500x, 750x, 1,000x) are shuffled cryptographically via <span className="font-mono text-slate-200">crypto.getRandomValues</span> and locked for the full game.</li>
                <li><strong className="text-slate-100">Personal Case:</strong> Choose your personal case first; it stays sealed and protected from accidental opening until the final result.</li>
                <li><strong className="text-slate-100">Opening Schedule:</strong> Round 1: open 6 cases · Round 2: 5 · Round 3: 4 · Round 4: 3 · Round 5: 2 · Round 6 onward: 1 per round.</li>
                <li><strong className="text-slate-100">Dynamic Banker Offer:</strong> Calculated strictly from remaining unopened briefcases (including yours): <span className="font-mono text-emerald-300">Offer = Bet × (EV × Banker %)</span>, scaling progressively from 55% early game up to 85% in the final stage.</li>
                <li><strong className="text-slate-100">DEAL vs NO DEAL:</strong> Choosing <strong>DEAL</strong> (after confirmation) ends the round immediately and credits the exact Banker offer (your personal case is shown for curiosity only and not paid in addition). Choosing <strong>NO DEAL</strong> costs nothing extra and unlocks the next round.</li>
                <li><strong className="text-slate-100">Final Keep or Swap:</strong> Reject the final 2-case offer to either <strong>KEEP MY CASE</strong> or <strong>SWAP MY CASE</strong> for the last remaining stage case.</li>
                <li><strong className="text-slate-100">Payouts &amp; Settlement:</strong> Gross Payout = <span className="font-mono text-slate-200">round(Bet × Final Multiplier)</span>; Net Profit/Loss = Gross Payout − Original Bet. Credited once to your ROYAL ACE virtual wallet.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#161823] flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs uppercase tracking-wider transition-transform active:scale-95"
          >
            Back to Game Table
          </button>
        </div>
      </div>
    </div>
  );
};
