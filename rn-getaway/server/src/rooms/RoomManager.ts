import { v4 as uuid } from 'uuid';
import {
  Card,
  GameRoom,
  MatchState,
  Player,
  RoomSettings,
} from '../../../shared/types/game.types';
import { GameEngine } from '../game/GameEngine';
import { ROOM_IDLE_CLEANUP, TURN_TIMEOUT_DEFAULT } from '../../../shared/constants/game.constants';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerHands: Map<string, Record<string, Card[]>> = new Map();
  private idleTimers: Map<string, NodeJS.Timeout> = new Map();

  createRoom(host: Player, settings: Partial<RoomSettings>): GameRoom {
    const roomId = uuid();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const requestedMaxPlayers = Number(settings.maxPlayers);
    const maxPlayers: RoomSettings['maxPlayers'] = [2, 3, 4, 5, 6].includes(requestedMaxPlayers)
      ? requestedMaxPlayers as RoomSettings['maxPlayers']
      : 4;

    const room: GameRoom = {
      id: roomId,
      inviteCode,
      hostId: host.id,
      players: [{ ...host, isHost: true, seatIndex: 0 }],
      spectators: [],
      status: 'lobby',
      settings: {
        maxPlayers,
        allowGuests: settings.allowGuests ?? true,
        isPrivate: settings.isPrivate ?? false,
        aiPlayerCount: settings.aiPlayerCount ?? 0,
        turnTimeoutSeconds: settings.turnTimeoutSeconds ?? TURN_TIMEOUT_DEFAULT,
        allowSpectators: settings.allowSpectators ?? false,
      },
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.resetIdleTimer(roomId);
    return room;
  }

  joinRoom(roomId: string, player: Player): { success: boolean; room?: GameRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'ROOM_NOT_FOUND' };
    }
    if (room.status !== 'lobby') {
      return { success: false, error: 'GAME_IN_PROGRESS' };
    }
    if (room.players.length >= room.settings.maxPlayers) {
      return { success: false, error: 'ROOM_FULL' };
    }
    if (room.players.find((p) => p.id === player.id)) {
      return { success: false, error: 'ALREADY_IN_ROOM' };
    }

    room.players.push({ ...player, seatIndex: room.players.length, isHost: false });
    room.lastActivity = Date.now();
    this.resetIdleTimer(roomId);
    return { success: true, room };
  }

  leaveRoom(roomId: string, playerId: string): { room?: GameRoom; roomDeleted: boolean } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { roomDeleted: true };
    }

    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
      this.deleteRoom(roomId);
      return { roomDeleted: true };
    }

    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    room.lastActivity = Date.now();
    return { room, roomDeleted: false };
  }

  startMatch(roomId: string): {
    success: boolean;
    match?: MatchState;
    hands?: Record<string, Card[]>;
    error?: string;
  } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'ROOM_NOT_FOUND' };
    }
    if (room.status !== 'lobby') {
      return { success: false, error: 'GAME_IN_PROGRESS' };
    }
    if (room.players.length < 2) {
      return { success: false, error: 'NOT_ENOUGH_PLAYERS' };
    }

    const deck = GameEngine.buildDeck();
    const playerIds = room.players.map((p) => p.id);
    const hands = GameEngine.dealCards(playerIds, deck);
    room.players.forEach((player) => {
      player.hand = [];
      player.handCount = hands[player.id].length;
      player.status = 'active';
    });

    const scores: MatchState['scores'] = {};
    playerIds.forEach((id) => {
      scores[id] = {
        playerId: id,
        roundsWon: 0,
        cardsCollected: 0,
        isEliminated: false,
        isThulla: false,
      };
    });

    const match: MatchState = {
      matchId: uuid(),
      round: 1,
      currentTurnPlayerId: playerIds[0],
      turnOrder: playerIds,
      pile: [],
      eliminationOrder: [],
      phase: 'awaiting_move',
      turnStartedAt: Date.now(),
      turnTimeoutSeconds: room.settings.turnTimeoutSeconds,
      scores,
      history: [],
    };

    room.match = match;
    room.status = 'in_progress';
    this.playerHands.set(match.matchId, hands);

    return { success: true, match, hands };
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByInviteCode(code: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.inviteCode === code.toUpperCase()) {
        return room;
      }
    }
    return undefined;
  }

  getPlayerHand(matchId: string, playerId: string): Card[] {
    return this.playerHands.get(matchId)?.[playerId] ?? [];
  }

  updatePlayerHand(matchId: string, playerId: string, hand: Card[]) {
    const hands = this.playerHands.get(matchId);
    if (hands) {
      hands[playerId] = hand;
    }
  }

  getAllHands(matchId: string): Record<string, Card[]> | undefined {
    return this.playerHands.get(matchId);
  }

  reconnectPlayer(roomId: string, playerId: string, newSocketId: string, reconnectToken?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return false;
    }
    if (player.reconnectToken && player.reconnectToken !== reconnectToken) {
      return false;
    }

    player.socketId = newSocketId;
    player.status = 'active';
    room.lastActivity = Date.now();
    return true;
  }

  private deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
    const timer = this.idleTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
    }
    this.idleTimers.delete(roomId);
  }

  private resetIdleTimer(roomId: string) {
    const existing = this.idleTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && room.status === 'lobby') {
        this.deleteRoom(roomId);
      }
    }, ROOM_IDLE_CLEANUP);

    this.idleTimers.set(roomId, timer);
  }
}
