import { Server, Socket } from 'socket.io';
import { AI_TURN_DELAY_MS, RECONNECT_GRACE_PERIOD } from '../../../shared/constants/game.constants';
import {
  Card,
  EmojiPayload,
  GameRoom,
  JoinRoomPayload,
  MatchState,
  PlayCardPayload,
  Player,
  ReconnectPayload,
} from '../../../shared/types/game.types';
import { BhabhiEngine } from '../game/BhabhiEngine';
import { AIPlayer } from '../game/AIPlayer';
import { rateLimitEvent } from '../middleware/rateLimiter';
import { RoomManager } from '../rooms/RoomManager';

const roomManager = new RoomManager();
const turnTimers: Map<string, NodeJS.Timeout> = new Map();

export function registerGameHandlers(io: Server, socket: Socket) {
  socket.on('ping_check', (_payload: unknown, ack?: () => void) => {
    if (ack) {
      ack();
    }
  });

  socket.on('join_room', async (payload: JoinRoomPayload) => {
    if (!rateLimitEvent(socket.id, 'join_room')) {
      socket.emit('error', { code: 'RATE_LIMITED' });
      return;
    }

    const player: Player = {
      id: payload.playerId,
      socketId: socket.id,
      displayName: payload.displayName?.trim() || socket.data.user?.name || 'Guest',
      avatarUrl: socket.data.user?.photoURL ?? '',
      hand: [],
      handCount: 0,
      isHost: false,
      isAI: false,
      status: 'waiting',
      seatIndex: 0,
      xp: 0,
      coins: 0,
      rank: 'bronze',
      pingMs: 0,
      reconnectToken: payload.reconnectToken,
    };

    let room = roomManager.getRoom(payload.roomId);
    if (!room) {
      room = roomManager.createRoom(player, payload.settings ?? {});
    } else {
      const result = roomManager.joinRoom(payload.roomId, player);
      if (!result.success) {
        socket.emit('error', { code: result.error });
        return;
      }
      room = result.room as GameRoom;
    }

    await socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.playerId = payload.playerId;

    const sanitized = sanitizeRoom(room, payload.playerId);
    io.to(room.id).emit('room_updated', { room: sanitized });
    socket.emit('join_success', { room: sanitized });
  });

  socket.on('join_by_code', ({ code }: { code: string; playerId: string }) => {
    const room = roomManager.getRoomByInviteCode(code);
    if (!room) {
      socket.emit('error', { code: 'INVALID_CODE' });
      return;
    }
    socket.emit('found_room', { roomId: room.id });
  });

  socket.on('start_match', ({ roomId }: { roomId: string }) => {
    if (!rateLimitEvent(socket.id, 'start_match')) {
      socket.emit('error', { code: 'RATE_LIMITED' });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId) {
      socket.emit('error', { code: 'NOT_HOST' });
      return;
    }

    const result = roomManager.startMatch(roomId);
    if (!result.success || !result.match || !result.hands) {
      socket.emit('error', { code: result.error });
      return;
    }

    const { match, hands } = result;

    room.players.forEach((player) => {
      const pSocket = io.sockets.sockets.get(player.socketId);
      if (pSocket) {
        pSocket.emit('hand_dealt', {
          hand: hands[player.id],
          matchState: redactedMatchState(match, player.id, hands),
        });
      }
    });

    io.to(roomId).emit('match_started', {
      matchState: publicMatchState(match),
    });

    scheduleTurnTimeout(io, roomId, match.currentTurnPlayerId, match);
  });

  socket.on('play_card', (payload: PlayCardPayload) => {
    if (!rateLimitEvent(socket.id, 'play_card')) {
      socket.emit('error', { code: 'RATE_LIMITED' });
      return;
    }

    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) {
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room?.match) {
      return;
    }

    const match = room.match;
    const hand = roomManager.getPlayerHand(match.matchId, payload.playerId);
    const validation = BhabhiEngine.validateMove(match, payload.playerId, payload.cardId, hand);

    if (!validation.valid) {
      socket.emit('move_rejected', { reason: validation.reason });
      return;
    }

    clearTurnTimer(roomId);

    const card = hand.find((c) => c.id === payload.cardId) as Card;
    const allHands = roomManager.getAllHands(match.matchId) as Record<string, Card[]>;
    const { state: newState, mustPickup, pickedUpBy } = BhabhiEngine.applyMove(
      match,
      payload.playerId,
      card,
      allHands,
    );

    room.match = newState;
    Object.keys(allHands).forEach((pid) => {
      roomManager.updatePlayerHand(match.matchId, pid, allHands[pid]);
      const player = room.players.find((item) => item.id === pid);
      if (player) player.handCount = allHands[pid].length;
    });

    const eliminated = BhabhiEngine.checkEliminations(newState, allHands);

    io.to(roomId).emit('card_played', {
      playerId: payload.playerId,
      card,
      matchState: publicMatchState(newState),
      mustPickup,
      pickedUpBy,
      eliminated,
    });

    room.players.forEach((player) => {
      const pSocket = io.sockets.sockets.get(player.socketId);
      if (pSocket) {
        pSocket.emit('hand_updated', {
          hand: allHands[player.id],
          handCounts: Object.fromEntries(Object.entries(allHands).map(([pid, h]) => [pid, h.length])),
        });
      }
    });

    const { isOver, thullaPlayerId } = BhabhiEngine.checkMatchEnd(newState);
    if (isOver) {
      io.to(roomId).emit('match_end', {
        thullaPlayerId,
        scores: newState.scores,
        eliminationOrder: newState.eliminationOrder,
      });
      return;
    }

    const nextPlayer = room.players.find((p) => p.id === newState.currentTurnPlayerId);
    if (nextPlayer?.isAI) {
      scheduleAITurn(io, roomId, nextPlayer, room, newState, allHands);
    } else {
      scheduleTurnTimeout(io, roomId, newState.currentTurnPlayerId, newState);
    }
  });

  socket.on('emoji_reaction', (payload: EmojiPayload) => {
    if (!rateLimitEvent(socket.id, 'emoji_reaction')) {
      socket.emit('error', { code: 'RATE_LIMITED' });
      return;
    }

    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) {
      return;
    }
    io.to(roomId).emit('emoji_received', payload);
  });

  socket.on('player_reconnect', async (payload: ReconnectPayload) => {
    const success = roomManager.reconnectPlayer(payload.roomId, payload.playerId, socket.id);
    if (!success) {
      socket.emit('error', { code: 'RECONNECT_FAILED' });
      return;
    }

    await socket.join(payload.roomId);
    socket.data.roomId = payload.roomId;
    socket.data.playerId = payload.playerId;

    const room = roomManager.getRoom(payload.roomId) as GameRoom;
    const hand = room.match
      ? roomManager.getPlayerHand(room.match.matchId, payload.playerId)
      : [];

    socket.emit('reconnect_success', {
      room: sanitizeRoom(room, payload.playerId),
      hand,
      matchState: room.match ? publicMatchState(room.match) : null,
    });

    io.to(payload.roomId).emit('player_reconnected', { playerId: payload.playerId });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;

    if (!roomId || !playerId) {
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.status = 'disconnected';
    }

    io.to(roomId).emit('player_disconnected', { playerId });

    setTimeout(() => {
      const stillRoom = roomManager.getRoom(roomId);
      if (!stillRoom) {
        return;
      }

      const p = stillRoom.players.find((pl) => pl.id === playerId);
      if (p?.status === 'disconnected') {
        const { room: updated, roomDeleted } = roomManager.leaveRoom(roomId, playerId);
        if (!roomDeleted && updated) {
          io.to(roomId).emit('room_updated', { room: sanitizeRoom(updated, '') });
        }
      }
    }, RECONNECT_GRACE_PERIOD);
  });
}

function scheduleTurnTimeout(io: Server, roomId: string, playerId: string, match: MatchState) {
  clearTurnTimer(roomId);

  const timer = setTimeout(() => {
    const room = roomManager.getRoom(roomId);
    if (!room?.match || room.match.currentTurnPlayerId !== playerId) {
      return;
    }

    const hand = roomManager.getPlayerHand(match.matchId, playerId);
    const { forceCard, forcePickup } = BhabhiEngine.handleTurnTimeout(match, hand);

    io.to(roomId).emit('turn_timeout', { playerId, forceCard, forcePickup });

    if (forceCard) {
      const allHands = roomManager.getAllHands(match.matchId) as Record<string, Card[]>;
      const { state: newState } = BhabhiEngine.applyMove(match, playerId, forceCard, allHands);
      room.match = newState;
      io.to(roomId).emit('card_played', {
        playerId,
        card: forceCard,
        matchState: publicMatchState(newState),
        forced: true,
      });
      scheduleTurnTimeout(io, roomId, newState.currentTurnPlayerId, newState);
    }
  }, match.turnTimeoutSeconds * 1000);

  turnTimers.set(roomId, timer);
}

function clearTurnTimer(roomId: string) {
  const timer = turnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(roomId);
  }
}

function scheduleAITurn(
  io: Server,
  roomId: string,
  aiPlayer: Player,
  room: GameRoom,
  match: MatchState,
  allHands: Record<string, Card[]>,
) {
  const delay = AI_TURN_DELAY_MS[aiPlayer.aiDifficulty ?? 'medium'];

  setTimeout(() => {
    const ai = new AIPlayer(aiPlayer.aiDifficulty ?? 'medium');
    const hand = allHands[aiPlayer.id];
    const decision = ai.chooseCard(match, hand);

    if ('pickup' in decision) {
      const pickedCards = [...match.pile];
      hand.push(...pickedCards);
      match.pile = [];
      match.pileLeadSuit = undefined;
      match.scores[aiPlayer.id].cardsCollected += pickedCards.length;
      match.currentTurnPlayerId = BhabhiEngine.nextPlayer(match, aiPlayer.id);
      match.turnStartedAt = Date.now();

      io.to(roomId).emit('card_played', {
        playerId: aiPlayer.id,
        card: null,
        matchState: publicMatchState(match),
        mustPickup: true,
        pickedUpBy: aiPlayer.id,
      });

      scheduleTurnTimeout(io, roomId, match.currentTurnPlayerId, match);
      return;
    }

    const card = hand.find((c) => c.id === decision.cardId) as Card;
    const { state: newState } = BhabhiEngine.applyMove(match, aiPlayer.id, card, allHands);
    room.match = newState;

    io.to(roomId).emit('card_played', {
      playerId: aiPlayer.id,
      card,
      matchState: publicMatchState(newState),
    });

    scheduleTurnTimeout(io, roomId, newState.currentTurnPlayerId, newState);
  }, delay);
}

function sanitizeRoom(room: GameRoom, forPlayerId: string) {
  return {
    ...room,
    players: room.players.map((p) => ({ ...p, hand: p.id === forPlayerId ? p.hand : [] })),
  };
}

function publicMatchState(match: MatchState) {
  return {
    ...match,
    pileTopCard: match.pile[match.pile.length - 1] ?? null,
    pileSize: match.pile.length,
  };
}

function redactedMatchState(match: MatchState, forPlayerId: string, hands: Record<string, Card[]>) {
  return {
    ...publicMatchState(match),
    myHand: hands[forPlayerId],
    handCounts: Object.fromEntries(Object.entries(hands).map(([pid, h]) => [pid, h.length])),
  };
}
