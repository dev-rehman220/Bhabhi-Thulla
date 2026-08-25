import { NUMERIC_VALUES } from '../constants/game.constants';
import { Card, MatchState, MoveRecord, Suit } from '../types/game.types';

export class BhabhiEngine {
  static buildDeck(): Card[] {
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
    const deck: Card[] = [];
    for (const suit of suits) for (const value of values) deck.push({ id: `${suit}_${value}`, suit, value, numericValue: NUMERIC_VALUES[value] });
    return BhabhiEngine.shuffle(deck);
  }

  static shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  static dealCards(playerIds: string[], deck: Card[]): Record<string, Card[]> {
    const hands: Record<string, Card[]> = {};
    playerIds.forEach((id) => { hands[id] = []; });
    deck.forEach((card, index) => hands[playerIds[index % playerIds.length]].push(card));
    return hands;
  }

  static validateMove(state: MatchState, playerId: string, cardId: string, playerHand: Card[]): { valid: boolean; reason?: string } {
    if (state.currentTurnPlayerId !== playerId) return { valid: false, reason: 'NOT_YOUR_TURN' };
    const card = playerHand.find((item) => item.id === cardId);
    if (!card) return { valid: false, reason: 'CARD_NOT_IN_HAND' };
    if (!state.pile.length) return { valid: state.history.length > 0 || card.id === 'spades_A', reason: state.history.length > 0 ? undefined : 'MUST_PLAY_ACE_OF_SPADES' };
    const ledSuit = state.pileLeadSuit as Suit;
    if (playerHand.some((item) => item.suit === ledSuit) && card.suit !== ledSuit) return { valid: false, reason: 'MUST_FOLLOW_SUIT' };
    return { valid: true };
  }

  static applyMove(state: MatchState, playerId: string, card: Card, playerHands: Record<string, Card[]>): { state: MatchState; mustPickup: boolean; pickedUpBy?: string } {
    const nextState = JSON.parse(JSON.stringify(state)) as MatchState;
    const hand = playerHands[playerId];
    hand.splice(hand.findIndex((item) => item.id === card.id), 1);
    const record: MoveRecord = { playerId, type: 'play_card', card, timestamp: Date.now(), isValid: true };

    if (!nextState.pile.length) {
      nextState.pile = [card];
      nextState.pileLeadSuit = card.suit;
      nextState.pileOwner = playerId;
      nextState.lastPlayedCard = card;
      nextState.history.push(record);
      nextState.currentTurnPlayerId = BhabhiEngine.nextPlayer(nextState, playerId);
      return { state: nextState, mustPickup: false };
    }

    const ledSuit = nextState.pileLeadSuit as Suit;
    nextState.pile.push(card);
    nextState.lastPlayedCard = card;

    if (card.suit !== ledSuit) {
      const highestLed = nextState.pile.filter((item) => item.suit === ledSuit).reduce((highest, item) => item.numericValue > highest.numericValue ? item : highest);
      const highestPlayerId = this.playerForCard(nextState.history, highestLed.id) ?? playerId;
      playerHands[highestPlayerId].push(...nextState.pile);
      nextState.scores[highestPlayerId].cardsCollected += nextState.pile.length;
      record.type = 'pickup_pile';
      nextState.history.push(record);
      nextState.pile = [];
      nextState.pileLeadSuit = undefined;
      nextState.pileOwner = undefined;
      nextState.lastPlayedCard = undefined;
      nextState.currentTurnPlayerId = playerId;
      return { state: nextState, mustPickup: true, pickedUpBy: highestPlayerId };
    }

    const activeCount = nextState.turnOrder.filter((id) => !nextState.scores[id]?.isEliminated).length;
    nextState.history.push(record);
    if (nextState.pile.length < activeCount) {
      nextState.currentTurnPlayerId = BhabhiEngine.nextPlayer(nextState, playerId);
      return { state: nextState, mustPickup: false };
    }

    const highestLed = nextState.pile.filter((item) => item.suit === ledSuit).reduce((highest, item) => item.numericValue > highest.numericValue ? item : highest);
    const winnerId = this.playerForCard(nextState.history, highestLed.id) ?? playerId;
    Object.entries(playerHands).forEach(([id, playerHand]) => {
      if (!playerHand.length) {
        nextState.scores[id].isEliminated = true;
        nextState.scores[id].eliminationRound = nextState.round;
      }
    });
    const remaining = nextState.turnOrder.filter((id) => !nextState.scores[id]?.isEliminated);
    nextState.pile = [];
    nextState.pileLeadSuit = undefined;
    nextState.pileOwner = undefined;
    nextState.lastPlayedCard = undefined;
    nextState.currentTurnPlayerId = remaining.includes(winnerId) ? winnerId : remaining.find((id) => nextState.turnOrder.indexOf(id) > nextState.turnOrder.indexOf(winnerId)) ?? remaining[0];
    return { state: nextState, mustPickup: false };
  }

  static checkEliminations(state: MatchState, playerHands: Record<string, Card[]>): string[] {
    const newlyEliminated: string[] = [];
    for (const [playerId, hand] of Object.entries(playerHands)) if (!hand.length && !state.scores[playerId].isEliminated) {
      state.scores[playerId].isEliminated = true;
      state.scores[playerId].eliminationRound = state.round;
      state.eliminationOrder.push(playerId);
      newlyEliminated.push(playerId);
    }
    return newlyEliminated;
  }

  static nextPlayer(state: MatchState, currentId: string): string {
    const active = state.turnOrder.filter((id) => !state.scores[id]?.isEliminated);
    const index = active.indexOf(currentId);
    return active[(index + 1) % active.length];
  }

  static checkMatchEnd(state: MatchState): { isOver: boolean; thullaPlayerId?: string } {
    const activePlayers = state.turnOrder.filter((id) => !state.scores[id].isEliminated);
    if (activePlayers.length === 1) {
      state.scores[activePlayers[0]].isThulla = true;
      state.phase = 'match_end';
      return { isOver: true, thullaPlayerId: activePlayers[0] };
    }
    return { isOver: false };
  }

  static getPlayableCards(state: MatchState, hand: Card[]): Card[] {
    if (!state.pile.length) return hand;
    const ledSuit = state.pileLeadSuit as Suit;
    const suited = hand.filter((card) => card.suit === ledSuit);
    return suited.length ? suited : hand;
  }

  static handleTurnTimeout(state: MatchState, hand: Card[]): { forceCard?: Card; forcePickup: boolean } {
    const playable = BhabhiEngine.getPlayableCards(state, hand);
    if (!state.pile.length && state.history.length === 0) {
      const ace = hand.find((card) => card.id === 'spades_A');
      return ace ? { forceCard: ace, forcePickup: false } : { forcePickup: true };
    }
    return playable.length ? { forceCard: playable[0], forcePickup: false } : { forcePickup: true };
  }

  static forcePickup(state: MatchState, playerId: string, playerHands: Record<string, Card[]>): MatchState {
    const nextState = JSON.parse(JSON.stringify(state)) as MatchState;
    const pickedCards = [...nextState.pile];
    playerHands[playerId].push(...pickedCards);
    nextState.pile = [];
    nextState.pileLeadSuit = undefined;
    nextState.pileOwner = undefined;
    nextState.lastPlayedCard = undefined;
    nextState.scores[playerId].cardsCollected += pickedCards.length;
    nextState.history.push({ playerId, type: 'forced_pickup', timestamp: Date.now(), isValid: true });
    nextState.currentTurnPlayerId = playerId;
    nextState.turnStartedAt = Date.now();
    return nextState;
  }

  private static playerForCard(history: MoveRecord[], cardId: string): string | undefined {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].card?.id === cardId) return history[index].playerId;
    }
    return undefined;
  }
}
