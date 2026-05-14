import { CardShape } from './rulesEngine';

export function chooseCardEasy(hand: CardShape[]) {
  return hand[Math.floor(Math.random() * hand.length)];
}

export function chooseCardMedium(hand: CardShape[], top?: CardShape) {
  if (!top) return chooseCardEasy(hand);
  const sameSuit = hand.filter((c) => c.suit === top.suit);
  if (sameSuit.length) return sameSuit.reduce((a, b) => (a.value < b.value ? a : b));
  return chooseCardEasy(hand);
}

export function chooseCardHard(hand: CardShape[], top?: CardShape) {
  if (!top) return chooseCardEasy(hand);
  const sameSuit = hand.filter((c) => c.suit === top.suit);
  if (sameSuit.length) return sameSuit.reduce((a, b) => (a.value > b.value ? a : b));
  // fallback: return highest grouped suit
  const grouped = hand.reduce((acc: any, c) => {
    acc[c.suit] = acc[c.suit] || [];
    acc[c.suit].push(c);
    return acc;
  }, {});
  const best = (Object.values(grouped) as any[]).sort((a: any, b: any) => b.length - a.length)[0];
  return best ? (best as any[]).sort((x: any, y: any) => y.value - x.value)[0] : hand[0];
}
