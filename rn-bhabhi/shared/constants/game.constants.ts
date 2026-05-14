export const CARD_VALUES_ORDERED: string[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

export const NUMERIC_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
};

export const SUITS: string[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const TURN_TIMEOUT_DEFAULT = 30;
export const ROOM_IDLE_CLEANUP = 300_000;
export const RECONNECT_GRACE_PERIOD = 60_000;
export const AI_TURN_DELAY_MS = { easy: 2500, medium: 1500, hard: 800 };

export const RANK_THRESHOLDS: Record<string, number> = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 3500,
  diamond: 7500,
  king: 15000,
};

export const XP_REWARDS = {
  win: 100,
  notThulla: 50,
  perRoundSurvived: 10,
  validMove: 2,
};

export const COIN_REWARDS = {
  win: 200,
  dailyLogin: 100,
  firstMatchOfDay: 150,
};

export const EMOJIS = ['😂', '🔥', '😎', '😡', '👏', '💀', '🃏', '👑', '😭', '🤡'];
