import AsyncStorage from "@react-native-async-storage/async-storage";

/* ================================================================
   GAME STATS – Persistence for player statistics
   ================================================================ */

const STORAGE_KEY = "@get-way-cards/stats";

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  bhabhiCount: number;
  thullaCount: number;
  safeCount: number;
  longestStreak: number;
  favoriteCard: string;
}

/** Default stats for first-time users */
const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  bhabhiCount: 0,
  thullaCount: 0,
  safeCount: 0,
  longestStreak: 0,
  favoriteCard: "—",
};

/** Load persisted stats from AsyncStorage */
export async function loadStats(): Promise<GameStats> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameStats>;
      return { ...DEFAULT_STATS, ...parsed };
    }
    return { ...DEFAULT_STATS };
  } catch (err) {
    console.warn("[gameStats] Failed to load stats:", err);
    return { ...DEFAULT_STATS };
  }
}

/** Save stats to AsyncStorage */
export async function saveStats(stats: GameStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn("[gameStats] Failed to save stats:", err);
  }
}

/** Update stats with partial data and persist */
export async function updateStats(partial: Partial<GameStats>): Promise<GameStats> {
  try {
    const current = await loadStats();
    const updated: GameStats = { ...current, ...partial };
    await saveStats(updated);
    return updated;
  } catch (err) {
    console.warn("[gameStats] Failed to update stats:", err);
    return { ...DEFAULT_STATS, ...partial };
  }
}

/** Reset all stats to defaults */
export async function resetStats(): Promise<GameStats> {
  await saveStats({ ...DEFAULT_STATS });
  return { ...DEFAULT_STATS };
}
