import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  const t = useTheme();
  const tint = color ?? t.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? tint : t.input, borderColor: active ? tint : 'transparent', opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: active ? '#fff' : t.text, fontWeight: active ? '600' : '500', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', style, disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; style?: ViewStyle; disabled?: boolean }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : 'transparent';
  const color = kind === 'ghost' ? t.accent : '#fff';
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }, style]}>
      <Text style={{ color, fontWeight: '600', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return <TextInput placeholderTextColor={t.muted} {...props} style={[styles.input, { backgroundColor: t.input, color: t.text }, props.style]} />;
}

export function Empty({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      {icon ? <Text style={{ fontSize: 44, marginBottom: 10 }}>{icon}</Text> : null}
      <Text style={{ color: t.textSecondary, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      {hint ? <Text style={{ color: t.muted, marginTop: 6, textAlign: 'center', fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

export function IconButton({ label, onPress, color, size = 18 }: { label: string; onPress: () => void; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingHorizontal: 6, paddingVertical: 4 })}>
      <Text style={{ color: color ?? t.accent, fontSize: size, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, onPress, selected, style }: { children: React.ReactNode; onPress?: () => void; selected?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        { backgroundColor: selected ? t.selected : pressed || hovered ? t.hover : 'transparent' },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
});
