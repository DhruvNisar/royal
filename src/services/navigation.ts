import { GameCategory, GameId } from '../types';

export const RETURNABLE_VIEWS = [
  'lobby',
  'games',
  'wallet',
  'profile',
  'leaderboard',
  'multiplayer',
] as const;

export type ReturnableView = (typeof RETURNABLE_VIEWS)[number];

export interface GameReturnContext {
  view: ReturnableView;
  gamesCategory: GameCategory;
  gamesSearchQuery: string;
  scrollY: number;
}

export interface AppNavigationState {
  currentView: string;
  gamesCategory: GameCategory;
  gamesSearchQuery: string;
  returnContext: GameReturnContext | null;
}

export function isReturnableView(view: string): view is ReturnableView {
  return (RETURNABLE_VIEWS as readonly string[]).includes(view);
}

export function createInitialNavigationState(
  initialView: string = 'lobby'
): AppNavigationState {
  return {
    currentView: initialView,
    gamesCategory: 'all',
    gamesSearchQuery: '',
    returnContext: null,
  };
}

/**
 * Opens a game while saving the originating page and active GamesList filter/search state.
 * Never saves a `game_*` route as a return destination; falls back safely to `'lobby'`.
 */
export function openGameWithReturnContext(
  state: AppNavigationState,
  gameId: GameId,
  scrollY: number = 0,
  explicitOriginView?: string
): AppNavigationState {
  const candidateOrigin = explicitOriginView ?? state.currentView;
  const safeOriginView: ReturnableView = isReturnableView(candidateOrigin)
    ? candidateOrigin
    : 'lobby';

  return {
    ...state,
    currentView: `game_${gameId}`,
    returnContext: {
      view: safeOriginView,
      gamesCategory: state.gamesCategory,
      gamesSearchQuery: state.gamesSearchQuery,
      scrollY: Math.max(0, Math.floor(scrollY)),
    },
  };
}

/**
 * Exits the active game, restoring the originating page (and GamesList category/search)
 * or falling back safely to `'lobby'` when no valid return context exists.
 * Clears `returnContext` immediately to avoid stale reuse on future launches.
 */
export function exitGameWithReturnContext(state: AppNavigationState): {
  nextState: AppNavigationState;
  restoreScrollY: number;
} {
  const ctx = state.returnContext;
  const targetView: ReturnableView =
    ctx && isReturnableView(ctx.view) ? ctx.view : 'lobby';

  return {
    nextState: {
      ...state,
      currentView: targetView,
      gamesCategory: ctx && targetView === 'games' ? ctx.gamesCategory : state.gamesCategory,
      gamesSearchQuery:
        ctx && targetView === 'games' ? ctx.gamesSearchQuery : state.gamesSearchQuery,
      returnContext: null,
    },
    restoreScrollY: ctx ? ctx.scrollY : 0,
  };
}

/**
 * Navigates directly to a top-level page (Header, MobileBottomNav, or Lobby button)
 * and clears any prior game return context.
 */
export function navigateTopLevelView(
  state: AppNavigationState,
  targetView: string
): AppNavigationState {
  return {
    ...state,
    currentView: targetView,
    returnContext: null,
  };
}
