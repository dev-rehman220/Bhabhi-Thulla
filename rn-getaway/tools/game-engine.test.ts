import assert from 'node:assert/strict';
import { GameEngine } from '../shared/engine/GameEngine';
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
  const deck = GameEngine.buildDeck();
  assert.equal(deck.length, 52, 'deck should contain 52 cards');
  assert.equal(new Set(deck.map((c) => c.id)).size, 52, 'deck cards should be unique');
}

function testSixPlayerDistribution() {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const deck = GameEngine.buildDeck();
  const hands = GameEngine.dealCards(playerIds, deck);
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

  const valid = GameEngine.validateMove(state, 'p1', 'hearts_J', hand);
  assert.equal(valid.valid, true, 'higher card in lead suit should be valid');

  const invalid = GameEngine.validateMove(state, 'p1', 'clubs_2', hand);
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

  const result = GameEngine.applyMove(state, 'p1', handA[0], hands);
  assert.equal(result.mustPickup, false, 'first play on empty pile should not force pickup');
  assert.equal(result.state.pile.length, 1, 'pile should contain played card');
  assert.equal(result.state.currentTurnPlayerId, 'p2', 'turn should advance to the player on the left');
  assert.equal(hands.p1.length, 1, 'played card should be removed from hand');

  const timeoutState = makeMatch({ pile: [], pileLeadSuit: undefined });
  const timeout = GameEngine.handleTurnTimeout(timeoutState, [handB[0]]);
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
  assert.equal(GameEngine.nextPlayer(state, 'p1'), 'p2', 'three-player turn should move clockwise');
}

function testEliminationAndMatchEnd() {
  const state = makeMatch();
  const hands: Record<string, Card[]> = { p1: [], p2: [makeCard('clubs_2', 'clubs', '2', 2)] };
  const eliminated = GameEngine.checkEliminations(state, hands);
  assert.deepEqual(eliminated, ['p1'], 'empty hand player should be eliminated');

  const end = GameEngine.checkMatchEnd(state);
  assert.equal(end.isOver, true, 'match should end when only one player remains');
  assert.equal(end.thullaPlayerId, 'p2', 'remaining player should be thulla');
}

function testThullaAndTrickResolution() {
  const lead = makeCard('hearts_10', 'hearts', '10', 10);
  const thulla = makeCard('clubs_2', 'clubs', '2', 2);
  const hands: Record<string, Card[]> = { p1: [], p2: [thulla] };
  const state = makeMatch({ pile: [lead], pileLeadSuit: 'hearts', currentTurnPlayerId: 'p2', history: [{ playerId: 'p1', type: 'play_card', card: lead, timestamp: Date.now(), isValid: true }] });
  const thullaResult = GameEngine.applyMove(state, 'p2', thulla, hands);
  assert.equal(thullaResult.mustPickup, true, 'an off-suit play should trigger an immediate Thulla');
  assert.equal(thullaResult.pickedUpBy, 'p1', 'highest led-suit player should pick up the pile');
  assert.equal(thullaResult.state.currentTurnPlayerId, 'p2', 'the Thulla player should lead next');
  assert.equal(hands.p1.length, 2, 'the picked-up trick should return to the highest led player');

  const lowCard = makeCard('hearts_2', 'hearts', '2', 2);
  const normalHands: Record<string, Card[]> = { p1: [lead], p2: [lowCard] };
  const normalState = makeMatch({ pile: [lead], pileLeadSuit: 'hearts', currentTurnPlayerId: 'p2', history: [{ playerId: 'p1', type: 'play_card', card: lead, timestamp: Date.now(), isValid: true }] });
  const normalResult = GameEngine.applyMove(normalState, 'p2', lowCard, normalHands);
  assert.equal(normalResult.mustPickup, false, 'a same-suit card should never trigger a pickup');
  assert.equal(normalResult.state.pile.length, 0, 'a completed clean trick should be discarded');
  assert.equal(normalResult.state.currentTurnPlayerId, 'p1', 'highest led-suit player should lead the next trick');
}

function run() {
  const cases = [testBuildDeck, testSixPlayerDistribution, testValidateMove, testApplyMoveAndTimeout, testTurnMovesLeftForThreePlayers, testEliminationAndMatchEnd, testThullaAndTrickResolution];
  for (const fn of cases) fn();
  console.log(`GameEngine tests passed (${cases.length})`);
}

run();
