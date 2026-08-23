import assert from 'node:assert/strict';
import { BhabhiEngine } from '../shared/engine/BhabhiEngine';
import { Card, MatchState } from '../shared/types/game.types';

function makeCard(id: string, suit: Card['suit'], value: Card['value'], numericValue: number): Card {
  return { id, suit, value, numericValue };
}

function makeMatch(overrides: Partial<MatchState> = {}): MatchState {
  return {
    matchId: 'match-1',
    round: 1,
    currentTurnPlayerId: 'p1',
    turnOrder: ['p1', 'p2'],
    pile: [],
    eliminationOrder: [],
    phase: 'awaiting_move',
    turnStartedAt: Date.now(),
    turnTimeoutSeconds: 30,
    scores: {
      p1: { playerId: 'p1', roundsWon: 0, cardsCollected: 0, isEliminated: false, isThulla: false },
      p2: { playerId: 'p2', roundsWon: 0, cardsCollected: 0, isEliminated: false, isThulla: false },
    },
    history: [],
    ...overrides,
  };
}

function testBuildDeck() {
  const deck = BhabhiEngine.buildDeck();
  assert.equal(deck.length, 52, 'deck should contain 52 cards');
  assert.equal(new Set(deck.map((c) => c.id)).size, 52, 'deck cards should be unique');
}

function testSixPlayerDistribution() {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const deck = BhabhiEngine.buildDeck();
  const hands = BhabhiEngine.dealCards(playerIds, deck);
  const dealtCards = playerIds.flatMap((id) => hands[id]);
  assert.equal(dealtCards.length, 52, 'all cards should be distributed');
  assert.equal(new Set(dealtCards.map((card) => card.id)).size, 52, 'distributed cards should remain unique');
  assert.equal(Math.max(...playerIds.map((id) => hands[id].length)) - Math.min(...playerIds.map((id) => hands[id].length)), 1, 'hands should differ by at most one card');
}

function testValidateMove() {
  const hand = [
    makeCard('hearts_10', 'hearts', '10', 10),
    makeCard('hearts_J', 'hearts', 'J', 11),
    makeCard('clubs_2', 'clubs', '2', 2),
  ];
  const state = makeMatch({
    pile: [makeCard('hearts_9', 'hearts', '9', 9)],
    pileLeadSuit: 'hearts',
  });

  const valid = BhabhiEngine.validateMove(state, 'p1', 'hearts_J', hand);
  assert.equal(valid.valid, true, 'higher card in lead suit should be valid');

  const invalid = BhabhiEngine.validateMove(state, 'p1', 'clubs_2', hand);
  assert.equal(invalid.valid, false, 'off-suit card should be rejected when suit is available');
  assert.equal(invalid.reason, 'MUST_FOLLOW_SUIT');
}

function testApplyMoveAndTimeout() {
  const handA = [
    makeCard('hearts_10', 'hearts', '10', 10),
    makeCard('clubs_2', 'clubs', '2', 2),
  ];
  const handB = [makeCard('spades_A', 'spades', 'A', 14)];
  const hands: Record<string, Card[]> = { p1: [...handA], p2: [...handB] };
  const state = makeMatch();

  const result = BhabhiEngine.applyMove(state, 'p1', handA[0], hands);
  assert.equal(result.mustPickup, false, 'first play on empty pile should not force pickup');
  assert.equal(result.state.pile.length, 1, 'pile should contain played card');
  assert.equal(result.state.currentTurnPlayerId, 'p2', 'turn should advance to the player on the left');
  assert.equal(hands.p1.length, 1, 'played card should be removed from hand');

  const timeoutState = makeMatch({ pile: [], pileLeadSuit: undefined });
  const timeout = BhabhiEngine.handleTurnTimeout(timeoutState, [handB[0]]);
  assert.equal(timeout.forcePickup, false, 'empty pile timeout should prefer playing a card');
  assert.equal(timeout.forceCard?.id, 'spades_A', 'timeout should choose available card');
}

function testTurnMovesLeftForThreePlayers() {
  const state = makeMatch({
    turnOrder: ['p1', 'p2', 'p3'],
    currentTurnPlayerId: 'p1',
    scores: {
      p1: { playerId: 'p1', roundsWon: 0, cardsCollected: 0, isEliminated: false, isThulla: false },
      p2: { playerId: 'p2', roundsWon: 0, cardsCollected: 0, isEliminated: false, isThulla: false },
      p3: { playerId: 'p3', roundsWon: 0, cardsCollected: 0, isEliminated: false, isThulla: false },
    },
  });
  assert.equal(BhabhiEngine.nextPlayer(state, 'p1'), 'p3', 'three-player turn should move left');
}

function testEliminationAndMatchEnd() {
  const state = makeMatch();
  const hands: Record<string, Card[]> = { p1: [], p2: [makeCard('clubs_2', 'clubs', '2', 2)] };
  const eliminated = BhabhiEngine.checkEliminations(state, hands);
  assert.deepEqual(eliminated, ['p1'], 'empty hand player should be eliminated');

  const end = BhabhiEngine.checkMatchEnd(state);
  assert.equal(end.isOver, true, 'match should end when only one player remains');
  assert.equal(end.thullaPlayerId, 'p2', 'remaining player should be thulla');
}

function run() {
  const cases = [testBuildDeck, testSixPlayerDistribution, testValidateMove, testApplyMoveAndTimeout, testTurnMovesLeftForThreePlayers, testEliminationAndMatchEnd];
  for (const fn of cases) fn();
  console.log(`BhabhiEngine tests passed (${cases.length})`);
}

run();
