import React, { useState } from 'react';
import { X, BookOpen, Award, CheckCircle2 } from 'lucide-react';
import { GameId } from '../../types';
import { soundManager } from '../../services/sound';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGame?: GameId;
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  initialGame = 'blackjack',
}) => {
  const [selectedGame, setSelectedGame] = useState<GameId>(initialGame);

  if (!isOpen) return null;

  const games: { id: GameId; label: string }[] = [
    { id: 'blackjack', label: 'Blackjack 21' },
    { id: 'roulette', label: 'Roulette' },
    { id: 'poker', label: "Texas Hold'em" },
    { id: 'baccarat', label: 'Baccarat' },
    { id: 'teen_patti', label: 'Teen Patti' },
    { id: 'dice', label: 'Dice Arena' },
    { id: 'slots', label: 'Royal Slots' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#12141c] border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#161922]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="font-serif font-bold text-lg text-slate-100">Casino Rulebook & Paytables</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-[#0d0f15] border-b border-slate-800 overflow-x-auto">
          {games.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setSelectedGame(g.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedGame === g.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed">
          {selectedGame === 'blackjack' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">Standard Las Vegas Blackjack Rules</h3>
              <p>
                The goal of Blackjack is to beat the dealer’s hand total without exceeding 21. Aces count as either 1 or 11, face cards (King, Queen, Jack) count as 10, and all other cards are at pip value.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Standard Payouts</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Natural Blackjack: <span className="text-amber-300 font-bold">1.5x Bonus Payout</span></li>
                    <li>• Standard Win: <span className="text-amber-300 font-bold">Even Money Payout</span></li>
                    <li>• Insurance Win: <span className="text-amber-300 font-bold">Double Protection</span></li>
                    <li>• Push (Tie): Bet returned</li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Dealer & Special Rules</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Dealer must draw until at least 17</li>
                    <li>• <span className="font-semibold text-slate-200">Double Down:</span> Double your initial wager and receive exactly one final card</li>
                    <li>• <span className="font-semibold text-slate-200">Split:</span> Split any pair of equal ranks into two independent hands</li>
                    <li>• <span className="font-semibold text-slate-200">Insurance:</span> Offered when dealer shows an Ace</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedGame === 'roulette' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">European Roulette (Single 0)</h3>
              <p>
                European Roulette features 37 numbered pockets from 0 to 36. Number 0 is green, while 1-36 are alternately colored red and black.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Inside Bets</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Straight Up (Single Number): <span className="text-amber-300 font-bold">35x High Payout</span></li>
                    <li>• Split (2 Numbers): <span className="text-amber-300 font-bold">17x Payout</span></li>
                    <li>• Corner (4 Numbers): <span className="text-amber-300 font-bold">8x Payout</span></li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Outside Bets</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Red / Black: <span className="text-amber-300 font-bold">Even Money</span></li>
                    <li>• Odd / Even: <span className="text-amber-300 font-bold">Even Money</span></li>
                    <li>• 1-18 (Low) / 19-36 (High): <span className="text-amber-300 font-bold">Even Money</span></li>
                    <li>• Dozens (1-12, 13-24, 25-36): <span className="text-amber-300 font-bold">2x Payout</span></li>
                    <li>• Columns (1st, 2nd, 3rd Col): <span className="text-amber-300 font-bold">2x Payout</span></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedGame === 'poker' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">Texas Hold'em Poker Rules</h3>
              <p>
                Each player is dealt two private hole cards. Five community cards are dealt face up on the board across four betting rounds: Pre-flop, Flop (3 cards), Turn (1 card), and River (1 card). The best 5-card hand wins the pot.
              </p>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="font-semibold text-amber-400 text-xs">Official Poker Hand Rankings (High to Low):</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>1. Royal Flush (A-K-Q-J-10 suited)</div>
                  <div>2. Straight Flush (5 in order suited)</div>
                  <div>3. Four of a Kind (e.g. 9-9-9-9)</div>
                  <div>4. Full House (Three + Pair)</div>
                  <div>5. Flush (5 of same suit)</div>
                  <div>6. Straight (5 ranks in sequence)</div>
                  <div>7. Three of a Kind</div>
                  <div>8. Two Pair</div>
                  <div>9. One Pair</div>
                  <div>10. High Card</div>
                </div>
              </div>
            </div>
          )}

          {selectedGame === 'baccarat' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">Baccarat (Punto Banco) Rules</h3>
              <p>
                Wager on either the Player hand, the Banker hand, or a Tie. The hand closest to a total of 9 wins. Tens and court cards count as 0, Aces as 1. If total exceeds 9, the first digit is dropped (e.g. 7 + 8 = 15 &rarr; 5).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Standard Payouts</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Player Win: <span className="text-amber-300 font-bold">Even Money Payout</span></li>
                    <li>• Banker Win: <span className="text-amber-300 font-bold">95% Payout</span> (5% virtual commission)</li>
                    <li>• Tie: <span className="text-amber-300 font-bold">8x Payout</span></li>
                    <li>• Player / Banker Pair: <span className="text-amber-300 font-bold">11x Payout</span></li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Official Third-Card Rules</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Natural 8 or 9 on first 2 cards: Neither draws</li>
                    <li>• Player draws a 3rd card on 0-5, stands on 6-7</li>
                    <li>• Banker drawing depends strictly on Player's 3rd card per standard casino tableau</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedGame === 'dice' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">Dice Arena Rules</h3>
              <p>
                Roll two 6-sided dice and predict the combined total outcome.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Categories</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Under 7 (Totals 2–6): <span className="text-amber-300 font-bold">2.0x</span></li>
                    <li>• Over 7 (Totals 8–12): <span className="text-amber-300 font-bold">2.0x</span></li>
                    <li>• Lucky 7 (Total exactly 7): <span className="text-amber-300 font-bold">5.0x</span></li>
                    <li>• Any Double (1-1, 2-2, etc.): <span className="text-amber-300 font-bold">6.0x</span></li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Exact Sum Payouts</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Total 2 (Snake Eyes) or 12: <span className="text-amber-300 font-bold">30.0x</span></li>
                    <li>• Total 3 or 11: <span className="text-amber-300 font-bold">15.0x</span></li>
                    <li>• Total 4 or 10: <span className="text-amber-300 font-bold">10.0x</span></li>
                    <li>• Total 5 or 9: <span className="text-amber-300 font-bold">8.0x</span></li>
                    <li>• Total 6 or 8: <span className="text-amber-300 font-bold">6.0x</span></li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedGame === 'slots' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">Royal Ace 5-Reel Slots</h3>
              <p>
                Spin 5 video slot reels featuring 20 active winning paylines. Match 3, 4, or 5 consecutive symbols from left to right on any payline to win payouts.
              </p>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="font-semibold text-amber-400 text-xs">Special Symbols:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>• <span className="text-amber-300 font-bold">Royal Crown (Wild):</span> Substitutes for all symbols except Scatter</div>
                  <div>• <span className="text-amber-300 font-bold">Gold Scatter:</span> 3 or more Scatters trigger 10 Free Spins with 2x Multiplier!</div>
                  <div>• <span className="text-amber-300 font-bold">Lucky Seven:</span> Pays up to 500x line bet for 5 of a kind</div>
                  <div>• <span className="text-amber-300 font-bold">Gold Bell:</span> Pays up to 250x line bet</div>
                </div>
              </div>
            </div>
          )}

          {selectedGame === 'teen_patti' && (
            <div className="space-y-4">
              <h3 className="font-serif font-bold text-amber-300 text-base">Teen Patti (3 Patti / Indian Poker) Rules</h3>
              <p>
                Teen Patti is a popular Indian 3-card poker game. Every player posts a Boot Amount into the pot and receives 3 private cards face down.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Blind vs. Seen (Chaal)</div>
                  <ul className="space-y-1 text-xs">
                    <li>• <span className="text-slate-200 font-semibold">Blind:</span> Cards remain hidden. Player bets 1x current stake (max 4 blind rounds).</li>
                    <li>• <span className="text-slate-200 font-semibold">Seen (Chaal):</span> Player views cards. Bet must be at least 2x current stake.</li>
                    <li>• <span className="text-slate-200 font-semibold">Raise:</span> Blind raises stake to 2x; Seen raises to 4x.</li>
                    <li>• <span className="text-slate-200 font-semibold">Sideshow:</span> Compare cards secretly with previous Seen player.</li>
                    <li>• <span className="text-slate-200 font-semibold">Pot Limit:</span> When pot reaches limit, automatic Showdown triggers!</li>
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="font-semibold text-amber-400 mb-1">Official Hand Rankings (High to Low)</div>
                  <ul className="space-y-1 text-xs">
                    <li>1. <span className="text-amber-300 font-bold">Trail / Trio:</span> Three of a kind (AAA highest, 222 lowest)</li>
                    <li>2. <span className="text-amber-300 font-bold">Pure Sequence:</span> Straight Flush (A-K-Q &gt; A-2-3 down to 4-3-2 suited)</li>
                    <li>3. <span className="text-amber-300 font-bold">Sequence:</span> Normal Run (A-K-Q &gt; A-2-3 down to 4-3-2 offsuit)</li>
                    <li>4. <span className="text-purple-300 font-bold">Color / Flush:</span> 3 cards of exact same suit (beats Pair &amp; High Card)</li>
                    <li>5. <span className="text-amber-300 font-bold">Pair:</span> Two cards of identical rank + kicker</li>
                    <li>6. <span className="text-amber-300 font-bold">High Card:</span> Highest ranked individual card</li>
                    <li className="pt-1 text-[11px] text-amber-200/80 italic">• Tie rule: Show/Sideshow caller loses equal hands.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
