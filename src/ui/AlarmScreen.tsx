import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { Overlay } from './Overlay';
import { useTheme } from './theme';

export function AlarmScreen() {
  const t = useTheme();
  const alarm = useStore(s => s.activeAlarm);
  const dismissAlarm = useStore(s => s.dismissAlarm);
  const snoozeAlarm = useStore(s => s.snoozeAlarm);
  const pulse = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!alarm) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [alarm, pulse]);

  if (!alarm) {
    return null;
  }

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const now = new Date();

  return (
    <Overlay visible transparent={false} onRequestClose={dismissAlarm}>
      <View style={[styles.wrap, { backgroundColor: t.dark ? '#141210' : '#fff8ec', paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32, paddingLeft: insets.left + 32, paddingRight: insets.right + 32 }]}>
        <Animated.Text style={[styles.bell, { transform: [{ scale }] }]}>⏰</Animated.Text>
        <Text style={[styles.time, { color: t.text }]}>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>
          {alarm.title || 'Reminder'}
        </Text>
        {alarm.body ? (
          <Text style={[styles.body, { color: t.textSecondary }]} numberOfLines={6}>
            {alarm.body}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable onPress={() => snoozeAlarm(10)} style={({ pressed }) => [styles.snooze, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}>
            <Text style={{ color: t.textSecondary, fontSize: 16, fontWeight: '600' }}>Snooze 10 min</Text>
          </Pressable>
          <Pressable onPress={dismissAlarm} style={({ pressed }) => [styles.stop, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Stop</Text>
          </Pressable>
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bell: { fontSize: 72, marginBottom: 18 },
  time: { fontSize: 40, fontWeight: '200', marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  actions: { marginTop: 44, width: '100%', maxWidth: 320, gap: 12 },
  snooze: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  stop: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
});
