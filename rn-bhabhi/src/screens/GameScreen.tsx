import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import GameCard from '../components/cards/GameCard';
import GlassButton from '../components/ui/GlassButton';
import { canPlayCard } from '../game/gameEngine';
import { finishGame, useLocalGameStore } from '../store/localGameStore';
import { gameColors } from '../theme/gameTheme';
import { getCardMetrics } from '../theme/cardSizing';

export default function GameScreen({ navigation }: any) {
  const { game, draw, pass, play, opponentTurn, settings } = useLocalGameStore();
  const { width, height } = useWindowDimensions();
  const metrics = getCardMetrics(width, height);
  const [selected, setSelected] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const finished = useRef(false);
  useEffect(() => {
    if (paused) return undefined;
    if (game?.phase === 'opponentTurn') {
      const timer = setTimeout(opponentTurn, 850);
      return () => clearTimeout(timer);
    }
    if ((game?.phase === 'gameWon' || game?.phase === 'gameLost') && !finished.current) {
      finished.current = true;
      finishGame(game.phase === 'gameWon', game.score);
      navigation.replace('GameOver', { won: game.phase === 'gameWon', score: game.score });
    }
    return undefined;
  }, [game?.phase, game?.score, navigation, opponentTurn, paused]);
  if (!game) return null;
  const top = game.discard[game.discard.length - 1];
  const busy = paused || game.phase !== 'playerTurn';
  const feedbackEnabled = settings.haptics && Platform.OS !== 'web';
  const choose = (id: string) => {
    const card = game.playerHand.find((item) => item.id === id);
    if (!card || paused) return;
    if (!canPlayCard(card, top)) {
      if (feedbackEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not a match', 'Choose a card with the same suit or rank.');
      return;
    }
    if (feedbackEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(id); play(id); setSelected(null);
  };
  const drawAction = () => { if (feedbackEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); draw(); };
  const passAction = () => { if (feedbackEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); pass(); };
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><GlassButton title="MENU" onPress={() => setPaused(true)} style={styles.menuButton} /><View><Text style={styles.eyebrow}>CLASSIC MODE · TURN {game.turnNumber}</Text><Text style={styles.title}>GET WAY CARDS</Text></View><View style={styles.score}><Text style={styles.scoreValue}>{game.score}</Text><Text style={styles.scoreLabel}>SCORE</Text></View></View>
    <View style={styles.playfield}><View style={styles.opponent}><Text style={styles.caption}>OPPONENT · {game.opponentHand.length} CARDS</Text><View style={styles.backRow}>{game.opponentHand.slice(0, 7).map((card) => <GameCard key={card.id} faceDown disabled size={metrics} />)}</View></View><View style={styles.center}><View style={styles.piles}><View style={styles.pile}><Text style={styles.caption}>DISCARD</Text><GameCard card={top} disabled size={metrics} /></View><View style={styles.pile}><Text style={styles.caption}>DRAW</Text><GameCard faceDown disabled size={metrics} /></View></View><Text style={[styles.turn, busy ? styles.waiting : styles.active]}>{paused ? 'PAUSED' : game.phase === 'opponentTurn' ? 'OPPONENT IS THINKING' : 'YOUR TURN'}</Text><Text style={[styles.action, game.lastAction.includes('does not') && styles.error]}>{game.lastAction}</Text></View><View style={styles.actions}><GlassButton title={game.hasDrawn ? 'PASS TURN' : 'DRAW CARD'} onPress={game.hasDrawn ? passAction : drawAction} disabled={busy} style={styles.draw} /><GlassButton title="QUIT" onPress={() => navigation.goBack()} style={styles.quit} /></View></View>
    <View style={styles.handArea}><View style={styles.handHeader}><Text style={styles.caption}>YOUR HAND · {game.playerHand.length}</Text><Text style={styles.hint}>{busy ? 'WAITING' : game.hasDrawn ? 'PLAY OR PASS' : 'SELECT A MATCH'}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>{game.playerHand.map((card) => <GameCard key={card.id} card={card} selected={selected === card.id} disabled={busy} size={metrics} onPress={() => choose(card.id)} />)}</ScrollView></View>
    <Modal visible={paused} transparent animationType="fade" onRequestClose={() => setPaused(false)}><View style={styles.modalBackdrop}><View style={styles.pausePanel}><Text style={styles.pauseMark}>✦</Text><Text style={styles.pauseTitle}>PAUSED</Text><GlassButton title="RESUME" onPress={() => setPaused(false)} style={styles.draw} /><GlassButton title="RESTART" onPress={() => { setPaused(false); useLocalGameStore.getState().startGame(); }} /><GlassButton title="QUIT TO HOME" onPress={() => { setPaused(false); navigation.popToTop(); }} /></View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: gameColors.felt, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }, menuButton: { paddingVertical: 9, paddingHorizontal: 13, borderColor: gameColors.line }, eyebrow: { color: gameColors.aqua, fontSize: 9, letterSpacing: 1.5, fontWeight: '900', textAlign: 'center' }, title: { color: gameColors.cloud, fontSize: 21, fontWeight: '900', marginTop: 2, textAlign: 'center' }, score: { alignItems: 'flex-end', minWidth: 65 }, scoreValue: { color: gameColors.gold, fontSize: 24, fontWeight: '900' }, scoreLabel: { color: gameColors.muted, fontSize: 9, letterSpacing: 1 }, playfield: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 145 }, opponent: { width: '26%', alignItems: 'center' }, backRow: { flexDirection: 'row', marginTop: 8, justifyContent: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, piles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, pile: { alignItems: 'center', marginHorizontal: 10 }, caption: { color: gameColors.muted, fontSize: 9, letterSpacing: 1, fontWeight: '900' }, turn: { fontSize: 13, letterSpacing: 1.5, fontWeight: '900', marginTop: 10 }, active: { color: gameColors.gold }, waiting: { color: gameColors.aqua }, action: { color: gameColors.cloud, textAlign: 'center', fontSize: 11, minHeight: 28, marginTop: 5, maxWidth: 320 }, error: { color: gameColors.coral }, actions: { width: 126, gap: 8, paddingLeft: 8 }, draw: { backgroundColor: gameColors.gold, borderColor: gameColors.gold }, quit: { paddingHorizontal: 12, borderColor: gameColors.line }, handArea: { borderTopWidth: 1, borderTopColor: gameColors.line, paddingTop: 7 }, handHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, hint: { color: gameColors.gold, fontSize: 9, fontWeight: '900' }, hand: { paddingVertical: 12, paddingHorizontal: 4, alignItems: 'flex-end' }, modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,21,37,0.86)' }, pausePanel: { width: 260, padding: 22, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: gameColors.line, backgroundColor: gameColors.navy }, pauseMark: { color: gameColors.gold, fontSize: 28, textAlign: 'center' }, pauseTitle: { color: gameColors.cloud, fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 5 } });