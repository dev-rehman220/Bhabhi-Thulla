import { BhabhiEngine } from '../../shared/engine/BhabhiEngine';
import { Card, MatchState, PlayerScore } from '../../shared/types/game.types';

export class ClientGameEngine {
  static getPlayableCards(state: MatchState, hand: Card[]): string[] {
    return BhabhiEngine.getPlayableCards(state, hand).map((card) => card.id);
  }

  static isMyTurn(state: MatchState, myPlayerId: string): boolean {
    return state.currentTurnPlayerId === myPlayerId && state.phase === 'awaiting_move';
  }

  static getLeaderboard(scores: Record<string, PlayerScore>): PlayerScore[] {
    return Object.values(scores).sort((a, b) => {
      if (a.isThulla) return 1;
      if (b.isThulla) return -1;
      if (a.isEliminated && b.isEliminated) {
        return (b.eliminationRound ?? 0) - (a.eliminationRound ?? 0);
      }
      return a.cardsCollected - b.cardsCollected;
    });
  }

  static getTimeRemainingPercent(state: MatchState): number {
    const elapsed = (Date.now() - state.turnStartedAt) / 1000;
    return Math.max(0, 1 - elapsed / state.turnTimeoutSeconds);
  }
}
