import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CardShape } from '../../engine/types';

type CompatibleCard = CardShape | { id: string; suit: string; value: string | number };

type DropInfo = { absX?: number; absY?: number; dx: number; dy: number; velocity: { x: number; y: number } };

type Props = {
  card: CompatibleCard;
  faceUp?: boolean;
  playable?: boolean;
  onPlay?: (card: CompatibleCard | string, info?: DropInfo) => void;
  onDrop?: (card: CompatibleCard, info: DropInfo) => void;
};

export default function PlayingCard({ card, faceUp = true, playable = false, onPlay, onDrop }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const z = useSharedValue(0);

  useEffect(() => {
    // entry spring
    translateY.value = withSpring(0, { damping: 12, stiffness: 180 });
  }, []);

  const tap = Gesture.Tap().onEnd(() => {
    if (playable && onPlay) {
      // runOnJS requires a concrete function reference; check before calling
      runOnJS(onPlay as any)(card);
    }
  });

  const pan = Gesture.Pan()
    .onBegin(() => {
      z.value = 100;
      scale.value = withSpring(1.05);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotation.value = e.translationX / 15;
    })
    .onEnd((e) => {
      // if quick upward throw -> consider as play
      const shouldPlay = e.velocityY < -1200 || (e.velocityY < -800 && Math.abs(e.translationY) > 80);

      const info: DropInfo = { absX: (e as any).absoluteX ?? undefined, absY: (e as any).absoluteY ?? undefined, dx: e.translationX, dy: e.translationY, velocity: { x: e.velocityX, y: e.velocityY } };

      if (shouldPlay && playable && onPlay) {
        runOnJS(onPlay as any)(card, info);
      } else {
        // return to origin
        translateX.value = withSpring(0, { damping: 12, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 12, stiffness: 200 });
        rotation.value = withSpring(0);
        scale.value = withSpring(1);
        z.value = withSpring(0);
        if (onDrop) runOnJS(onDrop as any)(card, info);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    zIndex: z.value,
    shadowOpacity: playable ? 0.45 : 0.12,
    borderColor: playable ? '#FFD700' : '#e0e0e0',
    borderWidth: playable ? 2 : 1,
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, tap)}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {faceUp ? <><Text style={styles.rank}>{renderRank(card.value)}</Text><Text style={[styles.suit, isRedSuit(card.suit) ? styles.redSuit : styles.blackSuit]}>{renderSuit(card.suit)}</Text></> : <><Text style={styles.backMark}>✦</Text><Text style={styles.backLabel}>GET AWAY</Text></>}
      </Animated.View>
    </GestureDetector>
  );
}

function renderRank(value: string | number) {
  if (typeof value === 'string') {
    return value;
  }
  if (value === 1) return 'A';
  if (value === 11) return 'J';
  if (value === 12) return 'Q';
  if (value === 13) return 'K';
  return String(value);
}

function renderSuit(suit: string) {
  switch (suit) {
    case 'Hearts':
    case 'hearts':
      return '♥';
    case 'Diamonds':
    case 'diamonds':
      return '♦';
    case 'Clubs':
    case 'clubs':
      return '♣';
    case 'Spades':
    case 'spades':
    default:
      return '♠';
  }
}

function isRedSuit(suit: string) {
  return suit === 'hearts' || suit === 'diamonds' || suit === 'Hearts' || suit === 'Diamonds';
}

const styles = StyleSheet.create({
  card: {
    width: 76,
    height: 112,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  rank: { fontSize: 20, fontWeight: '700', color: '#062e22' },
  suit: { fontSize: 18, marginTop: 4 },
  redSuit: { color: '#8B0000' },
  blackSuit: { color: '#062e22' },
  backMark: { color: '#FFD700', fontSize: 28, fontWeight: '800' },
  backLabel: { color: '#FEFEE3', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
});
