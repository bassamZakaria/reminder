import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue, formatRelative } from '../lib/dates';
import { firstLine, isSameDay } from '../lib/schedule';
import { useStore } from '../store/useStore';
import type { Item } from '../types';
import { isMac, useTheme } from './theme';

export function NoteRow({ item, showFolder = true }: { item: Item; showFolder?: boolean }) {
  const t = useTheme();
  const folder = useStore(s => (item.list_id ? s.lists[item.list_id] : undefined));
  const toggleComplete = useStore(s => s.toggleComplete);
  const openEditor = useStore(s => s.openEditor);
  const selected = useStore(s => s.editor?.kind === 'existing' && s.editor.id === item.id);
  const now = new Date();
  const due = item.due_at ? new Date(item.due_at) : null;
  const overdue = !!due && !item.is_completed && due.getTime() < now.getTime() && !isSameDay(due, now);
  const dueSoon = !!due && !item.is_completed && isSameDay(due, now);
  const snippet = firstLine(item.body);

  return (
    <Pressable
      onPress={() => openEditor({ kind: 'existing', id: item.id })}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        { backgroundColor: selected && isMac ? t.selected : pressed || hovered ? t.hover : 'transparent' },
      ]}>
      {due ? (
        <Pressable
          onPress={() => toggleComplete(item.id)}
          hitSlop={10}
          style={[styles.circle, { borderColor: item.is_completed ? t.accent : overdue ? t.danger : t.check, backgroundColor: item.is_completed ? t.accent : 'transparent' }]}>
          {item.is_completed ? <Text style={styles.tick}>✓</Text> : null}
        </Pressable>
      ) : (
        <Text style={[styles.noteGlyph, { color: t.muted }]}>📄</Text>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          {item.is_pinned ? <Text style={{ fontSize: 11, marginRight: 4 }}>📌</Text> : null}
          <Text numberOfLines={1} style={[styles.title, { color: item.is_completed ? t.muted : t.text, textDecorationLine: item.is_completed ? 'line-through' : 'none' }]}>
            {item.title || 'New Note'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={{ color: t.muted, fontSize: 12 }}>{formatRelative(item.updated_at, now)}</Text>
          {snippet ? (
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12, flex: 1, marginLeft: 8 }}>
              {snippet}
            </Text>
          ) : null}
        </View>
        {due ? (
          <View style={[styles.badge, { backgroundColor: item.is_completed ? 'transparent' : overdue ? t.dangerSoft : dueSoon ? t.accentSoft : t.pane }]}>
            <Text style={{ fontSize: 11 }}>{item.alert_type === 'alarm' ? '⏰' : '🔔'}</Text>
            <Text style={{ color: item.is_completed ? t.muted : overdue ? t.danger : t.textSecondary, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
              {formatDue(item.due_at!, now)}
              {item.repeat_rule !== 'none' ? '  ⟳' : ''}
            </Text>
          </View>
        ) : null}
      </View>
      {showFolder && folder ? (
        <View style={styles.folderTag}>
          <View style={[styles.dot, { backgroundColor: folder.color }]} />
          <Text numberOfLines={1} style={{ color: t.muted, fontSize: 11, maxWidth: 90 }}>
            {folder.name}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginHorizontal: 8 },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, marginRight: 12, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
  noteGlyph: { fontSize: 14, marginRight: 12, marginTop: 2, width: 20, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginTop: 6 },
  folderTag: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
});
