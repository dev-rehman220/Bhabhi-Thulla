import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../game/types';
import { gameColors } from '../../theme/gameTheme';

const redSuits = new Set(['hearts', 'diamonds']);
type Props = { card?: Card; selected?: boolean; disabled?: boolean; faceDown?: boolean; onPress?: () => void };

export default function GameCard({ card, selected = false, disabled = false, faceDown = false, onPress }: Props) {
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(lift, { toValue: selected ? -18 : 0, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 7 }).start(); }, [lift, selected]);
  const color = card && redSuits.has(card.suit) ? gameColors.coral : gameColors.ink;
  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: lift }] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={faceDown ? 'Opponent card' : `${card?.value ?? 'card'} card`} disabled={disabled || !onPress} onPress={onPress} style={[styles.card, faceDown && styles.back, disabled && styles.disabled, selected && styles.selected]}>
        {faceDown ? <><Text style={styles.backMark}>✦</Text><Text style={styles.backLabel}>GET WAY</Text></> : card ? <><View><Text style={[styles.corner, { color }]}>{card.value}</Text><Text style={[styles.miniSuit, { color }]}>{card.suit[0].toUpperCase()}</Text></View><Text style={[styles.suit, { color }]}>{card.value.slice(-1)}</Text><View style={styles.bottom}><Text style={[styles.corner, { color }]}>{card.value}</Text></View></> : <View style={styles.empty} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ wrap: { width: 68, height: 102, marginHorizontal: 4 }, card: { width: 68, height: 102, borderRadius: 12, backgroundColor: gameColors.cloud, padding: 8, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 5 }, selected: { borderWidth: 3, borderColor: gameColors.gold }, disabled: { opacity: 0.42 }, back: { backgroundColor: gameColors.teal, borderWidth: 2, borderColor: 'rgba(111,224,208,0.4)', alignItems: 'center', justifyContent: 'center' }, backMark: { color: gameColors.gold, fontSize: 28 }, backLabel: { color: gameColors.cloud, fontSize: 7, letterSpacing: 1, fontWeight: '800' }, corner: { fontSize: 15, fontWeight: '900' }, miniSuit: { fontSize: 8, fontWeight: '800' }, suit: { alignSelf: 'center', fontSize: 27 }, bottom: { alignSelf: 'flex-end', transform: [{ rotate: '180deg' }] }, empty: { flex: 1, borderWidth: 1, borderColor: gameColors.line, borderRadius: 8 } });