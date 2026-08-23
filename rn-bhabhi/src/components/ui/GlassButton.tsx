import React from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

type Props = { title: string; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean };

export default function GlassButton({ title, onPress, style, disabled = false }: Props) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} activeOpacity={0.8} style={[styles.button, style, disabled && styles.disabled]}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,220,115,0.12)'
  },
  text: { color: '#ffd36b', fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.45 },
});
