import { CardShape } from './rulesEngine';

export function nextPlayerIndex(current: number, playersCount: number) {
  if (playersCount <= 1) return 0;
  return (current + 1) % playersCount;
}

export function checkGameOver(playersHands: CardShape[][]) {
  const active = playersHands.filter((h) => h.length > 0).length;
  return active <= 1;
}
