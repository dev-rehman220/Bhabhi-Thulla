export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Card = {
  id: string;
  type: 'number' | 'face';
  value: string;
  numericValue: number;
  suit: Suit;
  rarity: 'common' | 'rare';
  description: string;
};

export type GamePhase = 'idle' | 'starting' | 'playerTurn' | 'opponentTurn' | 'roundComplete' | 'gameWon' | 'gameLost' | 'paused';

export type GameState = {
  phase: GamePhase;
  deck: Card[];
  discard: Card[];
  playerHand: Card[];
  opponentHand: Card[];
  score: number;
  roundScore: number;
  hasDrawn: boolean;
  turnNumber: number;
  lastAction: string;
  startedAt: number;
};

export type Statistics = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  highestScore: number;
  currentStreak: number;
  bestStreak: number;
  cardsPlayed: number;
  roundsWon: number;
};

export type Settings = {
  soundEffects: boolean;
  music: boolean;
  haptics: boolean;
  animations: boolean;
  volume: number;
};