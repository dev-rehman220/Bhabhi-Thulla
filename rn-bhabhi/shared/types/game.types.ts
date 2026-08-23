export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  value: CardValue;
  numericValue: number;
}

export type PlayerStatus = 'waiting' | 'active' | 'eliminated' | 'winner' | 'disconnected';

export type PlayerRank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'king';

export interface Player {
  id: string;
  socketId: string;
  displayName: string;
  avatarUrl: string;
  hand: Card[];
  handCount: number;
  isHost: boolean;
  isAI: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  status: PlayerStatus;
  seatIndex: number;
  xp: number;
  coins: number;
  rank: PlayerRank;
  pingMs: number;
  reconnectToken?: string;
}

export type RoomStatus = 'lobby' | 'starting' | 'in_progress' | 'finished' | 'abandoned';

export interface RoomSettings {
  maxPlayers: 2 | 3 | 4 | 5 | 6;
  allowGuests: boolean;
  isPrivate: boolean;
  aiPlayerCount: number;
  turnTimeoutSeconds: number;
  allowSpectators: boolean;
}

export interface GameRoom {
  id: string;
  inviteCode: string;
  hostId: string;
  players: Player[];
  spectators: string[];
  status: RoomStatus;
  settings: RoomSettings;
  match?: MatchState;
  createdAt: number;
  lastActivity: number;
}

export type GamePhase =
  | 'dealing'
  | 'awaiting_move'
  | 'validating'
  | 'animating'
  | 'round_end'
  | 'match_end';

export interface PlayerScore {
  playerId: string;
  roundsWon: number;
  cardsCollected: number;
  isEliminated: boolean;
  eliminationRound?: number;
  isThulla: boolean;
}

export interface MoveRecord {
  playerId: string;
  type: 'play_card' | 'pickup_pile' | 'forced_pickup' | 'pass';
  card?: Card;
  timestamp: number;
  isValid: boolean;
}

export interface MatchState {
  matchId: string;
  round: number;
  currentTurnPlayerId: string;
  turnOrder: string[];
  pile: Card[];
  pileOwner?: string;
  pileLeadSuit?: Suit;
  lastPlayedCard?: Card;
  eliminationOrder: string[];
  phase: GamePhase;
  turnStartedAt: number;
  turnTimeoutSeconds: number;
  scores: Record<string, PlayerScore>;
  history: MoveRecord[];
}

export interface JoinRoomPayload {
  roomId: string;
  playerId: string;
  displayName?: string;
  reconnectToken?: string;
  settings?: Partial<RoomSettings>;
}

export interface PlayCardPayload {
  matchId: string;
  playerId: string;
  cardId: string;
  timestamp: number;
}

export interface EmojiPayload {
  playerId: string;
  emoji: string;
  targetPlayerId?: string;
}

export interface ReconnectPayload {
  roomId: string;
  playerId: string;
  reconnectToken: string;
}
