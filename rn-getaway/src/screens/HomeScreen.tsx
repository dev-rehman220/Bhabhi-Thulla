import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassButton from '../components/ui/GlassButton';
import GameCard from '../components/cards/GameCard';
import { useLocalGameStore } from '../store/localGameStore';
import { gameColors } from '../theme/gameTheme';

export default function HomeScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const hasSave = Boolean(useLocalGameStore((state) => state.game));
  const startGame = useLocalGameStore((state) => state.startGame);
  const play = () => { startGame(); navigation.navigate('Game'); };
  return <LinearGradient colors={[gameColors.ink, gameColors.navy, gameColors.felt]} style={styles.root}>
    <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={[styles.safe, landscape && styles.landscapeSafe]} showsVerticalScrollIndicator={false}><View style={[styles.header, landscape && styles.landscapeHeader]}><Text style={styles.kicker}>A QUICK MATCHING GAME</Text><Text style={styles.logo}>GET WAY</Text><Text style={styles.logoAccent}>CARDS</Text><Text style={styles.tagline}>Read the table. Find your way out.</Text>
      <View style={styles.cards}><GameCard faceDown /><GameCard faceDown selected /><GameCard card={{ id: 'hero', type: 'face', value: '7♥', numericValue: 7, suit: 'hearts', rarity: 'common', description: '' }} /></View></View>
      <View style={[styles.menu, landscape && styles.landscapeMenu]}><GlassButton title="PLAY CLASSIC" onPress={play} style={styles.primary} /><GlassButton title="PLAY WITH FRIENDS · LAN" onPress={() => navigation.navigate('LanLobby')} style={styles.lan} /><GlassButton title={hasSave ? 'CONTINUE' : 'HOW TO PLAY'} onPress={() => navigation.navigate(hasSave ? 'Game' : 'HowToPlay')} style={styles.secondary} /><View style={styles.row}><GlassButton title="HOW TO PLAY" onPress={() => navigation.navigate('HowToPlay')} style={styles.small} /><GlassButton title="STATS" onPress={() => navigation.navigate('Statistics')} style={styles.small} /><GlassButton title="SETTINGS" onPress={() => navigation.navigate('Settings')} style={styles.small} /></View></View>
    </ScrollView></SafeAreaView></LinearGradient>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, safeArea: { flex: 1 }, safe: { flexGrow: 1, padding: 24, justifyContent: 'space-between' }, landscapeSafe: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: '8%' }, header: { marginTop: 28 }, landscapeHeader: { width: '44%', marginTop: 0 }, kicker: { color: gameColors.aqua, fontSize: 11, letterSpacing: 2, fontWeight: '800' }, logo: { color: gameColors.cloud, fontSize: 48, fontWeight: '900', letterSpacing: 1, marginTop: 8 }, logoAccent: { color: gameColors.gold, fontSize: 48, fontWeight: '900', letterSpacing: 1, lineHeight: 48 }, tagline: { color: gameColors.muted, fontSize: 15, marginTop: 14 }, cards: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 18 }, menu: { gap: 12 }, landscapeMenu: { width: '42%', maxWidth: 360 }, primary: { backgroundColor: gameColors.gold, borderColor: gameColors.gold, minHeight: 56 }, lan: { backgroundColor: 'rgba(242,124,104,0.13)', borderColor: gameColors.coral, minHeight: 52 }, secondary: { backgroundColor: 'rgba(111,224,208,0.14)', borderColor: gameColors.aqua, minHeight: 52 }, small: { flex: 1, paddingHorizontal: 4, backgroundColor: 'transparent', borderColor: gameColors.line }, row: { flexDirection: 'row', gap: 8 } });