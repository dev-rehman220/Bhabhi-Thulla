import { useEffect } from 'react';
import { socketManager } from '~/services/socket';
import { useGameStore } from '~/store/gameStore';

export function useGame() {
  const userId = useGameStore((s) => s.userId);

  useEffect(() => {
    if (!userId) {
      return;
    }

    socketManager.connect();
    return () => {
      // Keep socket alive across screens; do not disconnect on every unmount.
    };
  }, [userId]);

  return {
    userId,
  };
}
