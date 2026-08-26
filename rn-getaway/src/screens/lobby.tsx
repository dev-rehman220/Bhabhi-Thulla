import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassButton from '~/components/ui/GlassButton';
import { socketManager } from '~/services/socket';
import { useGameStore } from '~/store/gameStore';

export default function LobbyScreen({ navigation }: any) {
  const userId = useGameStore((s) => s.userId);
  const currentRoom = useGameStore((s) => s.currentRoom);

  async function handleQuickMatch() {
    if (!userId) {
      return;
    }

    const socket = socketManager.connect();
    socket.once('join_success', () => {
      navigation.replace('Table');
    });

    const roomId = `room_${userId.slice(0, 8)}`;
    socketManager.joinRoom(roomId, userId);
  }

  function handleStartMatch() {
    if (currentRoom?.id) {
      socketManager.startMatch(currentRoom.id);
      navigation.replace('Table');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lobby</Text>
      <View style={{ marginVertical: 16 }}>
        <GlassButton title="Quick Match" onPress={handleQuickMatch} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GlassButton title="Create Room" onPress={handleQuickMatch} />
        <GlassButton title="Join Room" onPress={() => {}} />
      </View>
      {currentRoom?.hostId === userId && (
        <View style={{ marginTop: 16 }}>
          <GlassButton title="Start Match" onPress={handleStartMatch} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#053327', padding: 16 },
  title: { color: '#ffd36b', fontSize: 22, fontWeight: '700', marginTop: 28 }
});
