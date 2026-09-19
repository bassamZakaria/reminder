import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue, formatRelative } from '../lib/dates';
import { firstLine, isSameDay } from '../lib/schedule';
import { EditorKind, useStore } from '../store/useStore';
import { AlertType, RepeatRule, type Item } from '../types';
import { isMac, useTheme } from './theme';

export const NoteRow = memo(function NoteRow({ item, showFolder = true, onLongPress }: { item: Item; showFolder?: boolean; onLongPress?: (item: Item) => void }) {
  const t = useTheme();
  const folder = useStore(s => (item.list_id ? s.lists[item.list_id] : undefined));
  const toggleComplete = useStore(s => s.toggleComplete);
  const openEditor = useStore(s => s.openEditor);
  const selected = useStore(s => s.editor?.kind === EditorKind.Existing && s.editor.id === item.id);
  const now = new Date();
  const due = item.due_at ? new Date(item.due_at) : null;
  const overdue = !!due && !item.is_completed && due.getTime() < now.getTime();
  const dueToday = !!due && !item.is_completed && isSameDay(due, now);
  const snippet = firstLine(item.body);
  const title = item.title || snippet || 'New Note';
  const badgeBg = item.is_completed ? t.pane : overdue ? t.dangerSoft : dueToday ? t.accentSoft : t.pane;
  const badgeColor = item.is_completed ? t.muted : overdue ? t.danger : dueToday ? t.text : t.textSecondary;

  return (
    <Pressable
      testID={`row-${title}`}
      accessibilityRole="button"
      accessibilityLabel={[title, snippet && item.title ? snippet : '', due ? `reminder ${formatDue(item.due_at!, now)}` : '', item.is_completed ? 'done' : ''].filter(Boolean).join(', ')}
      onPress={() => openEditor({ kind: EditorKind.Existing, id: item.id })}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      delayLongPress={350}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        { backgroundColor: selected && isMac ? t.selected : pressed || hovered ? t.hover : 'transparent' },
      ]}>
      {due ? (
        <Pressable
          testID={`complete-${title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.is_completed }}
          accessibilityLabel={item.is_completed ? 'Mark as not done' : 'Mark as done'}
          onPress={() => toggleComplete(item.id)}
          hitSlop={12}
          style={[styles.circle, { borderColor: item.is_completed ? t.accent : overdue ? t.danger : t.check, backgroundColor: item.is_completed ? t.accent : 'transparent' }]}>
          {item.is_completed ? <Text style={styles.tick}>✓</Text> : null}
        </Pressable>
      ) : (
        <View style={[styles.noteIcon, { backgroundColor: t.pane }]}>
          <Text style={[styles.noteGlyph, { color: t.muted }]}>≡</Text>
        </View>
      )}
      <View style={styles.main}>
        <View style={styles.titleRow}>
          {item.is_pinned ? <Text style={styles.pin}>📌</Text> : null}
          <Text numberOfLines={1} style={[styles.title, { color: item.is_completed ? t.muted : t.text, textDecorationLine: item.is_completed ? 'line-through' : 'none' }]}>
            {title}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {due ? (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={styles.badgeIcon}>{item.alert_type === AlertType.Alarm ? '⏰' : '🔔'}</Text>
              <Text style={[styles.badgeText, { color: badgeColor }]}>
                {formatDue(item.due_at!, now)}
                {item.repeat_rule !== RepeatRule.None ? ' ↻' : ''}
              </Text>
            </View>
          ) : (
            <Text style={[styles.meta, { color: t.muted }]}>{formatRelative(item.updated_at, now)}</Text>
          )}
          {snippet && item.title ? (
            <Text numberOfLines={1} style={[styles.meta, styles.snippet, { color: t.muted }]}>
              {snippet}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {showFolder && folder ? (
            <View style={styles.folder}>
              <View style={[styles.dot, { backgroundColor: folder.color }]} />
              <Text numberOfLines={1} style={[styles.meta, styles.folderName, { color: t.textSecondary }]}>
                {folder.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginHorizontal: 8 },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.7, marginRight: 10, marginTop: 0, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  noteIcon: { width: 20, height: 20, borderRadius: 5, marginRight: 10, marginTop: 0, alignItems: 'center', justifyContent: 'center' },
  noteGlyph: { fontSize: 14, fontWeight: '700' },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  pin: { fontSize: 11, marginRight: 4 },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 8 },
  meta: { fontSize: 12 },
  flex: { flex: 1 },
  snippet: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  badgeIcon: { fontSize: 10 },
  badgeText: { fontSize: 12, fontWeight: '600', marginLeft: 3 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 110 },
  folderName: { flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
