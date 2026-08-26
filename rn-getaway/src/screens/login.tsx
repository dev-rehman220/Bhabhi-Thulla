import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import GlassButton from '~/components/ui/GlassButton';
import { FirebaseService } from '~/services/FirebaseService';
import { socketManager } from '~/services/socket';
import { useAuthStore } from '~/store/authStore';
import { useGameStore } from '~/store/gameStore';

export default function LoginScreen({ navigation }: any) {
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const setAuth = useGameStore((s) => s.setAuth);

  async function handleGuest() {
    try {
      const user = await FirebaseService.signInAsGuest();
      const token = await FirebaseService.getIdToken();
      setUser({ id: user.uid, name: user.displayName ?? 'Guest', avatarUrl: user.photoURL ?? '', isGuest: true });
      setToken(token);
      setAuth(user.uid, user.displayName ?? 'Guest', user.photoURL ?? '');
      socketManager.connect(token);
      navigation.replace('Lobby');
    } catch (error) {
      console.warn('Guest login failed, falling back to local user', error);
      const fallbackId = `guest_${Date.now()}`;
      setUser({ id: fallbackId, name: 'Guest', isGuest: true });
      setToken(null);
      setAuth(fallbackId, 'Guest', '');
      socketManager.connect();
      navigation.replace('Lobby');
    }
  }

  async function handleGoogle() {
    try {
      const user = await FirebaseService.signInWithGoogle();
      const token = await FirebaseService.getIdToken();
      setUser({ id: user.uid, name: user.displayName ?? 'Player', avatarUrl: user.photoURL ?? '' });
      setToken(token);
      setAuth(user.uid, user.displayName ?? 'Player', user.photoURL ?? '');
      socketManager.connect(token);
      navigation.replace('Lobby');
    } catch (error) {
      console.warn('Google sign in failed', error);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Get Away Thulla</Text>
        <GlassButton title="Continue as Guest" onPress={handleGuest} />
        <TouchableOpacity style={{ marginTop: 12 }} onPress={handleGoogle}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>Login with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#073b2f', alignItems: 'center', justifyContent: 'center' },
  card: { width: '90%', padding: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  title: { color: '#ffd36b', fontSize: 20, marginBottom: 12, fontWeight: '700', textAlign: 'center' }
});
