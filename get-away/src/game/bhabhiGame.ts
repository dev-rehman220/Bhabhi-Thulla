export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GameCard = { id: string; rank: Rank; suit: Suit };
export type PlayedCard = { playerId: string; card: GameCard };
export type BhabhiPlayer = { id: string; name: string; hand: GameCard[]; safe: boolean; isCpu?: boolean };
export type BhabhiState = { players: BhabhiPlayer[]; activePlayerIds: string[]; currentPlayerId: string; trick: PlayedCard[]; discardCount: number; message: string; phase: 'playing' | 'finished'; loserId?: string };

const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankValue: Record<Rank, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };

const SUIT_LABEL: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

export function createDeck(): GameCard[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ id: `${rank}-${suit}`, rank, suit })));
}

function shuffle(cards: GameCard[]) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function nextActivePlayer(state: BhabhiState, playerId: string) {
  const index = state.activePlayerIds.indexOf(playerId);
  return state.activePlayerIds[(index + 1) % state.activePlayerIds.length];
}

function playableCards(player: BhabhiPlayer, trick: PlayedCard[]) {
  if (!trick.length) return player.hand;
  const ledSuit = trick[0].card.suit;
  const ledCards = player.hand.filter((card) => card.suit === ledSuit);
  return ledCards.length ? ledCards : player.hand;
}

function resolveTrick(state: BhabhiState): BhabhiState {
  const ledSuit = state.trick[0].card.suit;
  const ledCards = state.trick.filter((play) => play.card.suit === ledSuit);
  const highestLed = ledCards.reduce((highest, play) =>
    rankValue[play.card.rank] > rankValue[highest.card.rank] ? play : highest,
  );
  const thullaPlay = state.trick.find((play) => play.card.suit !== ledSuit);
  const players = state.players.map((player) => ({ ...player, hand: [...player.hand] }));
  let activePlayerIds = [...state.activePlayerIds];
  let message: string;
  let discardCount = state.discardCount;
  let leadPlayerId = highestLed.playerId;

  if (thullaPlay) {
    const thullaPlayer = players.find((p) => p.id === thullaPlay.playerId);
    const pickupPlayer = players.find((p) => p.id === highestLed.playerId)!;
    pickupPlayer.hand.push(...state.trick.map((play) => play.card));
    leadPlayerId = thullaPlay.playerId;
    message = `${thullaPlayer?.name ?? thullaPlay.playerId} hit a Thulla! ${pickupPlayer.name} picked up ${state.trick.length} cards.`;
  } else {
    discardCount += state.trick.length;
    const winnerName = players.find((p) => p.id === highestLed.playerId)?.name ?? highestLed.playerId;
    message = `${winnerName} won the trick with ${highestLed.card.rank} of ${SUIT_LABEL[highestLed.card.suit]}.`;
  }

  players.forEach((player) => {
    if (!player.hand.length && !player.safe) {
      player.safe = true;
      activePlayerIds = activePlayerIds.filter((id) => id !== player.id);
    }
  });

  if (activePlayerIds.length === 1) {
    const loserId = activePlayerIds[0];
    const loserName = players.find((p) => p.id === loserId)?.name ?? loserId;
    return {
      ...state,
      players,
      activePlayerIds,
      currentPlayerId: loserId,
      trick: [],
      discardCount,
      message: `${loserName} is the BHABHI!`,
      phase: 'finished',
      loserId,
    };
  }

  if (!activePlayerIds.includes(leadPlayerId)) leadPlayerId = activePlayerIds[0];
  return { ...state, players, activePlayerIds, currentPlayerId: leadPlayerId, trick: [], discardCount, message };
}

export function createGame(playerCount: number): BhabhiState {
  const count = Math.min(6, Math.max(3, playerCount));
  const deck = shuffle(createDeck());
  const players = Array.from({ length: count }, (_, index) => ({
    id: `player-${index}`,
    name: index === 0 ? 'YOU' : `CPU ${index}`,
    hand: [] as GameCard[],
    safe: false,
    isCpu: index !== 0,
  }));
  deck.forEach((card, index) => players[index % count].hand.push(card));
  const aceHolder = players.find((player) => player.hand.some((card) => card.id === 'A-spades'))!;
  return {
    players,
    activePlayerIds: players.map((player) => player.id),
    currentPlayerId: aceHolder.id,
    trick: [],
    discardCount: 0,
    message: aceHolder.id === 'player-0'
      ? 'You hold A\u2660. Play it to open the game.'
      : `${aceHolder.name} holds A\u2660 and opens the game.`,
    phase: 'playing',
  };
}

export function playCard(state: BhabhiState, playerId: string, cardId: string): { state: BhabhiState; error?: string } {
  if (state.phase === 'finished') return { state, error: 'This round is over.' };
  if (state.currentPlayerId !== playerId) return { state, error: 'Wait for your turn.' };

  const player = state.players.find((item) => item.id === playerId);
  if (!player) return { state, error: 'Player not found.' };

  const card = player.hand.find((item) => item.id === cardId);
  if (!card) return { state, error: 'That card is not in your hand.' };

  if (!state.trick.length && state.discardCount === 0 && card.id !== 'A-spades') {
    return { state, error: 'A\u2660 must open the game.' };
  }

  if (!playableCards(player, state.trick).some((item) => item.id === card.id)) {
    return { state, error: 'You must follow the led suit.' };
  }

  const nextState: BhabhiState = {
    ...state,
    players: state.players.map((item) =>
      item.id === playerId
        ? { ...item, hand: item.hand.filter((held) => held.id !== cardId) }
        : { ...item, hand: [...item.hand] },
    ),
    trick: [...state.trick, { playerId, card }],
    message: `${player.name} played ${card.rank}${card.suit[0].toUpperCase()}.`,
  };

  if (nextState.trick.length === nextState.activePlayerIds.length) {
    return { state: resolveTrick(nextState) };
  }

  nextState.currentPlayerId = nextActivePlayer(nextState, playerId);
  return { state: nextState };
}

export function playCpuTurn(state: BhabhiState): BhabhiState {
  if (state.phase !== 'playing') return state;

  const player = state.players.find((item) => item.id === state.currentPlayerId);
  if (!player?.isCpu) return state;

  const options = playableCards(player, state.trick);

  if (state.trick.length === 0 && state.discardCount === 0) {
    const aceOfSpades = options.find((item) => item.id === 'A-spades');
    if (aceOfSpades) return playCard(state, player.id, aceOfSpades.id).state;
  }

  const card = options[Math.floor(Math.random() * options.length)];
  return card ? playCard(state, player.id, card.id).state : state;
}
