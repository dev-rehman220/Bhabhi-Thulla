import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { drawFromDeck, initializeGame, passTurn, playCard, playOpponentTurn } from '../game/gameEngine';
import { GameState, Settings, Statistics } from '../game/types';

const defaultSettings: Settings = { soundEffects: true, music: false, haptics: true, animations: true, volume: 0.7 };
const defaultStatistics: Statistics = { gamesPlayed: 0, wins: 0, losses: 0, highestScore: 0, currentStreak: 0, bestStreak: 0, cardsPlayed: 0, roundsWon: 0 };
type LocalGameStore = { game: GameState | null; settings: Settings; statistics: Statistics; startGame: () => void; draw: () => void; pass: () => void; play: (cardId: string) => void; opponentTurn: () => void; updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void; resetData: () => void };

export const useLocalGameStore = create<LocalGameStore>()(persist((set) => ({
  game: null, settings: defaultSettings, statistics: defaultStatistics,
  startGame: () => set({ game: initializeGame() }),
  draw: () => set((state) => state.game ? { game: drawFromDeck(state.game).state } : state),
  pass: () => set((state) => state.game ? { game: passTurn(state.game) } : state),
  play: (cardId) => set((state) => {
    if (!state.game) return state;
    const nextGame = playCard(state.game, cardId);
    const played = nextGame.discard.length > state.game.discard.length;
    return played ? { game: nextGame, statistics: { ...state.statistics, cardsPlayed: state.statistics.cardsPlayed + 1 } } : { game: nextGame };
  }),
  opponentTurn: () => set((state) => state.game ? { game: playOpponentTurn(state.game) } : state),
  updateSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
  resetData: () => set({ game: null, statistics: defaultStatistics, settings: defaultSettings }),
}), { name: 'get-way-cards-save', storage: createJSONStorage(() => AsyncStorage) }));

export function finishGame(won: boolean, score: number) {
  const { statistics } = useLocalGameStore.getState();
  const streak = won ? statistics.currentStreak + 1 : 0;
  useLocalGameStore.setState({ statistics: { ...statistics, gamesPlayed: statistics.gamesPlayed + 1, wins: statistics.wins + (won ? 1 : 0), losses: statistics.losses + (won ? 0 : 1), highestScore: Math.max(statistics.highestScore, score), currentStreak: streak, bestStreak: Math.max(statistics.bestStreak, streak), roundsWon: statistics.roundsWon + (won ? 1 : 0) } });
}