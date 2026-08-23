import { createDeck, shuffle } from './deck';
import { Card, GameState } from './types';

export function initializeGame(): GameState {
  const deck = shuffle(createDeck());
  return {
    phase: 'playerTurn', playerHand: deck.splice(0, 7), opponentHand: deck.splice(0, 7),
    discard: [deck.pop() as Card], deck, score: 0, roundScore: 0, hasDrawn: false, turnNumber: 1,
    lastAction: 'Your move: match the top card by suit or rank.', startedAt: Date.now(),
  };
}

export function canPlayCard(card: Card, top: Card): boolean {
  return card.suit === top.suit || card.numericValue === top.numericValue;
}

export function playableCards(hand: Card[], top: Card): Card[] { return hand.filter((card) => canPlayCard(card, top)); }

export function drawFromDeck(state: GameState): { state: GameState; card?: Card } {
  if (state.phase !== 'playerTurn' || state.hasDrawn) return { state };
  const replenished = state.deck.length ? state : reshuffleDiscard(state);
  if (!replenished.deck.length) return { state: { ...state, lastAction: 'There are no cards left to draw.' } };
  const deck = [...replenished.deck];
  const card = deck.pop() as Card;
  return { state: { ...replenished, deck, playerHand: [...replenished.playerHand, card], hasDrawn: true, lastAction: canPlayCard(card, replenished.discard[replenished.discard.length - 1]) ? 'Your new card matches. Play it or pass.' : 'No match? Pass to end your turn.' }, card };
}

export function playCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'playerTurn') return state;
  const top = state.discard[state.discard.length - 1];
  const card = state.playerHand.find((item) => item.id === cardId);
  if (!card || !canPlayCard(card, top)) return { ...state, lastAction: 'That card does not match the discard pile.' };
  const playerHand = state.playerHand.filter((item) => item.id !== cardId);
  return { ...state, playerHand, discard: [...state.discard, card], score: state.score + card.numericValue,
    roundScore: state.roundScore + card.numericValue, lastAction: `${card.value} played. The table is yours.`,
    phase: playerHand.length ? 'opponentTurn' : 'gameWon', hasDrawn: false, turnNumber: state.turnNumber + 1 };
}

export function passTurn(state: GameState): GameState {
  if (state.phase !== 'playerTurn' || !state.hasDrawn) return state;
  return { ...state, phase: 'opponentTurn', hasDrawn: false, lastAction: 'You passed. Opponent is choosing a card.', turnNumber: state.turnNumber + 1 };
}

export function playOpponentTurn(state: GameState): GameState {
  const top = state.discard[state.discard.length - 1];
  const options = playableCards(state.opponentHand, top).sort((a, b) => a.numericValue - b.numericValue);
  if (!options.length) {
    const replenished = state.deck.length ? state : reshuffleDiscard(state);
    const deck = [...replenished.deck];
    const drawn = deck.pop();
    return { ...replenished, deck, opponentHand: drawn ? [...replenished.opponentHand, drawn] : replenished.opponentHand, phase: 'playerTurn', hasDrawn: false, lastAction: drawn ? 'Opponent drew a card. Your move.' : 'Opponent passed. Your move.' };
  }
  const card = options[0];
  const opponentHand = state.opponentHand.filter((item) => item.id !== card.id);
  return { ...state, opponentHand, discard: [...state.discard, card], phase: opponentHand.length ? 'playerTurn' : 'gameLost', hasDrawn: false, lastAction: `Opponent played ${card.value}. Match it or draw.` };
}

export function reshuffleDiscard(state: GameState): GameState {
  if (state.discard.length < 2) return state;
  const top = state.discard[state.discard.length - 1];
  return { ...state, deck: shuffle(state.discard.slice(0, -1)), discard: [top], lastAction: 'The discard pile was reshuffled.' };
}