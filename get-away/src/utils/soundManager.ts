import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

/* ================================================================
   SOUND MANAGER – Singleton for managing game audio
   ================================================================ */

type SoundId =
  | "cardPlay"
  | "trickWon"
  | "safe"
  | "bhabhi"
  | "turnChange"
  | "gameOver"
  | "buttonPress";

/** Map of sound IDs to their asset paths (placeholders) */
const SOUND_FILES: Record<SoundId, ReturnType<typeof require> | null> = {
  cardPlay: null,
  trickWon: null,
  safe: null,
  bhabhi: null,
  turnChange: null,
  gameOver: null,
  buttonPress: null,
};

class SoundManager {
  private sounds: Map<SoundId, Audio.Sound> = new Map();
  private loaded = false;
  private _enabled = true;
  private _volume = 0.7;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  get volume(): number {
    return this._volume;
  }

  async init(): Promise<void> {
    if (this.loaded) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });

      for (const [id, source] of Object.entries(SOUND_FILES)) {
        if (source != null) {
          try {
            const { sound } = await Audio.Sound.createAsync(source as any, {
              volume: this._volume,
              shouldPlay: false,
              isLooping: false,
            });
            this.sounds.set(id as SoundId, sound);
          } catch {
            console.warn(`[SoundManager] Could not load sound: ${id}`);
          }
        }
      }

      this.loaded = true;
    } catch (err) {
      console.warn("[SoundManager] Failed to initialize audio:", err);
    }
  }

  async play(id: SoundId): Promise<void> {
    if (!this._enabled) return;

    const sound = this.sounds.get(id);
    if (!sound) return;

    try {
      await sound.setPositionAsync(0);
      await sound.setVolumeAsync(this._volume);
      await sound.playAsync();
    } catch {
      console.warn(`[SoundManager] Failed to play sound: ${id}`);
    }
  }

  async stopAll(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        await sound.stopAsync();
      } catch {
        // Ignore stop errors
      }
    }
  }

  async setVolume(value: number): Promise<void> {
    this._volume = Math.max(0, Math.min(1, value));
    for (const sound of this.sounds.values()) {
      try {
        await sound.setVolumeAsync(this._volume);
      } catch {
        // Ignore volume errors
      }
    }
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    if (!this._enabled) {
      this.stopAll();
    }
    return this._enabled;
  }

  async unload(): Promise<void> {
    for (const sound of this.sounds.values()) {
      try {
        await sound.unloadAsync();
      } catch {
        // Ignore unload errors
      }
    }
    this.sounds.clear();
    this.loaded = false;
  }
}

export const soundManager = new SoundManager();
