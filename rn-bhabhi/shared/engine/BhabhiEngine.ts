import { NUMERIC_VALUES } from '../constants/game.constants';
import { Card, MatchState, MoveRecord, Suit } from '../types/game.types';

export class BhabhiEngine {
  static buildDeck(): Card[] {
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          id: `${suit}_${value}`,
          suit,
          value,
          numericValue: NUMERIC_VALUES[value],
        });
      }
    }

    return BhabhiEngine.shuffle(deck);
  }

  static shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  static dealCards(playerIds: string[], deck: Card[]): Record<string, Card[]> {
    const hands: Record<string, Card[]> = {};
    playerIds.forEach((id) => { hands[id] = []; });

    deck.forEach((card, i) => {
      hands[playerIds[i % playerIds.length]].push(card);
    });

    return hands;
  }

  static validateMove(
    state: MatchState,
    playerId: string,
    cardId: string,
    playerHand: Card[],
  ): { valid: boolean; reason?: string } {
    if (state.currentTurnPlayerId !== playerId) {
      return { valid: false, reason: 'NOT_YOUR_TURN' };
    }

    const card = playerHand.find((c) => c.id === cardId);
    if (!card) {
      return { valid: false, reason: 'CARD_NOT_IN_HAND' };
    }

    if (state.pile.length === 0) {
      return { valid: true };
    }

    const leadSuit = state.pileLeadSuit as Suit;
    const hasSuit = playerHand.some((c) => c.suit === leadSuit);

    if (hasSuit && card.suit !== leadSuit) {
      return { valid: false, reason: 'MUST_FOLLOW_SUIT' };
    }

    if (card.suit === leadSuit) {
      const topCard = state.pile[state.pile.length - 1];
      const canBeat = playerHand.some(
        (c) => c.suit === leadSuit && c.numericValue > topCard.numericValue,
      );
      if (canBeat && card.numericValue <= topCard.numericValue) {
        return { valid: false, reason: 'MUST_PLAY_HIGHER_CARD' };
      }
    }

    return { valid: true };
  }

  static applyMove(
    state: MatchState,
    playerId: string,
    card: Card,
    playerHands: Record<string, Card[]>,
  ): { state: MatchState; mustPickup: boolean; pickedUpBy?: string } {
    const newState = JSON.parse(JSON.stringify(state)) as MatchState;
    const hand = playerHands[playerId];

    const idx = hand.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      hand.splice(idx, 1);
    }

    const record: MoveRecord = {
      playerId,
      type: 'play_card',
      card,
      timestamp: Date.now(),
      isValid: true,
    };

    if (newState.pile.length === 0) {
      newState.pile = [card];
      newState.pileLeadSuit = card.suit;
      newState.pileOwner = playerId;
      newState.lastPlayedCard = card;
      newState.phase = 'awaiting_move';
      newState.turnStartedAt = Date.now();
      newState.history.push(record);
      newState.currentTurnPlayerId = BhabhiEngine.nextPlayer(newState, playerId);
      return { state: newState, mustPickup: false };
    }

    const topCard = newState.pile[newState.pile.length - 1];
    const beats = card.suit === newState.pileLeadSuit && card.numericValue > topCard.numericValue;

    if (beats) {
      newState.pile.push(card);
      newState.lastPlayedCard = card;
      newState.phase = 'awaiting_move';
      newState.turnStartedAt = Date.now();
      newState.history.push(record);
      newState.currentTurnPlayerId = BhabhiEngine.nextPlayer(newState, playerId);
      return { state: newState, mustPickup: false };
    }

    const pickedCards = [...newState.pile, card];
    hand.push(...pickedCards);
    newState.pile = [];
    newState.pileLeadSuit = undefined;
    newState.pileOwner = undefined;
    newState.lastPlayedCard = undefined;
    newState.phase = 'awaiting_move';
    newState.turnStartedAt = Date.now();
    record.type = 'pickup_pile';
    newState.scores[playerId].cardsCollected += pickedCards.length;
    newState.history.push(record);
    newState.currentTurnPlayerId = BhabhiEngine.nextPlayer(newState, playerId);
    return { state: newState, mustPickup: true, pickedUpBy: playerId };
  }

  static checkEliminations(state: MatchState, playerHands: Record<string, Card[]>): string[] {
    const newlyEliminated: string[] = [];

    for (const [pid, hand] of Object.entries(playerHands)) {
      if (hand.length === 0 && !state.scores[pid].isEliminated) {
        state.scores[pid].isEliminated = true;
        state.scores[pid].eliminationRound = state.round;
        state.eliminationOrder.push(pid);
        newlyEliminated.push(pid);
      }
    }

    return newlyEliminated;
  }

  static nextPlayer(state: MatchState, currentId: string): string {
    const active = state.turnOrder.filter((id) => !state.scores[id]?.isEliminated);
    const idx = active.indexOf(currentId);
    // Seats are ordered from the player's left to right, so turns travel left.
    return active[(idx - 1 + active.length) % active.length];
  }

  static checkMatchEnd(
    state: MatchState,
  ): { isOver: boolean; thullaPlayerId?: string } {
    const activePlayers = state.turnOrder.filter((id) => !state.scores[id].isEliminated);
    if (activePlayers.length === 1) {
      state.scores[activePlayers[0]].isThulla = true;
      state.phase = 'match_end';
      return { isOver: true, thullaPlayerId: activePlayers[0] };
    }
    return { isOver: false };
  }

  static getPlayableCards(state: MatchState, hand: Card[]): Card[] {
    if (state.pile.length === 0) {
      return hand;
    }

    const leadSuit = state.pileLeadSuit as Suit;
    const suitCards = hand.filter((c) => c.suit === leadSuit);
    if (suitCards.length === 0) {
      return hand;
    }

    const topCard = state.pile[state.pile.length - 1];
    const higherCards = suitCards.filter((c) => c.numericValue > topCard.numericValue);
    return higherCards.length > 0 ? higherCards : suitCards;
  }

  static handleTurnTimeout(
    state: MatchState,
    hand: Card[],
  ): { forceCard?: Card; forcePickup: boolean } {
    if (state.pile.length === 0) {
      const sorted = [...hand].sort((a, b) => a.numericValue - b.numericValue);
      return { forceCard: sorted[0], forcePickup: false };
    }

    const playable = BhabhiEngine.getPlayableCards(state, hand);
    if (playable.length > 0 && playable[0].suit === state.pileLeadSuit) {
      const topCard = state.pile[state.pile.length - 1];
      const canBeat = playable.some((c) => c.numericValue > topCard.numericValue);
      if (canBeat) {
        const card = [...playable].sort((a, b) => a.numericValue - b.numericValue)[0];
        return { forceCard: card, forcePickup: false };
      }
    }

    return { forcePickup: true };
  }
}
