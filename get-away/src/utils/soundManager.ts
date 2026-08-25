/* ================================================================
   SOUND MANAGER – Stub (no audio files bundled)
   ================================================================ */

type SoundId =
  | "cardPlay"
  | "trickWon"
  | "safe"
  | "bhabhi"
  | "turnChange"
  | "gameOver"
  | "buttonPress";

class SoundManager {
  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  async init(): Promise<void> {}

  async play(_id: SoundId): Promise<void> {}

  async stopAll(): Promise<void> {}

  async setVolume(_value: number): Promise<void> {}

  toggle(): boolean {
    this._enabled = !this._enabled;
    return this._enabled;
  }

  async unload(): Promise<void> {}
}

export const soundManager = new SoundManager();
