import React, { useCallback, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import PlayingCard from '../components/cards/PlayingCard';
import { socketManager } from '../services/socket';
import { useGameStore } from '../store/gameStore';
import { EMOJIS } from '../../shared/constants/game.constants';

const { width: W, height: H } = Dimensions.get('window');

export default function TableScreen() {
  const {
    currentRoom,
    matchState,
    myHand,
    handCounts,
    playableCardIds,
    isMyTurn,
    emojiQueue,
    userId,
    pingMs,
    connectionStatus,
  } = useGameStore();

  const players = currentRoom?.players ?? [];
  const orderedPlayers = useMemo(() => {
    if (!matchState?.turnOrder.length) return players;
    const turnIndex = matchState.turnOrder.indexOf(matchState.currentTurnPlayerId);
    return matchState.turnOrder
      .slice(turnIndex + 1)
      .concat(matchState.turnOrder.slice(0, turnIndex + 1))
      .map((id) => players.find((player) => player.id === id))
      .filter(Boolean) as typeof players;
  }, [matchState?.currentTurnPlayerId, matchState?.turnOrder, players]);

  const handlePlayCard = useCallback((cardId: string) => {
    if (!isMyTurn || !matchState || !userId) {
      return;
    }
    socketManager.playCard(matchState.matchId, userId, cardId);
  }, [isMyTurn, matchState, userId]);

  const handleEmoji = useCallback((emoji: string) => {
    if (!userId) {
      return;
    }
    socketManager.sendEmoji(userId, emoji);
  }, [userId]);

  const seatPos = useCallback((seatIndex: number, total: number) => {
    const angle = (seatIndex / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
    const rx = W * 0.38;
    const ry = H * 0.28;
    return {
      x: W / 2 + rx * Math.cos(angle),
      y: H / 2 + ry * Math.sin(angle),
    };
  }, []);

  const pileCards = useMemo(() => matchState?.pile.slice(-3) ?? [], [matchState?.pile]);

  return (
    <View style={styles.table}>
      <View style={styles.felt} />

      {connectionStatus !== 'connected' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.reconnectBanner}>
          <Text style={styles.reconnectText}>
            {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
          </Text>
        </Animated.View>
      )}

      <View style={styles.pingBadge}>
        <Text style={styles.pingText}>{pingMs}ms</Text>
      </View>

      <View style={styles.pileArea}>
        {pileCards.map((card, i) => (
          <View
            key={`${card.id}-${i}`}
            style={[styles.pileCard, { transform: [{ rotate: `${(i - 1) * 8}deg` }], zIndex: i }]}
          >
            <PlayingCard card={card as any} playable={false} faceUp />
          </View>
        ))}
        {pileCards.length === 0 && (
          <View style={styles.emptyPile}>
            <Text style={styles.emptyPileText}>Empty Pile</Text>
          </View>
        )}
      </View>

      <View style={styles.turnDirection}><Text style={styles.turnDirectionText}>TURN MOVES LEFT</Text></View>

      {orderedPlayers.filter((p) => p.id !== userId).map((player, idx) => {
        const pos = seatPos(idx + 1, Math.max(orderedPlayers.length, 2));
        const count = handCounts[player.id] ?? player.handCount ?? 0;
        const isTheirTurn = matchState?.currentTurnPlayerId === player.id;

        return (
          <View
            key={player.id}
            style={[styles.opponentSeat, { left: pos.x - 40, top: pos.y - 50 }]}
          >
            <View style={[styles.avatarRing, isTheirTurn && styles.activeTurn]}>
              <Text style={styles.avatarEmoji}>P</Text>
            </View>
            <Text style={styles.playerName} numberOfLines={1}>{player.displayName}</Text>
            <View style={styles.opponentBacks}>
              {Array.from({ length: Math.min(count, 5) }).map((_, cardIndex) => (
                <View key={`${player.id}-back-${cardIndex}`} style={[styles.opponentBack, { marginLeft: cardIndex ? -18 : 0, zIndex: cardIndex }]}>
                  <PlayingCard card={{ id: `${player.id}-hidden-${cardIndex}`, suit: 'Spades', value: 1 } as any} playable={false} faceUp={false} />
                </View>
              ))}
            </View>
            <View style={styles.handCountBadge}>
              <Text style={styles.handCountText}>{count} cards</Text>
            </View>
          </View>
        );
      })}

      {emojiQueue.map(({ id, emoji }) => (
        <Animated.View key={id} entering={FadeIn} exiting={FadeOut} style={styles.emojiFloat}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </Animated.View>
      ))}

      <View style={styles.myHand}>
        {myHand.map((card, i) => (
          <View
            key={card.id}
            style={{
              marginLeft: i === 0 ? 0 : -20,
              zIndex: i,
              transform: [{ rotate: `${(i - myHand.length / 2) * 3}deg` }],
            }}
          >
            <PlayingCard
              card={card as any}
              playable={isMyTurn && playableCardIds.includes(card.id)}
              onPlay={(played) => handlePlayCard((played as any).id ?? played)}
            />
          </View>
        ))}
      </View>

      {isMyTurn && (
        <View style={styles.emojiBar}>
          {EMOJIS.slice(0, 6).map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => handleEmoji(emoji)}>
              <Text style={styles.emojiBtn}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isMyTurn && (
        <Animated.View entering={FadeIn} style={styles.myTurnIndicator}>
          <Text style={styles.myTurnText}>YOUR TURN</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1, backgroundColor: '#061a10' },
  felt: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d3b22',
    opacity: 0.95,
  },
  pileArea: {
    position: 'absolute',
    top: H / 2 - 60,
    left: W / 2 - 40,
    width: 80,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pileCard: { position: 'absolute' },
  emptyPile: {
    width: 70,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPileText: { color: 'rgba(255,215,0,0.5)', fontSize: 10 },
  myHand: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  opponentSeat: {
    position: 'absolute',
    alignItems: 'center',
    width: 80,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  activeTurn: { borderColor: '#FFD700', borderWidth: 3 },
  avatarEmoji: { fontSize: 20, color: '#FEFEE3', fontWeight: '700' },
  playerName: {
    color: '#FEFEE3',
    fontSize: 10,
    marginTop: 4,
    maxWidth: 70,
    textAlign: 'center',
  },
  handCountBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  handCountText: { color: '#FFD700', fontSize: 10 },
  myTurnIndicator: {
    position: 'absolute',
    bottom: 210,
    alignSelf: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  myTurnText: { fontWeight: '900', color: '#0a2e1a', fontSize: 14, letterSpacing: 2 },
  emojiBar: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  emojiBtn: { fontSize: 24 },
  emojiFloat: {
    position: 'absolute',
    top: H * 0.3,
    alignSelf: 'center',
  },
  emojiText: { fontSize: 48 },
  reconnectBanner: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#8B0000',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    zIndex: 100,
  },
  reconnectText: { color: '#fff', fontWeight: '700' },
  pingBadge: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pingText: { color: '#4ade80', fontSize: 10 },
  turnDirection: { position: 'absolute', top: 78, left: 0, right: 0, alignItems: 'center' },
  turnDirectionText: { color: 'rgba(254,254,227,0.58)', fontSize: 9, letterSpacing: 2, fontWeight: '800' },
  opponentBacks: { height: 34, flexDirection: 'row', alignItems: 'flex-start', marginTop: 5 },
  opponentBack: { transform: [{ scale: 0.42 }], width: 32, height: 48 },
});
