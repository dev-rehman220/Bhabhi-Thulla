import ioClient from 'socket.io-client';
import Constants from 'expo-constants';
import { ClientGameEngine } from '~/engine/GameEngine';
import { useGameStore } from '~/store/gameStore';

function getLanHost(): string | null {
  const anyConstants = Constants as any;
  const hostUri =
    anyConstants?.expoConfig?.hostUri ??
    anyConstants?.manifest2?.extra?.expoClient?.hostUri ??
    anyConstants?.manifest?.debuggerHost ??
    anyConstants?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;

  const cleaned = hostUri.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const host = cleaned.split(':')[0];
  return host || null;
}

const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ??
  (getLanHost() ? `http://${getLanHost()}:3001` : 'http://localhost:3001');

type SocketType = ReturnType<typeof ioClient>;

class SocketManager {
  private socket: SocketType | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  connect(token?: string): SocketType {
    if (this.socket) return this.socket;

    this.socket = ioClient(SERVER_URL, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.registerListeners();
    return this.socket;
  }

  private registerListeners() {
    const s = this.socket as SocketType;

    s.on('connect', () => {
      useGameStore.getState().setConnectionStatus('connected');
      this.startPing();
    });

    s.on('disconnect', () => {
      useGameStore.getState().setConnectionStatus('disconnected');
      this.stopPing();
    });

    // safe any-typed payload handlers
    s.on('room_updated', (payload: any) => useGameStore.getState().setRoom(payload.room));
    s.on('join_success', (payload: any) => useGameStore.getState().setRoom(payload.room));
    s.on('found_room', (payload: any) => {
      const userId = useGameStore.getState().userId;
      if (userId) this.joinRoom(payload.roomId, userId);
    });

    s.on('match_started', (payload: any) => {
      const userId = useGameStore.getState().userId;
      if (userId) useGameStore.getState().setMatchState(payload.matchState, userId);
    });

    s.on('hand_dealt', (payload: any) => {
      const hand = payload.hand;
      const matchState = payload.matchState;
      const state = useGameStore.getState();
      if (!state.userId) return;
      state.setHand(hand);
      state.setMatchState(matchState, state.userId);
      state.setPlayableCards(ClientGameEngine.getPlayableCards(matchState, hand));
      if (matchState.handCounts) state.setHandCounts(matchState.handCounts);
    });

    s.on('hand_updated', (payload: any) => {
      const state = useGameStore.getState();
      state.setHand(payload.hand);
      state.setHandCounts(payload.handCounts);
      if (state.matchState) state.setPlayableCards(ClientGameEngine.getPlayableCards(state.matchState, payload.hand));
    });

    s.on('card_played', (payload: any) => {
      const state = useGameStore.getState();
      if (!state.userId) return;
      state.setMatchState(payload.matchState, state.userId);
      state.setPlayableCards(ClientGameEngine.getPlayableCards(payload.matchState, state.myHand));
    });

    s.on('emoji_received', (payload: any) => {
      useGameStore.getState().addEmoji(payload.playerId, payload.emoji);
    });

    s.on('reconnect_success', (payload: any) => {
      const state = useGameStore.getState();
      state.setRoom(payload.room);
      state.setHand(payload.hand);
      if (state.userId && payload.matchState) state.setMatchState(payload.matchState, state.userId);
    });

    s.on('match_end', () => {
      // navigation handled elsewhere
    });

    s.on('error', (payload: any) => console.warn('[Socket Error]', payload?.code ?? payload));
  }

  joinRoom(roomId: string, playerId: string) {
    this.socket?.emit('join_room', { roomId, playerId });
  }

  joinByCode(code: string, playerId: string) {
    this.socket?.emit('join_by_code', { code, playerId });
  }

  startMatch(roomId: string) {
    this.socket?.emit('start_match', { roomId });
  }

  playCard(matchId: string, playerId: string, cardId: string) {
    this.socket?.emit('play_card', { matchId, playerId, cardId, timestamp: Date.now() });
  }

  sendEmoji(playerId: string, emoji: string, targetPlayerId?: string) {
    this.socket?.emit('emoji_reaction', { playerId, emoji, targetPlayerId });
  }

  reconnect(roomId: string, playerId: string, reconnectToken: string) {
    this.socket?.emit('player_reconnect', { roomId, playerId, reconnectToken });
  }

  getRawSocket() {
    return this.socket;
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      const start = Date.now();
      this.socket?.emit('ping_check', {}, () => useGameStore.getState().setPing(Date.now() - start));
    }, 5000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect() {
    this.stopPing();
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketManager = new SocketManager();

export const connectSocket = (url?: string) => socketManager.connect();
export const getSocket = () => socketManager.getRawSocket();

export const joinQueue = (cb?: (data: any) => void) => {
  const state = useGameStore.getState();
  if (!state.userId) return;
  const roomId = `room_${state.userId}`;
  socketManager.joinRoom(roomId, state.userId);
  if (cb) {
    const s = socketManager.getRawSocket();
    s?.once('join_success', (payload: any) => cb({ room: payload.room.id, playerId: state.userId, opponentId: null }));
  }
};

export const leaveQueue = () => socketManager.disconnect();
export const onOpponentPlayed = (cb: (data: any) => void) => socketManager.getRawSocket()?.on('card_played', cb);

export const playCard = (roomOrMatch: string, card: { id: string } | string) => {
  const state = useGameStore.getState();
  if (!state.userId || !state.matchState) return;
  const cardId = typeof card === 'string' ? card : card.id;
  socketManager.playCard(state.matchState.matchId, state.userId, cardId);
};
