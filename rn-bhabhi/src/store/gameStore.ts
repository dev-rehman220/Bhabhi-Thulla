import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Card, GameRoom, MatchState } from '../../shared/types/game.types';

const storage = new MMKV({ id: 'bhabhi-game' });

const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

type GameState = {
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  coins: number;
  xp: number;
  rank: string;

  currentRoom: GameRoom | null;
  matchState: MatchState | null;
  myHand: Card[];
  handCounts: Record<string, number>;
  playableCardIds: string[];

  isMyTurn: boolean;
  emojiQueue: Array<{ playerId: string; emoji: string; id: string }>;
  connectionStatus: ConnectionStatus;
  pingMs: number;

  setAuth: (userId: string, displayName: string, avatarUrl: string) => void;
  setRoom: (room: GameRoom) => void;
  setMatchState: (state: MatchState, myId: string) => void;
  setHand: (hand: Card[]) => void;
  setHandCounts: (counts: Record<string, number>) => void;
  setPlayableCards: (ids: string[]) => void;
  addEmoji: (playerId: string, emoji: string) => void;
  removeEmoji: (id: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setPing: (ms: number) => void;
  updateCoins: (delta: number) => void;
  updateXP: (delta: number) => void;
  reset: () => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      userId: null,
      displayName: null,
      avatarUrl: null,
      coins: 1000,
      xp: 0,
      rank: 'bronze',

      currentRoom: null,
      matchState: null,
      myHand: [],
      handCounts: {},
      playableCardIds: [],

      isMyTurn: false,
      emojiQueue: [],
      connectionStatus: 'disconnected',
      pingMs: 0,

      setAuth: (userId, displayName, avatarUrl) => set({ userId, displayName, avatarUrl }),
      setRoom: (room) => set({ currentRoom: room }),
      setMatchState: (matchState, myId) => {
        set({
          matchState,
          isMyTurn: matchState.currentTurnPlayerId === myId
            && matchState.phase === 'awaiting_move',
        });
      },
      setHand: (myHand) => set({ myHand }),
      setHandCounts: (handCounts) => set({ handCounts }),
      setPlayableCards: (playableCardIds) => set({ playableCardIds }),
      addEmoji: (playerId, emoji) => {
        const id = `${Date.now()}-${Math.random()}`;
        set((state) => ({ emojiQueue: [...state.emojiQueue, { playerId, emoji, id }] }));
        setTimeout(() => {
          get().removeEmoji(id);
        }, 3000);
      },
      removeEmoji: (id) => set((state) => ({
        emojiQueue: state.emojiQueue.filter((item) => item.id !== id),
      })),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setPing: (pingMs) => set({ pingMs }),
      updateCoins: (delta) => set((state) => ({ coins: state.coins + delta })),
      updateXP: (delta) => set((state) => ({ xp: state.xp + delta })),
      reset: () => set({
        currentRoom: null,
        matchState: null,
        myHand: [],
        handCounts: {},
        playableCardIds: [],
        isMyTurn: false,
        emojiQueue: [],
      }),
    }),
    {
      name: 'bhabhi-game-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        userId: state.userId,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        coins: state.coins,
        xp: state.xp,
        rank: state.rank,
      }),
    },
  ),
);
