import { useEffect, useCallback, useRef } from "react";
import { soundManager } from "@/utils/soundManager";

/* ================================================================
   USE SOUND HOOK – Game audio integration
   ================================================================ */

export interface UseSoundReturn {
  playCardPlay: () => Promise<void>;
  playTrickWon: () => Promise<void>;
  playSafe: () => Promise<void>;
  playLoser: () => Promise<void>;
  playTurnChange: () => Promise<void>;
  playGameOver: () => Promise<void>;
  playButtonPress: () => Promise<void>;
  soundEnabled: boolean;
  toggleSound: () => boolean;
}

/**
 * Custom hook that provides sound effect playback functions.
 * Automatically initializes the sound system on mount and
 * cleans up on unmount.
 */
export function useSound(): UseSoundReturn {
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      soundManager.init();
    }

    return () => {
      // Don't unload on unmount in case other components share the manager
    };
  }, []);

  const playCardPlay = useCallback(async () => {
    await soundManager.play("cardPlay");
  }, []);

  const playTrickWon = useCallback(async () => {
    await soundManager.play("trickWon");
  }, []);

  const playSafe = useCallback(async () => {
    await soundManager.play("safe");
  }, []);

  const playLoser = useCallback(async () => {
    await soundManager.play("loser");
  }, []);

  const playTurnChange = useCallback(async () => {
    await soundManager.play("turnChange");
  }, []);

  const playGameOver = useCallback(async () => {
    await soundManager.play("gameOver");
  }, []);

  const playButtonPress = useCallback(async () => {
    await soundManager.play("buttonPress");
  }, []);

  const toggleSound = useCallback(() => {
    return soundManager.toggle();
  }, []);

  return {
    playCardPlay,
    playTrickWon,
    playSafe,
    playLoser,
    playTurnChange,
    playGameOver,
    playButtonPress,
    soundEnabled: soundManager.enabled,
    toggleSound,
  };
}
