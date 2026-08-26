import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import PlayingCard from './PlayingCard';

type Props = {
  cards: any[];
  onCardPlay?: (card: any, info?: any) => void;
  onCardDrop?: (card: any, info?: any) => void;
};

export default function HandCards({ cards, onCardPlay, onCardDrop }: Props) {
  const rendered = useMemo(
    () =>
      cards.map((c) => (
        <PlayingCard
          key={c.id}
          card={c}
          playable={true}
          onPlay={(card, info) => onCardPlay && onCardPlay(card, info)}
          onDrop={(card, info) => onCardDrop && onCardDrop(card, info)}
        />
      )),
    [cards]
  );

  return <View style={styles.container}>{rendered}</View>;
}

const styles = StyleSheet.create({ container: { flexDirection: 'row', gap: 10, padding: 8 } });
