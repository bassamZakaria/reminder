import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue, formatRelative, formatReminderTime } from '../lib/dates';
import { firstLine, isSameDay } from '../lib/schedule';
import { EditorKind, useStore } from '../store/useStore';
import { AlertType, RepeatRule, type Note, type Reminder } from '../types';
import { isMac, useTheme } from './theme';

const MAX_CHIPS = 2;

export const NoteRow = memo(function NoteRow({
  note,
  reminders,
  showFolder = true,
  onLongPress,
}: {
  note: Note;
  reminders: Reminder[];
  showFolder?: boolean;
  onLongPress?: (note: Note) => void;
}) {
  const t = useTheme();
  const folder = useStore(s => (note.list_id ? s.lists[note.list_id] : undefined));
  const openEditor = useStore(s => s.openEditor);
  const selected = useStore(s => s.editor?.kind === EditorKind.Existing && s.editor.id === note.id);
  const now = new Date();
  const snippet = firstLine(note.body);
  const title = note.title || snippet || 'New Note';
  const open = reminders.filter(r => !r.is_completed);
  const chips = open.slice(0, MAX_CHIPS);
  const extra = open.length - chips.length;

  return (
    <Pressable
      testID={`row-${title}`}
      accessibilityRole="button"
      accessibilityLabel={[title, snippet && note.title ? snippet : '', ...open.map(r => `reminder ${formatDue(r.due_at, now)}`)].filter(Boolean).join(', ')}
      onPress={() => openEditor({ kind: EditorKind.Existing, id: note.id })}
      onLongPress={onLongPress ? () => onLongPress(note) : undefined}
      delayLongPress={350}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        { backgroundColor: selected && isMac ? t.selected : pressed || hovered ? t.hover : 'transparent' },
      ]}>
      <View style={[styles.icon, { backgroundColor: open.length ? t.accentSoft : t.pane }]}>
        <Text style={[styles.glyph, { color: open.length ? t.accent : t.muted }]}>{open.length ? '⏰' : '≡'}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.line}>
          {note.is_pinned ? <Text style={styles.pin}>📌</Text> : null}
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
            {title}
          </Text>
          <Text style={[styles.meta, { color: t.muted }]}>{formatRelative(note.updated_at, now)}</Text>
        </View>
        {(snippet && note.title) || (showFolder && folder) ? (
          <View style={styles.line}>
            <Text numberOfLines={1} style={[styles.meta, styles.flex, { color: t.muted }]}>
              {note.title ? snippet : ''}
            </Text>
            {showFolder && folder ? (
              <View style={styles.folder}>
                <View style={[styles.dot, { backgroundColor: folder.color }]} />
                <Text numberOfLines={1} style={[styles.meta, styles.folderName, { color: t.textSecondary }]}>
                  {folder.name}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {chips.length ? (
          <View style={styles.chips}>
            {chips.map(r => {
              const due = new Date(r.due_at);
              const overdue = due.getTime() < now.getTime();
              const today = isSameDay(due, now);
              return (
                <View key={r.id} style={[styles.chip, { backgroundColor: overdue ? t.dangerSoft : today ? t.accentSoft : t.pane }]}>
                  <Text style={styles.chipIcon}>{r.alert_type === AlertType.Alarm ? '⏰' : '🔔'}</Text>
                  <Text style={[styles.chipText, { color: overdue ? t.danger : t.textSecondary }]}>
                    {today ? `Today ${formatReminderTime(r.due_at, now)}` : formatDue(r.due_at, now)}
                    {r.repeat_rule !== RepeatRule.None ? ' ↻' : ''}
                  </Text>
                </View>
              );
            })}
            {extra > 0 ? <Text style={[styles.meta, { color: t.muted }]}>+{extra}</Text> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginHorizontal: 8 },
  icon: { width: 20, height: 20, borderRadius: 5, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 11, fontWeight: '700' },
  main: { flex: 1, minWidth: 0, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  pin: { fontSize: 11 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 110 },
  folderName: { flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  chipIcon: { fontSize: 10 },
  chipText: { fontSize: 12, fontWeight: '600', marginLeft: 3 },
});
