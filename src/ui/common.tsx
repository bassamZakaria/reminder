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
        { backgroundColor: active ? tint : t.cardAlt, borderColor: active ? tint : t.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: active ? '#fff' : t.text, fontWeight: active ? '600' : '500', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={[styles.segmentItem, active && { backgroundColor: t.card, shadowOpacity: 0.12 }]}>
            <Text style={{ color: active ? t.text : t.muted, fontWeight: '600', fontSize: 13 }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
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
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[styles.input, { backgroundColor: t.input, color: t.text, borderColor: t.border }, props.style]}
    />
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      {hint ? <Text style={{ color: t.muted, marginTop: 6, textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

export function Header({ title, right, left }: { title: string; right?: React.ReactNode; left?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>{left}</View>
      <Text numberOfLines={1} style={[styles.headerTitle, { color: t.text }]}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function IconButton({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingHorizontal: 6, paddingVertical: 4 })}>
      <Text style={{ color: color ?? t.accent, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginRight: 8, marginBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2, borderWidth: StyleSheet.hairlineWidth },
  segmentItem: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerSide: { width: 90, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700' },
});
