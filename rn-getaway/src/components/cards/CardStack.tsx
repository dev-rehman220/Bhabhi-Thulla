import React from 'react';
import { View, StyleSheet } from 'react-native';
import PlayingCard from './PlayingCard';
import { CardShape } from '~/engine/types';

type Props = { top?: CardShape; count?: number };

export default function CardStack({ top, count = 0 }: Props) {
  return (
    <View style={styles.stack}>
      {top ? <PlayingCard card={top} faceUp={true} playable={false} /> : <View style={styles.back} />}
      {/* small count badge could be added */}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { width: 84, height: 120, alignItems: 'center', justifyContent: 'center' },
  back: { width: 72, height: 106, borderRadius: 8, backgroundColor: '#062e22' }
});
