import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isSameDay } from '../lib/schedule';
import { Overlay, OverlayAnimation } from './Overlay';
import { useIsWide } from './layout';
import { useTheme } from './theme';

enum Meridiem {
  AM = 'AM',
  PM = 'PM',
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ITEM_HEIGHT = 38;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function DateTimeSheet({ visible, value, onCancel, onConfirm }: { visible: boolean; value: Date | null; onCancel: () => void; onConfirm: (d: Date) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const [draft, setDraft] = useState(() => value ?? defaultDate());
  const [month, setMonth] = useState(() => startOfMonth(value ?? defaultDate()));

  useEffect(() => {
    if (visible) {
      const next = value ?? defaultDate();
      setDraft(next);
      setMonth(startOfMonth(next));
    }
  }, [visible, value]);

  const grid = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const setDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
    setDraft(next);
  };

  const setTime = (hour12: number, minute: number, pm: boolean) => {
    const next = new Date(draft);
    next.setHours((hour12 % 12) + (pm ? 12 : 0), minute, 0, 0);
    setDraft(next);
  };

  const now = new Date();
  const quick = [
    { label: 'In 1 hour', at: roundUp(new Date(now.getTime() + 3600_000)) },
    { label: 'This evening', at: atTime(now, 19, 0) },
    { label: 'Tomorrow 9 AM', at: atTime(addDays(now, 1), 9, 0) },
    { label: 'Next week', at: atTime(addDays(now, 7), 9, 0) },
  ].filter(q => q.at.getTime() > now.getTime() + 15 * 60_000);
  const inPast = draft.getTime() <= now.getTime();

  const hour12 = draft.getHours() % 12 === 0 ? 12 : draft.getHours() % 12;
  const pm = draft.getHours() >= 12;

  return (
    <Overlay visible={visible} animationType={wide ? OverlayAnimation.Fade : OverlayAnimation.Slide} onRequestClose={onCancel}>
      <View style={[styles.backdrop, { justifyContent: wide ? 'center' : 'flex-end' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 16, maxWidth: wide ? 380 : undefined, paddingTop: wide ? 16 : 6, alignSelf: wide ? 'center' : 'stretch', borderRadius: wide ? 16 : 0, borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
          {!wide ? (
            <View style={styles.grabber}>
              <View style={[styles.grabberBar, { backgroundColor: t.border }]} />
            </View>
          ) : null}

          <View style={styles.quickRow}>
            {quick.map(q => (
              <Pressable
                key={q.label}
                accessibilityRole="button"
                onPress={() => {
                  setDraft(q.at);
                  setMonth(startOfMonth(q.at));
                }}
                style={({ pressed }) => [styles.quickChip, { backgroundColor: q.at.getTime() === draft.getTime() ? t.accentSoft : t.pane, opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[styles.quickText, { color: t.text }]}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
              <Text style={{ color: t.accent, fontSize: 20 }}>‹</Text>
            </Pressable>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
              <Text style={{ color: t.accent, fontSize: 20 }}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.weekday, { color: t.muted }]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {grid.map(d => {
              const selected = isSameDay(d, draft);
              const today = isSameDay(d, new Date());
              const inMonth = d.getMonth() === month.getMonth();
              const past = startOfDayTs(d) < startOfDayTs(now);
              return (
                <Pressable key={d.toISOString()} accessibilityRole="button" accessibilityLabel={d.toDateString()} onPress={() => setDay(d)} style={styles.cell}>
                  <View style={[styles.day, selected && { backgroundColor: t.accentFill }]}>
                    <Text style={{ color: selected ? t.onAccent : past ? t.check : inMonth ? t.text : t.muted, fontSize: 15, fontWeight: today && !selected ? '700' : '400' }}>{d.getDate()}</Text>
                  </View>
                  {today && !selected ? <View style={[styles.todayDot, { backgroundColor: t.accent }]} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.timeRow, { borderTopColor: t.border }]}>
            <View style={styles.wheels}>
              <View style={[styles.highlight, { backgroundColor: t.pane }]} pointerEvents="none" />
              <Wheel items={HOURS} value={hour12} format={n => String(n)} onChange={n => setTime(n, draft.getMinutes(), pm)} />
              <Text style={[styles.colon, { color: t.text }]}>:</Text>
              <Wheel items={MINUTES} value={nearestMinute(draft.getMinutes())} format={n => String(n).padStart(2, '0')} onChange={n => setTime(hour12, n, pm)} />
              <View style={styles.ampm}>
                {[Meridiem.AM, Meridiem.PM].map(label => {
                  const active = (label === Meridiem.PM) === pm;
                  return (
                    <Pressable key={label} onPress={() => setTime(hour12, draft.getMinutes(), label === Meridiem.PM)} style={[styles.ampmButton, active && { backgroundColor: t.accent }]}>
                      <Text style={{ color: active ? t.onAccent : t.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {inPast ? <Text style={[styles.warning, { color: t.danger }]}>That time is in the past. Pick a later time.</Text> : null}

          <View style={styles.actions}>
            <Pressable testID="date-cancel" accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancel, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}>
              <Text style={{ color: t.textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="date-confirm"
              accessibilityRole="button"
              disabled={inPast}
              onPress={() => onConfirm(draft)}
              style={({ pressed }) => [styles.confirm, { backgroundColor: t.accentFill, opacity: inPast ? 0.4 : pressed ? 0.8 : 1 }]}>
              <Text style={{ color: t.onAccent, fontSize: 15, fontWeight: '700' }}>
                {draft.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {draft.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Overlay>
  );
}

function Wheel({ items, value, format, onChange }: { items: number[]; value: number; format: (n: number) => string; onChange: (n: number) => void }) {
  const t = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.indexOf(value));

  useEffect(() => {
    const handle = setTimeout(() => ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false }), 30);
    return () => clearTimeout(handle);
  }, [index]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const next = items[Math.min(items.length - 1, Math.max(0, i))];
    if (next !== value) {
      onChange(next);
    }
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}>
      {items.map(n => (
        <Pressable key={n} onPress={() => onChange(n)} style={styles.wheelItem}>
          <Text style={{ color: n === value ? t.text : t.muted, fontSize: n === value ? 20 : 17, fontWeight: n === value ? '700' : '400' }}>{format(n)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function startOfDayTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function nearestMinute(m: number): number {
  return MINUTES.reduce((best, n) => (Math.abs(n - m) < Math.abs(best - m) ? n : best), 0);
}
function defaultDate(): Date {
  return roundUp(new Date(Date.now() + 3600_000));
}
function roundUp(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(Math.ceil(x.getMinutes() / 5) * 5, 0, 0);
  return x;
}
function atTime(d: Date, h: number, m: number): Date {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function shiftMonth(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { paddingHorizontal: 16, paddingTop: 6 },
  grabber: { alignItems: 'center', paddingVertical: 8 },
  grabberBar: { width: 38, height: 4, borderRadius: 2 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  quickChip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 18 },
  quickText: { fontSize: 13, fontWeight: '600' },
  warning: { fontSize: 13, textAlign: 'center', marginTop: 10 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 1, minHeight: 44 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  timeRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 10 },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM_HEIGHT * 3 },
  highlight: { position: 'absolute', left: 40, right: 40, height: ITEM_HEIGHT, borderRadius: 8 },
  wheel: { height: ITEM_HEIGHT * 3, width: 62 },
  wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  colon: { fontSize: 20, fontWeight: '700', marginHorizontal: 2 },
  ampm: { marginLeft: 14, gap: 6 },
  ampmButton: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancel: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirm: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
