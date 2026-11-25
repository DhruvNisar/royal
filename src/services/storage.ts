import {
  UserProfile,
  WalletTransaction,
  DailyRewardState,
  DAILY_REWARD_SCHEDULE,
  Achievement,
  DailyQuest,
  SoundSettings,
  GameId,
  TransactionType,
} from '../types';

const STORAGE_KEYS = {
  PROFILE: 'royal_ace_user_profile',
  TRANSACTIONS: 'royal_ace_transactions',
  DAILY_REWARDS: 'royal_ace_daily_rewards',
  ACHIEVEMENTS: 'royal_ace_achievements',
  QUESTS: 'royal_ace_daily_quests',
  SOUND: 'royal_ace_sound_settings',
};

const DEFAULT_PROFILE: UserProfile = {
  id: 'royal_player_' + Math.random().toString(36).substring(2, 9),
  username: 'RoyalHighRoller',
  avatar: 'crown',
  level: 1,
  xp: 0,
  coins: 10000,
  totalWon: 0,
  totalWagered: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  createdAt: Date.now(),
};

const DEFAULT_DAILY_REWARD_STATE: DailyRewardState = {
  currentDay: 1,
  lastClaimDateString: null,
  claimHistory: [],
};

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    title: 'First Taste of Fortune',
    description: 'Win your first virtual casino hand or round',
    rewardCoins: 500,
    iconName: 'Trophy',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'blackjack_natural',
    title: 'Natural 21',
    description: 'Get dealt a natural Blackjack (Ace + 10-value card)',
    rewardCoins: 750,
    iconName: 'Sparkles',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'double_down_win',
    title: 'Double Trouble',
    description: 'Win a round after doubling down in Blackjack',
    rewardCoins: 1000,
    iconName: 'Zap',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'roulette_straight',
    title: 'Precision Gambler',
    description: 'Win a straight-up single number bet on European Roulette',
    rewardCoins: 2500,
    iconName: 'Target',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'poker_showdown',
    title: 'Showdown Victor',
    description: 'Win a Texas Hold\'em hand at the final showdown',
    rewardCoins: 1500,
    iconName: 'Crown',
    progress: 0,
    target: 3,
    completed: false,
  },
  {
    id: 'baccarat_natural',
    title: 'Baccarat Maestro',
    description: 'Win a Baccarat round with a natural 8 or 9',
    rewardCoins: 1200,
    iconName: 'ShieldCheck',
    progress: 0,
    target: 2,
    completed: false,
  },
  {
    id: 'dice_lucky7',
    title: 'Lucky Seven',
    description: 'Win a Lucky 7 bet in Dice Arena',
    rewardCoins: 1000,
    iconName: 'Dice5',
    progress: 0,
    target: 2,
    completed: false,
  },
  {
    id: 'slots_big_win',
    title: 'Jackpot Chaser',
    description: 'Hit a 5-symbol payline match on Royal Slots',
    rewardCoins: 3000,
    iconName: 'Flame',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'coin_magnate',
    title: 'High Roller Elite',
    description: 'Accumulate a virtual bankroll of 25,000 coins',
    rewardCoins: 5000,
    iconName: 'Coins',
    progress: 10000,
    target: 25000,
    completed: false,
  },
  {
    id: 'ten_rounds',
    title: 'Regular at the Tables',
    description: 'Complete 25 total rounds across any casino games',
    rewardCoins: 1500,
    iconName: 'Award',
    progress: 0,
    target: 25,
    completed: false,
  },
  {
    id: 'streak_master',
    title: 'Daily Royalty',
    description: 'Claim your daily reward 3 days in a row',
    rewardCoins: 2000,
    iconName: 'CalendarCheck',
    progress: 0,
    target: 3,
    completed: false,
  },
  {
    id: 'split_victory',
    title: 'Split & Conquer',
    description: 'Successfully win at least one split hand in Blackjack',
    rewardCoins: 1200,
    iconName: 'Scissors',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'mines_first_diamond',
    title: 'First Diamond',
    description: 'Reveal your first safe diamond tile in Royal Mines',
    rewardCoins: 300,
    iconName: 'Gem',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'mines_diamond_hunter',
    title: 'Diamond Hunter',
    description: 'Reveal 100 safe diamond tiles in total in Royal Mines',
    rewardCoins: 1500,
    iconName: 'Gem',
    progress: 0,
    target: 100,
    completed: false,
  },
  {
    id: 'mines_master',
    title: 'Mines Master',
    description: 'Complete 50 rounds of Royal Mines',
    rewardCoins: 2500,
    iconName: 'Crown',
    progress: 0,
    target: 50,
    completed: false,
  },
  {
    id: 'mines_lucky_escape',
    title: 'Lucky Escape',
    description: 'Successfully cash out after revealing 5 or more safe diamonds in Royal Mines',
    rewardCoins: 1000,
    iconName: 'ShieldCheck',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'keno_first_catch',
    title: 'First Royal Catch',
    description: 'Match 3 or more numbers in a single Royal Keno draw',
    rewardCoins: 500,
    iconName: 'Sparkles',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'keno_master',
    title: 'Keno Sovereign',
    description: 'Complete 25 rounds of Royal Keno',
    rewardCoins: 1500,
    iconName: 'Crown',
    progress: 0,
    target: 25,
    completed: false,
  },
  {
    id: 'keno_jackpot_hit',
    title: 'Royal Match 7+',
    description: 'Match 7 or more numbers in a single Royal Keno round',
    rewardCoins: 5000,
    iconName: 'Trophy',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'hilo_first_win',
    title: 'Hi-Lo Prophet',
    description: 'Cash out your first winning prediction streak in Royal Hi-Lo',
    rewardCoins: 500,
    iconName: 'Sparkles',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'hilo_streak_5',
    title: 'Streak Maestro',
    description: 'Achieve a 5-card prediction streak in a single Royal Hi-Lo round',
    rewardCoins: 1500,
    iconName: 'Crown',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'hilo_high_roller',
    title: 'Multiplier Royalty',
    description: 'Cash out with a 10x or higher multiplier in Royal Hi-Lo',
    rewardCoins: 3500,
    iconName: 'Trophy',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'hilo_master',
    title: 'Hi-Lo Sovereign',
    description: 'Complete 25 rounds of Royal Hi-Lo',
    rewardCoins: 2000,
    iconName: 'Award',
    progress: 0,
    target: 25,
    completed: false,
  },
  {
    id: 'horse_first_win',
    title: 'Derby Winner',
    description: 'Win your first virtual bet in Royal Horse Racing',
    rewardCoins: 600,
    iconName: 'Trophy',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'horse_exotic_hit',
    title: 'Exotic Handicapper',
    description: 'Hit an Exacta, Quinella, or Trifecta bet in Royal Horse Racing',
    rewardCoins: 3000,
    iconName: 'Crown',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'bingo_first_line',
    title: 'First Bingo Line',
    description: 'Earn the One Line milestone reward in Royal Bingo',
    rewardCoins: 500,
    iconName: 'Sparkles',
    progress: 0,
    target: 1,
    completed: false,
  },
  {
    id: 'bingo_full_house',
    title: 'Full House Royalty',
    description: 'Complete a Full House within the target call limit in Royal Bingo',
    rewardCoins: 3500,
    iconName: 'Crown',
    progress: 0,
    target: 1,
    completed: false,
  },
];

const INITIAL_QUESTS: DailyQuest[] = [
  {
    id: 'quest_bj_3',
    title: 'Blackjack Sharp',
    description: 'Win 3 rounds of Blackjack 21',
    rewardCoins: 600,
    gameId: 'blackjack',
    progress: 0,
    target: 3,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_roulette_spin',
    title: 'Roulette Spin',
    description: 'Place 3 bets on European Roulette',
    rewardCoins: 400,
    gameId: 'roulette',
    progress: 0,
    target: 3,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_slots_5',
    title: 'Slots Enthusiast',
    description: 'Spin the reels 5 times in Royal Slots',
    rewardCoins: 500,
    gameId: 'slots',
    progress: 0,
    target: 5,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_keno_3',
    title: 'Keno Caller',
    description: 'Play 3 rounds of Royal Keno',
    rewardCoins: 500,
    gameId: 'keno',
    progress: 0,
    target: 3,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_hilo_3',
    title: 'Hi-Lo Predictor',
    description: 'Complete 3 rounds of Royal Hi-Lo',
    rewardCoins: 500,
    gameId: 'hilo',
    progress: 0,
    target: 3,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_horse_2',
    title: 'Derby Enthusiast',
    description: 'Complete 2 races in Royal Horse Racing',
    rewardCoins: 500,
    gameId: 'horse_racing',
    progress: 0,
    target: 2,
    completed: false,
    claimed: false,
  },
  {
    id: 'quest_bingo_2',
    title: 'Bingo Hall Regular',
    description: 'Play 2 rounds of Royal Bingo',
    rewardCoins: 500,
    gameId: 'bingo',
    progress: 0,
    target: 2,
    completed: false,
    claimed: false,
  },
];

class StorageManager {
  private getTodayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- Profile & Wallet ---
  public getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error reading profile', e);
    }
    this.saveProfile(DEFAULT_PROFILE);
    return DEFAULT_PROFILE;
  }

  public saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Error saving profile', e);
    }
  }

  public updateProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const updated = { ...current, ...updates };
    this.saveProfile(updated);
    return updated;
  }

  // Atomic Coin Transaction Execution
  public executeTransaction(
    type: TransactionType,
    game: GameId | 'system',
    amount: number,
    description: string
  ): { success: boolean; newBalance: number; error?: string } {
    const profile = this.getProfile();
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return { success: false, newBalance: profile.coins, error: 'Transaction amount must be positive' };
    }

    let newBalance = profile.coins;
    let totalWon = profile.totalWon;
    let totalWagered = profile.totalWagered;
    let xpGained = 0;

    if (type === 'bet' || type === 'split_bet' || type === 'insurance') {
      if (profile.coins < roundedAmount) {
        return { success: false, newBalance: profile.coins, error: 'Insufficient virtual coins for this wager' };
      }
      newBalance = profile.coins - roundedAmount;
      totalWagered += roundedAmount;
      xpGained = Math.max(5, Math.floor(roundedAmount / 20));
    } else {
      // win, daily_reward, quest, reload
      newBalance = profile.coins + roundedAmount;
      if (type === 'win') {
        totalWon += roundedAmount;
        xpGained = Math.max(10, Math.floor(roundedAmount / 15));
      }
    }

    // Calculate level progression from XP
    const newXP = profile.xp + xpGained;
    const newLevel = Math.max(1, Math.floor(Math.sqrt(newXP / 40)) + 1);

    const updatedProfile: UserProfile = {
      ...profile,
      coins: newBalance,
      totalWon,
      totalWagered,
      xp: newXP,
      level: newLevel,
    };
    this.saveProfile(updatedProfile);

    // Record in ledger
    const transaction: WalletTransaction = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      type,
      game,
      amount: roundedAmount,
      balanceAfter: newBalance,
      description,
    };
    this.addTransactionToLedger(transaction);

    // Track coin magnate achievement
    if (newBalance >= 25000) {
      this.updateAchievementProgress('coin_magnate', newBalance);
    }

    return { success: true, newBalance };
  }

  // Record round completion stats
  public recordGameRound(game: GameId, won: boolean, winAmount: number = 0) {
    const profile = this.getProfile();
    const gamesPlayed = profile.gamesPlayed + 1;
    const gamesWon = won ? profile.gamesWon + 1 : profile.gamesWon;

    this.saveProfile({
      ...profile,
      gamesPlayed,
      gamesWon,
    });

    // Check achievement progress
    this.updateAchievementProgress('ten_rounds', gamesPlayed);
    if (won) {
      this.updateAchievementProgress('first_win', 1);
    }

    // Check quest progress
    this.advanceQuestProgress(game);
  }

  // --- Transactions Ledger ---
  public getTransactions(): WalletTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading transactions', e);
    }
    return [];
  }

  private addTransactionToLedger(tx: WalletTransaction) {
    try {
      const list = this.getTransactions();
      const updated = [tx, ...list.slice(0, 99)]; // Keep latest 100
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error saving transaction', e);
    }
  }

  // --- Daily Rewards System ---
  public getDailyRewardState(): DailyRewardState {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DAILY_REWARDS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error reading daily rewards', e);
    }
    return DEFAULT_DAILY_REWARD_STATE;
  }

  public canClaimDailyReward(): { canClaim: boolean; nextDay: number; hoursRemaining: number } {
    const state = this.getDailyRewardState();
    const today = this.getTodayString();

    if (!state.lastClaimDateString) {
      return { canClaim: true, nextDay: 1, hoursRemaining: 0 };
    }

    if (state.lastClaimDateString === today) {
      // Already claimed today - calculate hours until midnight
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diffMs = tomorrow.getTime() - now.getTime();
      const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
      return { canClaim: false, nextDay: state.currentDay, hoursRemaining };
    }

    // Check if yesterday or older
    const lastDate = new Date(state.lastClaimDateString);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Streak continues
      const nextDay = state.currentDay >= 7 ? 1 : state.currentDay + 1;
      return { canClaim: true, nextDay, hoursRemaining: 0 };
    } else {
      // Streak broken, reset to Day 1
      return { canClaim: true, nextDay: 1, hoursRemaining: 0 };
    }
  }

  public claimDailyReward(): { success: boolean; coinsAwarded: number; day: number; message: string } {
    const { canClaim, nextDay } = this.canClaimDailyReward();
    if (!canClaim) {
      return { success: false, coinsAwarded: 0, day: nextDay, message: 'Reward already claimed for today' };
    }

    const rewardInfo = DAILY_REWARD_SCHEDULE.find(d => d.day === nextDay) || DAILY_REWARD_SCHEDULE[0];
    const today = this.getTodayString();
    const state = this.getDailyRewardState();

    const updatedState: DailyRewardState = {
      currentDay: nextDay,
      lastClaimDateString: today,
      claimHistory: [{ date: today, day: nextDay, coins: rewardInfo.coins }, ...state.claimHistory.slice(0, 30)],
    };

    localStorage.setItem(STORAGE_KEYS.DAILY_REWARDS, JSON.stringify(updatedState));

    // Award coins atomically
    this.executeTransaction(
      'daily_reward',
      'system',
      rewardInfo.coins,
      `Day ${nextDay} Daily Login Bonus`
    );

    // Track achievement
    if (nextDay >= 3) {
      this.updateAchievementProgress('streak_master', nextDay);
    }

    return {
      success: true,
      coinsAwarded: rewardInfo.coins,
      day: nextDay,
      message: `Claimed Day ${nextDay} Bonus: +${rewardInfo.coins.toLocaleString()} coins!`,
    };
  }

  // --- VIP Emergency Reload ---
  public claimEmergencyReload(): { success: boolean; coins: number; message: string } {
    const profile = this.getProfile();
    if (profile.coins >= 50) {
      return { success: false, coins: 0, message: 'You have sufficient virtual coins.' };
    }

    const RELOAD_AMOUNT = 1000;
    this.executeTransaction('reload', 'system', RELOAD_AMOUNT, 'VIP Complimentary Chip Reload');
    return {
      success: true,
      coins: RELOAD_AMOUNT,
      message: 'VIP Courtesy Reload granted: +1,000 virtual chips!',
    };
  }

  // --- Achievements ---
  public getAchievements(): Achievement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const existingIds = new Set(parsed.map((a: Achievement) => a.id));
          const missing = INITIAL_ACHIEVEMENTS.filter(a => !existingIds.has(a.id));
          if (missing.length > 0) {
            const merged = [...parsed, ...missing];
            localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading achievements', e);
    }
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(INITIAL_ACHIEVEMENTS));
    return INITIAL_ACHIEVEMENTS;
  }

  public updateAchievementProgress(id: string, progressValue: number): Achievement | null {
    const achievements = this.getAchievements();
    const achIndex = achievements.findIndex(a => a.id === id);
    if (achIndex === -1) return null;

    const ach = achievements[achIndex];
    if (ach.completed) return ach;

    const newProgress = Math.min(ach.target, Math.max(ach.progress, progressValue));
    const completed = newProgress >= ach.target;

    achievements[achIndex] = {
      ...ach,
      progress: newProgress,
      completed,
    };

    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));

    if (completed && !ach.completed) {
      // Award reward coins
      this.executeTransaction('quest', 'system', ach.rewardCoins, `Achievement Completed: ${ach.title}`);
    }

    return achievements[achIndex];
  }

  public incrementAchievementProgress(id: string, delta: number = 1): Achievement | null {
    if (delta <= 0) return null;
    const achievements = this.getAchievements();
    const existing = achievements.find(a => a.id === id);
    if (!existing || existing.completed) return existing ?? null;
    return this.updateAchievementProgress(id, existing.progress + delta);
  }

  // --- Daily Quests ---
  public getDailyQuests(): DailyQuest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading quests', e);
    }
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(INITIAL_QUESTS));
    return INITIAL_QUESTS;
  }

  public advanceQuestProgress(gameId: GameId) {
    const quests = this.getDailyQuests();
    let changed = false;

    const updated = quests.map(q => {
      if (q.gameId === gameId && !q.completed) {
        const progress = q.progress + 1;
        const completed = progress >= q.target;
        changed = true;
        return { ...q, progress, completed };
      }
      return q;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(updated));
    }
  }

  public claimQuestReward(questId: string): { success: boolean; coins: number } {
    const quests = this.getDailyQuests();
    const quest = quests.find(q => q.id === questId);
    if (!quest || !quest.completed || quest.claimed) {
      return { success: false, coins: 0 };
    }

    quest.claimed = true;
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(quests));

    this.executeTransaction('quest', quest.gameId, quest.rewardCoins, `Daily Quest: ${quest.title}`);
    return { success: true, coins: quest.rewardCoins };
  }

  // --- Sound Settings ---
  public getSoundSettings(): SoundSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SOUND);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading sound settings', e);
    }
    return { masterVolume: 0.75, sfxEnabled: true, musicEnabled: false };
  }

  public saveSoundSettings(settings: SoundSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SOUND, JSON.stringify(settings));
    } catch (e) {
      console.warn('Error saving sound settings', e);
    }
  }
}

export const storageManager = new StorageManager();
