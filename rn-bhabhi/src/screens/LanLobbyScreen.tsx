import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import GlassButton from '../components/ui/GlassButton';
import { socketManager } from '../services/socket';
import { useGameStore } from '../store/gameStore';
import { gameColors } from '../theme/gameTheme';

const makePlayerId = () => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function LanLobbyScreen({ navigation }: any) {
  const [name, setName] = useState('Player');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4 | 5 | 6>(4);
  const [connecting, setConnecting] = useState(false);
  const { userId, currentRoom, setAuth, setRoom, reset } = useGameStore();
  const playerId = useMemo(() => userId ?? makePlayerId(), [userId]);

  useEffect(() => {
    setAuth(playerId, name.trim() || 'Player', '');
    const socket = socketManager.connect();
    const onJoin = (payload: any) => { setRoom(payload.room); setConnecting(false); };
    const onRoom = (payload: any) => setRoom(payload.room);
    const onError = (payload: any) => { setConnecting(false); Alert.alert('Could not join room', String(payload?.code ?? 'Please check the room code.')); };
    socket.on('join_success', onJoin);
    socket.on('room_updated', onRoom);
    socket.on('error', onError);
    return () => { socket.off('join_success', onJoin); socket.off('room_updated', onRoom); socket.off('error', onError); };
  }, [playerId, setAuth, setRoom]);

  const joinRoom = (roomId: string) => {
    setConnecting(true);
    socketManager.joinRoom(roomId, playerId, undefined, name.trim() || 'Player');
  };

  const createRoom = () => {
    if (!name.trim()) { Alert.alert('Choose a name', 'Enter a name for the table.'); return; }
    setAuth(playerId, name.trim(), '');
    setConnecting(true);
    socketManager.joinRoom(`lan_${playerId}`, playerId, { maxPlayers }, name.trim());
  };

  const joinByCode = () => {
    if (roomCode.trim().length < 4) { Alert.alert('Room code needed', 'Enter the six-letter code shown by the host.'); return; }
    setConnecting(true);
    socketManager.joinByCode(roomCode.trim().toUpperCase(), playerId);
  };

  useEffect(() => {
    const socket = socketManager.getRawSocket();
    if (!socket) return;
    const onFound = (payload: any) => joinRoom(payload.roomId);
    socket.on('found_room', onFound);
    return () => { socket.off('found_room', onFound); };
  }, [playerId]);

  const startMatch = () => {
    if (!currentRoom || currentRoom.players.length < 2) { Alert.alert('Need more players', 'At least two players are required to start.'); return; }
    socketManager.startMatch(currentRoom.id);
    navigation.replace('MultiplayerTable');
  };

  if (currentRoom) return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.eyebrow}>LOCAL NETWORK TABLE</Text><Text style={styles.title}>Room ready</Text><View style={styles.codePanel}><Text style={styles.codeLabel}>SHARE THIS CODE</Text><Text style={styles.code}>{currentRoom.inviteCode}</Text><Text style={styles.muted}>Everyone must be on the same Wi-Fi network.</Text></View><Text style={styles.playersTitle}>{currentRoom.players.length} / {currentRoom.settings.maxPlayers} PLAYERS</Text>{currentRoom.players.map((player, index) => <View style={styles.player} key={player.id}><Text style={styles.playerIndex}>0{index + 1}</Text><Text style={styles.playerName}>{player.displayName}</Text>{player.isHost && <Text style={styles.host}>HOST</Text>}</View>)}{currentRoom.hostId === playerId ? <GlassButton title="START THULLA" onPress={startMatch} style={styles.primary} /> : <View style={styles.waiting}><ActivityIndicator color={gameColors.aqua} /><Text style={styles.muted}>Waiting for the host to start...</Text></View>}<GlassButton title="LEAVE TABLE" onPress={() => { reset(); navigation.goBack(); }} /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.eyebrow}>2–6 PLAYERS · LOCAL WI-FI</Text><Text style={styles.title}>Join the table.</Text><Text style={styles.muted}>One player starts the room. Everyone else joins with the code.</Text><Text style={styles.label}>YOUR NAME</Text><TextInput value={name} onChangeText={setName} maxLength={18} placeholder="Player" placeholderTextColor={gameColors.muted} style={styles.input} accessibilityLabel="Your player name" /><Text style={styles.label}>TABLE SIZE</Text><View style={styles.sizes}>{([2, 3, 4, 5, 6] as const).map((size) => <GlassButton key={size} title={String(size)} onPress={() => setMaxPlayers(size)} style={[styles.size, size === maxPlayers && styles.selected]} />)}</View><GlassButton title={connecting ? 'CONNECTING...' : 'CREATE TABLE'} onPress={createRoom} disabled={connecting} style={styles.primary} /><View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR JOIN WITH CODE</Text><View style={styles.line} /></View><TextInput value={roomCode} onChangeText={setRoomCode} autoCapitalize="characters" maxLength={6} placeholder="ABC123" placeholderTextColor={gameColors.muted} style={[styles.input, styles.codeInput]} accessibilityLabel="Room code" /><GlassButton title="JOIN TABLE" onPress={joinByCode} disabled={connecting} /><GlassButton title="BACK" onPress={() => navigation.goBack()} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: gameColors.ink }, content: { flex: 1, padding: 24, paddingTop: 34, gap: 14 }, eyebrow: { color: gameColors.aqua, fontSize: 11, letterSpacing: 2, fontWeight: '900' }, title: { color: gameColors.cloud, fontSize: 36, fontWeight: '900', marginTop: 2 }, muted: { color: gameColors.muted, lineHeight: 20 }, label: { color: gameColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 10 }, input: { color: gameColors.cloud, backgroundColor: gameColors.navy, borderRadius: 10, borderWidth: 1, borderColor: gameColors.line, paddingHorizontal: 16, height: 50, fontSize: 16 }, sizes: { flexDirection: 'row', gap: 8 }, size: { flex: 1, paddingHorizontal: 0 }, selected: { backgroundColor: gameColors.teal, borderColor: gameColors.aqua }, primary: { backgroundColor: gameColors.gold, borderColor: gameColors.gold, marginTop: 10 }, divider: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 5 }, line: { height: 1, backgroundColor: gameColors.line, flex: 1 }, or: { color: gameColors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, codeInput: { textAlign: 'center', fontWeight: '900', letterSpacing: 4 }, codePanel: { backgroundColor: gameColors.navy, borderRadius: 14, padding: 22, alignItems: 'center', marginVertical: 10 }, codeLabel: { color: gameColors.aqua, fontSize: 11, fontWeight: '900', letterSpacing: 2 }, code: { color: gameColors.gold, fontSize: 42, fontWeight: '900', letterSpacing: 6, marginVertical: 8 }, playersTitle: { color: gameColors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 14 }, player: { minHeight: 52, borderTopWidth: 1, borderTopColor: gameColors.line, flexDirection: 'row', alignItems: 'center', gap: 14 }, playerIndex: { color: gameColors.aqua, fontWeight: '900' }, playerName: { color: gameColors.cloud, fontSize: 16, fontWeight: '800', flex: 1 }, host: { color: gameColors.gold, fontSize: 10, fontWeight: '900' }, waiting: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 12 } });