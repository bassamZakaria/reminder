import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue } from '../lib/dates';
import { firstLine } from '../lib/schedule';
import { useStore } from '../store/useStore';
import type { Item } from '../types';
import { useTheme } from './theme';

export function ItemRow({ item, showList = true }: { item: Item; showList?: boolean }) {
  const t = useTheme();
  const list = useStore(s => (item.list_id ? s.lists[item.list_id] : undefined));
  const toggleComplete = useStore(s => s.toggleComplete);
  const openEditor = useStore(s => s.openEditor);
  const overdue = !!item.due_at && !item.is_completed && new Date(item.due_at).getTime() < Date.now();
  const tint = list?.color ?? t.accent;
  const snippet = firstLine(item.body);

  return (
    <Pressable onPress={() => openEditor({ kind: 'existing', id: item.id })} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.cardAlt : t.card, borderBottomColor: t.border }]}>
      <Pressable onPress={() => toggleComplete(item.id)} hitSlop={10} style={[styles.circle, { borderColor: tint, backgroundColor: item.is_completed ? tint : 'transparent' }]}>
        {item.is_completed ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, { color: item.is_completed ? t.muted : t.text, textDecorationLine: item.is_completed ? 'line-through' : 'none' }]}>
          {item.title || 'Untitled'}
        </Text>
        {snippet ? (
          <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
            {snippet}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {item.due_at ? (
            <Text style={{ color: overdue ? t.danger : t.muted, fontSize: 12 }}>
              {formatDue(item.due_at)}
              {item.repeat_rule !== 'none' ? ` · ${item.repeat_rule}` : ''}
            </Text>
          ) : null}
          {showList && list ? (
            <Text style={{ color: list.color, fontSize: 12, marginLeft: item.due_at ? 10 : 0 }}>● {list.name}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, marginRight: 12, marginTop: 1, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  title: { fontSize: 16, fontWeight: '500' },
  meta: { flexDirection: 'row', marginTop: 3, flexWrap: 'wrap' },
});
