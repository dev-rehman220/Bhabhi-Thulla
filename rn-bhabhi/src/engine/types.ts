export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';

export type CardShape = {
  id: string;
  suit: Suit;
  value: number; // 1..13
  faceUp?: boolean;
};

export type PlayerShape = {
  id: string;
  name: string;
  seatIndex: number;
  isHuman?: boolean;
};
