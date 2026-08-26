import { Card, MatchState } from '../../../shared/types/game.types';
import { GameEngine } from './GameEngine';

type Difficulty = 'easy' | 'medium' | 'hard';

export class AIPlayer {
  private difficulty: Difficulty;
  private cardMemory: Map<string, Card[]> = new Map();

  constructor(difficulty: Difficulty) {
    this.difficulty = difficulty;
  }

  chooseCard(state: MatchState, hand: Card[]): { cardId: string } | { pickup: true } {
    const playable = GameEngine.getPlayableCards(state, hand);

    if (state.pile.length > 0) {
      const topCard = state.pile[state.pile.length - 1];
      const canBeat = playable.some(
        (c) => c.suit === state.pileLeadSuit && c.numericValue > topCard.numericValue,
      );
      if (!canBeat) {
        return { pickup: true };
      }
    }

    const chosen = this.selectByDifficulty(state, hand, playable);
    return { cardId: chosen.id };
  }

  private selectByDifficulty(state: MatchState, hand: Card[], playable: Card[]): Card {
    switch (this.difficulty) {
      case 'easy':
        return this.easySelect(playable);
      case 'medium':
        return this.mediumSelect(state, playable);
      case 'hard':
      default:
        return this.hardSelect(state, hand, playable);
    }
  }

  private easySelect(playable: Card[]): Card {
    return playable[Math.floor(Math.random() * playable.length)];
  }

  private mediumSelect(state: MatchState, playable: Card[]): Card {
    if (state.pile.length === 0) {
      return [...playable].sort((a, b) => a.numericValue - b.numericValue)[0];
    }

    const topVal = state.pile[state.pile.length - 1].numericValue;
    const winners = playable.filter((c) => c.numericValue > topVal);
    if (winners.length > 0) {
      return [...winners].sort((a, b) => a.numericValue - b.numericValue)[0];
    }

    return playable[0];
  }

  private hardSelect(state: MatchState, hand: Card[], playable: Card[]): Card {
    if (state.pile.length === 0) {
      const sorted = [...playable].sort((a, b) => a.numericValue - b.numericValue);
      const midIdx = Math.floor(sorted.length / 2);
      return sorted[midIdx];
    }

    const topCard = state.pile[state.pile.length - 1];
    const winnersInSuit = playable.filter(
      (c) => c.suit === state.pileLeadSuit && c.numericValue > topCard.numericValue,
    );

    if (winnersInSuit.length === 0) {
      return playable[0];
    }

    if (state.pile.length >= 4) {
      return [...winnersInSuit].sort((a, b) => a.numericValue - b.numericValue)[0];
    }

    const midCards = winnersInSuit.filter((c) => c.numericValue < 13);
    if (midCards.length > 0) {
      return [...midCards].sort((a, b) => a.numericValue - b.numericValue)[0];
    }

    return winnersInSuit[0];
  }

  observeMove(playerId: string, card: Card) {
    if (!this.cardMemory.has(playerId)) {
      this.cardMemory.set(playerId, []);
    }

    const seen = this.cardMemory.get(playerId)!;
    if (!seen.find((c) => c.id === card.id)) {
      seen.push(card);
    }
  }
}
