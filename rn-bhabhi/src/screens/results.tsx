import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassButton from '~/components/ui/GlassButton';
import { ClientGameEngine } from '~/engine/GameEngine';
import { useGameStore } from '~/store/gameStore';

export default function ResultsScreen({ navigation }: any) {
  const matchState = useGameStore((s) => s.matchState);
  const room = useGameStore((s) => s.currentRoom);

  const leaderboard = matchState
    ? ClientGameEngine.getLeaderboard(matchState.scores)
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Match Results</Text>
      {leaderboard.map((score, index) => {
        const player = room?.players.find((p) => p.id === score.playerId);
        return (
          <View key={score.playerId} style={styles.row}>
            <Text style={styles.rowText}>{index + 1}. {player?.displayName ?? score.playerId}</Text>
            <Text style={styles.rowText}>{score.isThulla ? 'THULLA' : `${score.cardsCollected} cards`}</Text>
          </View>
        );
      })}
      <View style={{ marginTop: 16 }}>
        <GlassButton title="Back To Lobby" onPress={() => navigation.replace('Lobby')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061a10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  rowText: {
    color: '#FEFEE3',
    fontSize: 14,
  },
});
