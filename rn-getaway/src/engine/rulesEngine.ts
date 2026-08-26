export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type CardShape = { suit: Suit; value: number; id?: string };

export function isValidMove(played: CardShape, top?: CardShape) {
  if (!played) return false;
  if (!top) return true;
  if (played.suit !== top.suit) return false;
  return played.value > top.value;
}

export function canPlayerPlay(hand: CardShape[], top?: CardShape) {
  if (!hand || hand.length === 0) return false;
  return hand.some((c) => isValidMove(c, top));
}
