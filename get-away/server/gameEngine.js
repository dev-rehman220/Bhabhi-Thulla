// Plain-JS CommonJS port of src/game/gameEngine.ts (server-authoritative engine).

const suits = ["spades", "hearts", "diamonds", "clubs"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const rankValue = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };

const SUIT_LABEL = {
  spades: "Spades",
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
};

function createDeck() {
  const deck = [];
  suits.forEach((suit) =>
    ranks.forEach((rank) => {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }),
  );
  return deck;
}

function shuffle(cards) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function nextActivePlayer(state, playerId) {
  const index = state.activePlayerIds.indexOf(playerId);
  return state.activePlayerIds[(index + 1) % state.activePlayerIds.length];
}

function playableCards(player, trick) {
  if (!trick.length) return player.hand;
  const ledSuit = trick[0].card.suit;
  const ledCards = player.hand.filter((card) => card.suit === ledSuit);
  return ledCards.length ? ledCards : player.hand;
}

function resolveTrick(state) {
  const ledSuit = state.trick[0].card.suit;
  const ledCards = state.trick.filter((play) => play.card.suit === ledSuit);
  const highestLed = ledCards.reduce((highest, play) =>
    rankValue[play.card.rank] > rankValue[highest.card.rank] ? play : highest,
  );
  const thullaPlay = state.trick.find((play) => play.card.suit !== ledSuit);
  const players = state.players.map((player) => ({ ...player, hand: [...player.hand] }));
  let activePlayerIds = [...state.activePlayerIds];
  let message;
  let discardCount = state.discardCount;
  let leadPlayerId = highestLed.playerId;

  if (thullaPlay) {
    const thullaPlayer = players.find((p) => p.id === thullaPlay.playerId);
    const pickupPlayer = players.find((p) => p.id === highestLed.playerId);
    pickupPlayer.hand.push(...state.trick.map((play) => play.card));
    leadPlayerId = thullaPlay.playerId;
    message = `${(thullaPlayer && thullaPlayer.name) || thullaPlay.playerId} hit a Thulla! ${pickupPlayer.name} picked up ${state.trick.length} cards.`;
  } else {
    discardCount += state.trick.length;
    const winner = players.find((p) => p.id === highestLed.playerId);
    message = `${(winner && winner.name) || highestLed.playerId} won the trick with ${highestLed.card.rank} of ${SUIT_LABEL[highestLed.card.suit]}.`;
  }

  players.forEach((player) => {
    if (!player.hand.length && !player.safe) {
      player.safe = true;
      activePlayerIds = activePlayerIds.filter((id) => id !== player.id);
    }
  });

  if (activePlayerIds.length === 1) {
    const loserId = activePlayerIds[0];
    const loser = players.find((p) => p.id === loserId);
    return {
      ...state,
      players,
      activePlayerIds,
      currentPlayerId: loserId,
      trick: [],
      discardCount,
      message: `${(loser && loser.name) || loserId} is the LOSER!`,
      phase: "finished",
      loserId,
    };
  }

  if (!activePlayerIds.includes(leadPlayerId)) leadPlayerId = activePlayerIds[0];
  return { ...state, players, activePlayerIds, currentPlayerId: leadPlayerId, trick: [], discardCount, message };
}

function createNetworkGame(playerCount) {
  const count = Math.min(6, Math.max(2, playerCount));
  const deck = shuffle(createDeck());
  const players = Array.from({ length: count }, (_, index) => ({
    id: `player-${index}`,
    name: `PLAYER ${index + 1}`,
    hand: [],
    safe: false,
    isCpu: false,
  }));
  deck.forEach((card, index) => players[index % count].hand.push(card));
  const aceHolder = players.find((player) => player.hand.some((card) => card.id === "A-spades"));
  return {
    players,
    activePlayerIds: players.map((player) => player.id),
    currentPlayerId: aceHolder.id,
    trick: [],
    discardCount: 0,
    message: `${aceHolder.name} holds A\u2660 and opens the game.`,
    phase: "playing",
  };
}

function setPlayerCpu(state, playerId, isCpu) {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, isCpu } : player,
    ),
  };
}

function playCard(state, playerId, cardId) {
  if (state.phase === "finished") return { state, error: "This round is over." };
  if (state.currentPlayerId !== playerId) return { state, error: "Wait for your turn." };

  const player = state.players.find((item) => item.id === playerId);
  if (!player) return { state, error: "Player not found." };

  const card = player.hand.find((item) => item.id === cardId);
  if (!card) return { state, error: "That card is not in your hand." };

  if (!state.trick.length && state.discardCount === 0 && card.id !== "A-spades") {
    return { state, error: "A\u2660 must open the game." };
  }

  if (!playableCards(player, state.trick).some((item) => item.id === card.id)) {
    return { state, error: "You must follow the led suit." };
  }

  const nextState = {
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

function playCpuTurn(state) {
  if (state.phase !== "playing") return state;

  const player = state.players.find((item) => item.id === state.currentPlayerId);
  if (!player || !player.isCpu) return state;

  const options = playableCards(player, state.trick);

  if (state.trick.length === 0 && state.discardCount === 0) {
    const aceOfSpades = options.find((item) => item.id === "A-spades");
    if (aceOfSpades) return playCard(state, player.id, aceOfSpades.id).state;
  }

  const card = options[Math.floor(Math.random() * options.length)];
  return card ? playCard(state, player.id, card.id).state : state;
}

// Plays a random valid card for the current player (used to auto-advance a
// turn in online matches when a human does not move in time).
function playAutoTurn(state) {
  if (state.phase !== "playing") return state;
  const player = state.players.find((item) => item.id === state.currentPlayerId);
  if (!player) return state;
  const options = playableCards(player, state.trick);

  if (state.trick.length === 0 && state.discardCount === 0) {
    const aceOfSpades = options.find((item) => item.id === "A-spades");
    if (aceOfSpades) return playCard(state, player.id, aceOfSpades.id).state;
  }

  const card = options[Math.floor(Math.random() * options.length)];
  return card ? playCard(state, player.id, card.id).state : state;
}

// Handles a mid-match player leaving: their remaining cards are dealt out
// (shuffled, round-robin) among the players who are still in the round.
function redistributeCardsOnLeave(state, playerId) {
  const leaving = state.players.find((p) => p.id === playerId);
  if (!leaving || state.phase !== "playing") return state;

  const survivors = state.activePlayerIds.filter((id) => id !== playerId);
  if (survivors.length === 0) return state;

  let players = state.players.map((p) =>
    p.id === playerId ? { ...p, hand: [], safe: true } : { ...p, hand: [...p.hand] },
  );

  // Only one player left in the round: they inherit the leaver's cards and win by default.
  if (survivors.length === 1) {
    players = players.map((p) =>
      p.id === survivors[0]
        ? { ...p, hand: [...p.hand, ...leaving.hand], safe: true }
        : p,
    );
    const winner = players.find((p) => p.id === survivors[0]);
    return {
      ...state,
      players,
      activePlayerIds: [],
      currentPlayerId: survivors[0],
      trick: [],
      phase: "finished",
      loserId: playerId,
      message: `${(winner && winner.name) || survivors[0]} wins — the opponent left the match.`,
    };
  }

  const cards = shuffle(leaving.hand);
  const recipients = players.filter((p) => survivors.includes(p.id));
  let index = 0;
  for (const card of cards) {
    recipients[index % recipients.length].hand.push(card);
    index += 1;
  }

  let activePlayerIds = survivors;
  players = players.map((p) => {
    if (p.safe) return p;
    if (!p.hand.length) {
      activePlayerIds = activePlayerIds.filter((id) => id !== p.id);
      return { ...p, safe: true };
    }
    return p;
  });

  if (activePlayerIds.length === 1) {
    const loser = players.find((p) => p.id === activePlayerIds[0]);
    return {
      ...state,
      players,
      activePlayerIds,
      currentPlayerId: activePlayerIds[0],
      trick: [],
      phase: "finished",
      loserId: activePlayerIds[0],
      message: `${(loser && loser.name) || activePlayerIds[0]} is the LOSER!`,
    };
  }

  const currentPlayerId = activePlayerIds.includes(state.currentPlayerId)
    ? state.currentPlayerId
    : activePlayerIds[0];

  return {
    ...state,
    players,
    activePlayerIds,
    currentPlayerId,
    message: `${(leaving && leaving.name) || playerId} left — their cards were dealt to the remaining players.`,
  };
}

module.exports = {
  createNetworkGame,
  playCard,
  playCpuTurn,
  playAutoTurn,
  playableCards,
  setPlayerCpu,
  redistributeCardsOnLeave,
};