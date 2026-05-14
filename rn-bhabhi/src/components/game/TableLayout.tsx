import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, LayoutChangeEvent, findNodeHandle } from 'react-native';
import PlayingCard from '~/components/cards/PlayingCard';
import HandCards from '~/components/cards/HandCards';
import CardStack from '~/components/cards/CardStack';
import { useGameStore } from '~/store/gameStore';
import { socketManager } from '~/services/socket';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

type LayoutRect = { x: number; y: number; width: number; height: number } | null;

type FlyEntry = { id: string; card: any; startX: number; startY: number; endX: number; endY: number };

export default function TableLayout({ match }: { match?: any } = {}) {
  const hand = useGameStore((s) => s.myHand);
  const matchState = useGameStore((s) => s.matchState);
  const setHand = useGameStore((s) => s.setHand);
  const [localPile, setLocalPile] = React.useState<any[]>([]);

  const pileRef = useRef<any>(null);
  const [pileLayout, setPileLayout] = useState<LayoutRect>(null);
  const [flies, setFlies] = useState<FlyEntry[]>([]);

  useEffect(() => {
    // no-op: hand is populated by socket events; local demo not seeded by default
  }, []);

  async function measurePileAbsolute(): Promise<LayoutRect> {
    return new Promise((resolve) => {
      const node = pileRef.current && findNodeHandle(pileRef.current);
      if (!node) return resolve(null);
      // @ts-ignore
      pileRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        resolve({ x, y, width, height });
      });
    });
  }

  function animateCardToPile(card: any, startX: number, startY: number, endX: number, endY: number) {
    const id = `${card.id}-${Date.now()}`;
    setFlies((s) => [...s, { id, card, startX, startY, endX, endY }]);
  }

  async function onCardPlay(card: any, info?: any) {
    const absX = info?.absX ?? info?.dx ?? 0;
    const absY = info?.absY ?? info?.dy ?? 0;
    const pileAbs = await measurePileAbsolute();
    const targetX = pileAbs ? pileAbs.x + pileAbs.width / 2 : 0;
    const targetY = pileAbs ? pileAbs.y + pileAbs.height / 2 : 0;

    // remove immediately so original card disappears
    setHand((hand || []).filter((c: any) => c.id !== card.id));
    animateCardToPile(card, absX, absY, targetX, targetY);
  }

  function onPileLayout(e: LayoutChangeEvent) {
    const { x, y, width, height } = e.nativeEvent.layout;
    setPileLayout({ x, y, width, height });
  }

  async function onCardDrop(card: any, info?: any) {
    const absX = info?.absX ?? info?.dx ?? 0;
    const absY = info?.absY ?? info?.dy ?? 0;
    const pileAbs = await measurePileAbsolute();
    if (pileAbs) {
      const inside = absX >= pileAbs.x && absX <= pileAbs.x + pileAbs.width && absY >= pileAbs.y && absY <= pileAbs.y + pileAbs.height;
      if (inside) {
        setHand((hand || []).filter((c: any) => c.id !== card.id));
        animateCardToPile(card, absX, absY, pileAbs.x + pileAbs.width / 2, pileAbs.y + pileAbs.height / 2);
        return;
      }
    }
    // otherwise do nothing; PlayingCard will spring back
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={{ color: '#fff' }}>Opponent</Text>
      </View>
      <View style={styles.centerRow}>
        <View style={styles.pile} ref={pileRef} onLayout={onPileLayout}>
          <CardStack top={(matchState?.pile ?? localPile).length > 0 ? (matchState?.pile ?? localPile)[(matchState?.pile ?? localPile).length - 1] : undefined} count={(matchState?.pile ?? localPile).length} />
        </View>
        <View style={styles.hand}>
          <HandCards cards={hand} onCardPlay={onCardPlay} onCardDrop={onCardDrop} />
        </View>
      </View>
      <View style={styles.bottomRow}>
        <Text style={{ color: '#fff' }}>You</Text>
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {flies.map((f) => (
          <FlyAnimator
            key={f.id}
            entry={f}
            onEnd={() => {
              // update local pile for demo otherwise server will broadcast
              if (matchState) {
                try {
                  socketManager.playCard(matchState.matchId, useGameStore.getState().userId ?? '', (f.card as any).id);
                } catch (e) {
                  // ignore
                }
              } else {
                setLocalPile((prev) => [...prev, f.card]);
              }
              setFlies((s) => s.filter((x) => x.id !== f.id));
            }}
          />
        ))}
      </View>
    </View>
  );
}

function FlyAnimator({ entry, onEnd }: { entry: FlyEntry; onEnd: () => void }) {
  const { card, startX, startY, endX, endY } = entry;
  const x = useSharedValue(startX);
  const y = useSharedValue(startY);
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value - 40,
    top: y.value - 60,
    width: 80,
    height: 120,
    zIndex: 9999
  }));

  React.useEffect(() => {
    x.value = withTiming(endX, { duration: 420 });
    y.value = withTiming(endY, { duration: 420 }, () => {
      runOnJS(onEnd)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={style}>
      <PlayingCard card={card} faceUp playable={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  topRow: { height: 80, alignItems: 'center', justifyContent: 'center' },
  centerRow: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  pile: { width: 120, height: 140, alignItems: 'center', justifyContent: 'center' },
  hand: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bottomRow: { height: 120, alignItems: 'center', justifyContent: 'center' }
});
