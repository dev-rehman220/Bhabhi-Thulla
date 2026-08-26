import { Card, Suit } from './types';

const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const symbols: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const names = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  return suits.flatMap((suit) => names.map((value, index) => ({
    id: `${suit}-${value}`,
    type: index > 8 ? 'face' : 'number',
    value: `${value}${symbols[suit]}`,
    numericValue: index + 2,
    suit,
    rarity: index > 10 ? 'rare' : 'common',
    description: `Match ${value} or ${suit}.`,
  })));
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}