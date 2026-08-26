import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import LottieView from 'lottie-react-native';

export default function SplashScreen({ navigation }: any) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Login'), 2200);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LottieView source={require('~/../../rn-getaway/assets/animations/dealing.json')} autoPlay loop={false} style={{ width: 260, height: 260 }} />
      <Text style={styles.title}>Get Away Thulla</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06382f', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffd36b', fontSize: 28, marginTop: 18, fontWeight: '700' }
});
