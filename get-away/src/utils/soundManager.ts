/* ================================================================
   SOUND MANAGER – expo-audio backed UI & game sound effects
   ================================================================ */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

type SoundId =
  | "cardPlay"
  | "trickWon"
  | "safe"
  | "loser"
  | "turnChange"
  | "gameOver"
  | "buttonPress";

const SOUND_SOURCES: Record<SoundId, number> = {
  cardPlay: require("@/assets/sounds/card-play.mp3"),
  trickWon: require("@/assets/sounds/trick-won.mp3"),
  safe: require("@/assets/sounds/safe.mp3"),
  loser: require("@/assets/sounds/loser.mp3"),
  turnChange: require("@/assets/sounds/turn-change.mp3"),
  gameOver: require("@/assets/sounds/game-over.mp3"),
  buttonPress: require("@/assets/sounds/button-press.mp3"),
};

const DEFAULT_VOLUMES: Record<SoundId, number> = {
  cardPlay: 0.9,
  trickWon: 0.8,
  safe: 0.8,
  loser: 0.8,
  turnChange: 0.7,
  gameOver: 0.85,
  buttonPress: 0.75,
};

class SoundManager {
  private _enabled = true;
  private _players: Partial<Record<SoundId, AudioPlayer>> = {};
  private _initialized = false;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    if (!value) {
      this.stopAll();
    }
  }

  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
      });
    } catch {
      // Audio mode is a best-effort configuration
    }

    // Pre-create players so button presses play with minimal latency.
    (Object.keys(SOUND_SOURCES) as SoundId[]).forEach((id) => {
      try {
        const player = createAudioPlayer(SOUND_SOURCES[id]);
        player.volume = DEFAULT_VOLUMES[id];
        player.loop = false;
        this._players[id] = player;
      } catch {
        // Ignore individual failures (e.g. unsupported platform).
      }
    });
  }

  async play(id: SoundId): Promise<void> {
    if (!this._enabled) return;
    if (!this._initialized) {
      await this.init();
    }

    const player = this._players[id];
    if (!player) return;

    try {
      // Restart the sound if it was already playing.
      player.seekTo(0);
      player.play();
    } catch {
      // Playback failed silently.
    }
  }

  async stopAll(): Promise<void> {
    (Object.keys(this._players) as SoundId[]).forEach((id) => {
      const player = this._players[id];
      if (player) {
        try {
          player.pause();
          player.seekTo(0);
        } catch {
          // Ignore stop failures.
        }
      }
    });
  }

  async setVolume(value: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, value));
    (Object.keys(this._players) as SoundId[]).forEach((id) => {
      const player = this._players[id];
      if (player) player.volume = DEFAULT_VOLUMES[id] * clamped;
    });
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    if (!this._enabled) {
      this.stopAll();
    }
    return this._enabled;
  }

  async unload(): Promise<void> {
    (Object.keys(this._players) as SoundId[]).forEach((id) => {
      const player = this._players[id];
      if (player) {
        try {
          player.remove();
        } catch {
          // Ignore cleanup failures.
        }
      }
    });
    this._players = {};
    this._initialized = false;
  }
}

export const soundManager = new SoundManager();
