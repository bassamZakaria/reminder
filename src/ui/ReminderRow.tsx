import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDue, formatReminderTime } from '../lib/dates';
import { firstLine, noteHeadline } from '../lib/schedule';
import { EditorKind, useStore } from '../store/useStore';
import { AlertType, REPEAT_LABELS, RepeatRule, type Reminder } from '../types';
import { isDesktop, useTheme } from './theme';

export const ReminderRow = memo(function ReminderRow({
  reminder,
  siblingCount,
  expanded,
  onToggleExpand,
  onLongPress,
}: {
  reminder: Reminder;
  siblingCount: number;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onLongPress: (reminder: Reminder) => void;
}) {
  const t = useTheme();
  const note = useStore(s => s.notes[reminder.note_id]);
  const folder = useStore(s => (note?.list_id ? s.lists[note.list_id] : undefined));
  const selected = useStore(s => s.editor?.kind === EditorKind.Existing && s.editor.focusReminderId === reminder.id);
  const completeReminder = useStore(s => s.completeReminder);
  const snoozeReminder = useStore(s => s.snoozeReminder);
  const openEditor = useStore(s => s.openEditor);

  const now = new Date();
  const due = new Date(reminder.due_at);
  const overdue = !reminder.is_completed && due.getTime() < now.getTime();
  const title = noteHeadline(note);
  const snippet = note?.title ? firstLine(note.body) : '';
  const repeating = reminder.repeat_rule !== RepeatRule.None;
  const openNote = () => openEditor({ kind: EditorKind.Existing, id: reminder.note_id, focusReminderId: reminder.id });

  return (
    <View style={[styles.wrap, expanded && [styles.wrapExpanded, { backgroundColor: t.pane, borderColor: t.border }]]}>
      <Pressable
        testID={`reminder-${title}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={[title, snippet, formatDue(reminder.due_at, now), repeating ? `repeats ${REPEAT_LABELS[reminder.repeat_rule].toLowerCase()}` : '', reminder.alert_type === AlertType.Alarm ? 'alarm' : '', reminder.is_completed ? 'done' : '']
          .filter(Boolean)
          .join(', ')}
        onPress={isDesktop ? openNote : () => onToggleExpand(reminder.id)}
        onLongPress={() => onLongPress(reminder)}
        delayLongPress={350}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.row,
          { backgroundColor: selected ? t.selected : (pressed || hovered) && !expanded ? t.hover : 'transparent' },
        ]}>
        <Pressable
          testID={`complete-${title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: reminder.is_completed }}
          accessibilityLabel={reminder.is_completed ? 'Mark as not done' : 'Mark as done'}
          onPress={() => completeReminder(reminder.id)}
          hitSlop={12}
          style={[styles.circle, { borderColor: reminder.is_completed ? t.accentFill : overdue ? t.danger : t.check, backgroundColor: reminder.is_completed ? t.accentFill : 'transparent' }]}>
          {reminder.is_completed ? <Text style={[styles.tick, { color: t.onAccent }]}>✓</Text> : null}
        </Pressable>
        <View style={styles.main}>
          <View style={styles.line}>
            <Text numberOfLines={1} style={[styles.title, { color: reminder.is_completed ? t.muted : t.text, textDecorationLine: reminder.is_completed ? 'line-through' : 'none' }]}>
              {title}
            </Text>
            <Text style={[styles.time, { color: overdue ? t.danger : reminder.is_completed ? t.muted : t.textSecondary }]}>{formatReminderTime(reminder.due_at, now)}</Text>
            {reminder.alert_type === AlertType.Alarm ? <Text style={styles.glyph}>⏰</Text> : null}
            {repeating ? <Text style={[styles.glyphText, { color: t.muted }]}>↻</Text> : null}
          </View>
          {snippet || folder || siblingCount ? (
            <View style={styles.line}>
              <Text numberOfLines={1} style={[styles.sub, styles.flex, { color: t.muted }]}>
                {snippet}
              </Text>
              {siblingCount ? <Text style={[styles.sub, { color: t.muted }]}>+{siblingCount} more</Text> : null}
              {folder ? (
                <View style={styles.folder}>
                  <View style={[styles.dot, { backgroundColor: folder.color }]} />
                  <Text numberOfLines={1} style={[styles.sub, styles.folderName, { color: t.textSecondary }]}>
                    {folder.name}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          {note?.body.trim() ? (
            <Text testID="reminder-note-body" style={[styles.body, { color: t.text }]} numberOfLines={10}>
              {note.title ? note.body.trim() : note.body.trim().split('\n').slice(1).join('\n').trim() || note.body.trim()}
            </Text>
          ) : (
            <Text style={[styles.body, { color: t.muted }]}>No note text.</Text>
          )}
          <Text style={[styles.meta, { color: t.textSecondary }]}>
            {formatDue(reminder.due_at, now)}
            {repeating ? ` · Repeats ${REPEAT_LABELS[reminder.repeat_rule].toLowerCase()}` : ''}
            {` · ${reminder.alert_type === AlertType.Alarm ? 'Alarm' : 'Notification'}`}
          </Text>
          <View style={styles.actions}>
            <Action testID="reminder-open" label="Open note" onPress={openNote} primary />
            {!reminder.is_completed ? <Action label="Snooze 1h" onPress={() => snoozeReminder(reminder.id, 60)} /> : null}
            <Action label={reminder.is_completed ? 'Not done' : repeating ? 'Done, next' : 'Done'} onPress={() => completeReminder(reminder.id)} />
          </View>
        </View>
      ) : null}
    </View>
  );
});

function Action({ label, onPress, primary, testID }: { label: string; onPress: () => void; primary?: boolean; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: primary ? t.accentFill : t.bg, borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.actionText, { color: primary ? t.onAccent : t.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  wrapExpanded: { marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.7, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 12, fontWeight: '800', lineHeight: 14 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  time: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  glyph: { fontSize: 11 },
  glyphText: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 12 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 110 },
  folderName: { flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  details: { paddingLeft: 40, paddingRight: 12, paddingBottom: 12, gap: 8 },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  actionText: { fontSize: 13, fontWeight: '600' },
});
