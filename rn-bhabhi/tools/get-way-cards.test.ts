import assert from 'node:assert/strict';
import { createDeck } from '../src/game/deck';
import { canPlayCard, drawFromDeck, initializeGame, passTurn, playCard, playOpponentTurn } from '../src/game/gameEngine';

const deck = createDeck();
assert.equal(deck.length, 52);
assert.equal(new Set(deck.map((card) => card.id)).size, 52);
assert.equal(canPlayCard(deck[0], { ...deck[1], suit: deck[0].suit }), true);
assert.equal(canPlayCard(deck[0], { ...deck[1], numericValue: deck[0].numericValue, id: 'other' }), true);

const game = initializeGame();
const top = game.discard[0];
const playable = game.playerHand.find((card) => canPlayCard(card, top));
if (playable) {
  const next = playCard(game, playable.id);
  assert.equal(next.playerHand.length, game.playerHand.length - 1);
  assert.equal(next.discard.length, game.discard.length + 1);
}

const drawn = drawFromDeck(game).state;
assert.equal(drawn.playerHand.length, 8);
assert.equal(drawn.hasDrawn, true);
assert.equal(passTurn(drawn).phase, 'opponentTurn');
const opponent = playOpponentTurn(passTurn(drawn));
assert.equal(opponent.phase === 'playerTurn' || opponent.phase === 'gameLost', true);

console.log('Get Way Cards tests passed');