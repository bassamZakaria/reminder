import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDue } from '../lib/dates';
import { byDue } from '../lib/grouping';
import { EditorKind, useLists, useStore, type EditorTarget } from '../store/useStore';
import { AlertType, REPEAT_LABELS, REPEAT_RULES, RepeatRule, type Reminder } from '../types';
import { ActionMenu, type MenuAction } from './common';
import { DateTimeSheet } from './DateTimeSheet';
import { isMac, useTheme } from './theme';

enum EditorMenu {
  Folder = 'folder',
}

enum PickerMode {
  Add = 'add',
  Edit = 'edit',
}

type Picker = { mode: PickerMode.Add } | { mode: PickerMode.Edit; reminder: Reminder } | null;
type RepeatMenu = { reminder: Reminder } | null;

const OPEN_PICKER_DELAY_MS = 450;

export function EditorScreen({ target, onClose, expanded, onToggleExpand }: { target: NonNullable<EditorTarget>; onClose?: () => void; expanded?: boolean; onToggleExpand?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const existing = useStore(s => (target.kind === EditorKind.Existing ? s.notes[target.id] : undefined));
  const folders = useLists();
  const createNote = useStore(s => s.createNote);
  const updateNote = useStore(s => s.updateNote);
  const deleteNote = useStore(s => s.deleteNote);
  const closeEditor = useStore(s => s.closeEditor);
  const createReminder = useStore(s => s.createReminder);
  const updateReminder = useStore(s => s.updateReminder);
  const deleteReminder = useStore(s => s.deleteReminder);
  const completeReminder = useStore(s => s.completeReminder);
  const nativeAlarms = useStore(s => s.nativeAlarms);
  const alarmPermission = useStore(s => s.alarmPermission);
  const requestAlarmPermission = useStore(s => s.requestAlarmPermission);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [listId, setListId] = useState<string | null>(existing?.list_id ?? (target.kind === EditorKind.New ? target.listId : null));
  const [pinned, setPinned] = useState(existing?.is_pinned ?? false);
  const [picker, setPickerState] = useState<Picker>(null);
  const setPicker = useCallback((next: Picker) => {
    if (next) {
      Keyboard.dismiss();
    }
    setPickerState(next);
  }, []);
  const [menu, setMenu] = useState<EditorMenu | null>(null);
  const [repeatMenu, setRepeatMenu] = useState<RepeatMenu>(null);

  const [noteId, setNoteId] = useState<string | null>(existing?.id ?? null);
  const idRef = useRef<string | null>(existing?.id ?? null);
  const dirty = useRef(false);
  const unsaved = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<TextInput>(null);

  const allReminders = useStore(s => s.reminders);
  const reminders = useMemo(
    () =>
      noteId
        ? Object.values(allReminders)
            .filter(r => r.note_id === noteId)
            .sort((a, b) => Number(a.is_completed) - Number(b.is_completed) || byDue(a, b))
        : [],
    [allReminders, noteId],
  );
  const focusReminderId = target.kind === EditorKind.Existing ? target.focusReminderId : undefined;
  const openPickerOnMount = (target.kind === EditorKind.New && target.withReminder) || (target.kind === EditorKind.Existing && target.addReminder);

  useEffect(() => {
    if (!openPickerOnMount) {
      return;
    }
    const timer = setTimeout(() => setPicker({ mode: PickerMode.Add }), OPEN_PICKER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [openPickerOnMount, setPicker]);

  const payload = useMemo(() => ({ title: title.trim(), body, list_id: listId, is_pinned: pinned }), [title, body, listId, pinned]);
  const latest = useRef(payload);
  latest.current = payload;

  // Saves run one after another so a create in flight can never be followed by a second create.
  const save = useCallback(
    (force = false): Promise<void> => {
      const run = async () => {
        const data = latest.current;
        if (idRef.current) {
          await updateNote(idRef.current, data);
          return;
        }
        if (!force && !data.title && !data.body.trim()) {
          return;
        }
        const created = await createNote(data);
        if (created) {
          idRef.current = created.id;
          setNoteId(created.id);
        }
      };
      saveChain.current = saveChain.current.then(run, run);
      return saveChain.current;
    },
    [createNote, updateNote],
  );

  useEffect(() => {
    if (!dirty.current) {
      return;
    }
    unsaved.current = true;
    debounce.current = setTimeout(() => {
      debounce.current = null;
      unsaved.current = false;
      save();
    }, 500);
    return () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
        debounce.current = null;
      }
    };
  }, [payload, save]);

  useEffect(
    () => () => {
      if (unsaved.current) {
        unsaved.current = false;
        save();
      }
    },
    [save],
  );

  const mark =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      dirty.current = true;
      setter(v);
    };

  const cancelPendingSave = () => {
    unsaved.current = false;
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
  };

  const close = onClose ?? closeEditor;

  const done = async () => {
    cancelPendingSave();
    const data = latest.current;
    if (dirty.current) {
      await save();
    }
    const id = idRef.current;
    if (id && !data.title && !data.body.trim() && !Object.values(useStore.getState().reminders).some(r => r.note_id === id)) {
      deleteNote(id, true);
    }
    close();
  };

  const remove = () => {
    cancelPendingSave();
    dirty.current = false;
    const id = idRef.current;
    close();
    if (id) {
      saveChain.current.then(() => deleteNote(id));
    }
  };

  const ensureNote = async (): Promise<string | null> => {
    cancelPendingSave();
    await save(true);
    return idRef.current;
  };

  const confirmPicker = async (date: Date) => {
    const current = picker;
    setPicker(null);
    if (current?.mode === PickerMode.Edit) {
      await updateReminder(current.reminder.id, { due_at: date.toISOString(), is_completed: false, completed_at: null });
      return;
    }
    const id = await ensureNote();
    if (id) {
      await createReminder(id, { due_at: date.toISOString() });
    }
  };

  const toggleAlert = async (reminder: Reminder) => {
    const next = reminder.alert_type === AlertType.Alarm ? AlertType.Notification : AlertType.Alarm;
    await updateReminder(reminder.id, { alert_type: next });
    if (next !== AlertType.Alarm || !nativeAlarms || alarmPermission) {
      return;
    }
    if (Platform.OS === 'android') {
      Alert.alert('Ring exactly on time?', 'To ring at the exact minute, Recall needs the “Alarms & reminders” permission. You can change this later in Settings.', [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Allow', onPress: () => requestAlarmPermission() },
      ]);
      return;
    }
    await requestAlarmPermission();
  };

  const folder = listId ? folders.find(f => f.id === listId) : undefined;

  const folderActions: MenuAction[] = [
    { label: `${listId === null ? '✓  ' : ''}No folder`, onPress: () => mark(setListId)(null) },
    ...folders.map(f => ({ label: `${listId === f.id ? '✓  ' : ''}${f.name}`, onPress: () => mark(setListId)(f.id) })),
  ];
  const repeatActions: MenuAction[] = repeatMenu
    ? REPEAT_RULES.map(r => ({ label: `${repeatMenu.reminder.repeat_rule === r ? '✓  ' : ''}${REPEAT_LABELS[r]}`, onPress: () => updateReminder(repeatMenu.reminder.id, { repeat_rule: r }) }))
    : [];

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { borderBottomColor: t.border, paddingTop: isMac ? 10 : insets.top + 6, paddingLeft: insets.left + 12, paddingRight: insets.right + 8 }]}>
        <Pressable testID="editor-done" accessibilityRole="button" onPress={done} hitSlop={10} style={styles.headerButton}>
          <Text style={[styles.doneText, { color: t.accent }]}>{isMac ? 'Close' : 'Done'}</Text>
        </Pressable>
        <View style={styles.flex} />
        {onToggleExpand ? <HeaderIcon label={expanded ? '⤡' : '⤢'} a11y={expanded ? 'Exit full width' : 'Full width'} onPress={onToggleExpand} color={t.textSecondary} /> : null}
        <HeaderIcon testID="editor-pin" label="📌" a11y={pinned ? 'Unpin note' : 'Pin note'} onPress={() => mark(setPinned)(!pinned)} dim={!pinned} />
        {noteId ? <HeaderIcon testID="editor-delete" label="🗑" a11y="Delete note" onPress={remove} /> : null}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <TextInput
          testID="note-title"
          placeholder="Title"
          placeholderTextColor={t.muted}
          value={title}
          onChangeText={mark(setTitle)}
          style={[styles.title, { color: t.text }]}
          autoFocus={!existing && !openPickerOnMount}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => bodyRef.current?.focus()}
        />

        {folders.length ? (
          <Pressable testID="folder-pill" accessibilityRole="button" onPress={() => {
              Keyboard.dismiss();
              setMenu(EditorMenu.Folder);
            }} style={({ pressed }) => [styles.folderPill, { backgroundColor: t.pane, opacity: pressed ? 0.6 : 1 }]}>
            {folder ? <View style={[styles.dot, { backgroundColor: folder.color }]} /> : null}
            <Text style={[styles.folderText, { color: folder ? t.text : t.muted }]}>{folder ? folder.name : 'Add to folder'}</Text>
          </Pressable>
        ) : null}

        <View testID="note-reminders" style={[styles.reminders, { backgroundColor: t.pane, borderColor: t.border }]}>
          <View style={styles.remindersHeader}>
            <Text style={[styles.remindersTitle, { color: t.textSecondary }]}>
              ⏰ Reminders{reminders.length ? `  ${reminders.filter(r => !r.is_completed).length}` : ''}
            </Text>
            <Pressable testID="add-reminder" accessibilityRole="button" accessibilityLabel="Add reminder" onPress={() => setPicker({ mode: PickerMode.Add })} hitSlop={12}>
              <Text style={[styles.addText, { color: t.accent }]}>＋ Add</Text>
            </Pressable>
          </View>
          {reminders.length === 0 ? (
            <Pressable onPress={() => setPicker({ mode: PickerMode.Add })} accessibilityRole="button">
              <Text style={[styles.remindersEmpty, { color: t.muted }]}>No reminders. Add one to get a notification or alarm.</Text>
            </Pressable>
          ) : (
            reminders.map(r => (
              <EditorReminderRow
                key={r.id}
                reminder={r}
                focused={r.id === focusReminderId}
                onComplete={() => completeReminder(r.id)}
                onChangeTime={() => setPicker({ mode: PickerMode.Edit, reminder: r })}
                onToggleAlert={() => toggleAlert(r)}
                onRepeat={() => {
                  Keyboard.dismiss();
                  setRepeatMenu({ reminder: r });
                }}
                onDelete={() => deleteReminder(r.id)}
              />
            ))
          )}
        </View>

        <TextInput
          ref={bodyRef}
          testID="note-body"
          placeholder="Start writing…"
          placeholderTextColor={t.muted}
          value={body}
          onChangeText={mark(setBody)}
          multiline
          scrollEnabled={isMac}
          textAlignVertical="top"
          style={[styles.body, { color: t.text, minHeight: expanded ? 400 : 240 }]}
        />
      </ScrollView>

      <DateTimeSheet visible={picker !== null} value={picker?.mode === PickerMode.Edit ? new Date(picker.reminder.due_at) : null} onCancel={() => setPicker(null)} onConfirm={confirmPicker} />
      <ActionMenu visible={menu === EditorMenu.Folder} title="Move to folder" actions={folderActions} onClose={() => setMenu(null)} />
      <ActionMenu visible={repeatMenu !== null} title="Repeat" actions={repeatActions} onClose={() => setRepeatMenu(null)} />
    </KeyboardAvoidingView>
  );
}

function EditorReminderRow({
  reminder,
  focused,
  onComplete,
  onChangeTime,
  onToggleAlert,
  onRepeat,
  onDelete,
}: {
  reminder: Reminder;
  focused: boolean;
  onComplete: () => void;
  onChangeTime: () => void;
  onToggleAlert: () => void;
  onRepeat: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const now = new Date();
  const overdue = !reminder.is_completed && new Date(reminder.due_at).getTime() < now.getTime();
  const repeating = reminder.repeat_rule !== RepeatRule.None;
  return (
    <View testID="editor-reminder" style={[styles.reminderRow, { borderTopColor: t.border, backgroundColor: focused ? t.accentSoft : 'transparent' }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: reminder.is_completed }}
        accessibilityLabel={reminder.is_completed ? 'Mark as not done' : 'Mark as done'}
        onPress={onComplete}
        hitSlop={10}
        style={[styles.circle, { borderColor: reminder.is_completed ? t.accentFill : overdue ? t.danger : t.check, backgroundColor: reminder.is_completed ? t.accentFill : 'transparent' }]}>
        {reminder.is_completed ? <Text style={[styles.tick, { color: t.onAccent }]}>✓</Text> : null}
      </Pressable>
      <Pressable testID="reminder-time" accessibilityRole="button" accessibilityHint="Changes the date and time" onPress={onChangeTime} style={styles.reminderTimeButton}>
        <Text style={[styles.reminderTime, { color: reminder.is_completed ? t.muted : overdue ? t.danger : t.text, textDecorationLine: reminder.is_completed ? 'line-through' : 'none' }]}>
          {formatDue(reminder.due_at, now)}
        </Text>
      </Pressable>
      <Pill testID="alert-toggle" label={reminder.alert_type === AlertType.Alarm ? '⏰ Alarm' : '🔔'} onPress={onToggleAlert} active={reminder.alert_type === AlertType.Alarm} />
      <Pill testID="repeat-pill" label={repeating ? `↻ ${REPEAT_LABELS[reminder.repeat_rule]}` : '↻'} onPress={onRepeat} active={repeating} />
      <Pressable testID="reminder-delete" accessibilityRole="button" accessibilityLabel="Delete reminder" onPress={onDelete} hitSlop={4} style={styles.deleteButton}>
        <Text style={[styles.deleteText, { color: t.muted }]}>✕</Text>
      </Pressable>
    </View>
  );
}

function HeaderIcon({ label, a11y, onPress, color, dim, testID }: { label: string; a11y: string; onPress: () => void; color?: string; dim?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : dim ? 0.35 : 1 }]}>
      <Text style={[styles.headerIcon, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, onPress, active, testID }: { label: string; onPress: () => void; active?: boolean; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
      style={({ pressed }) => [styles.pill, { backgroundColor: active ? t.accentSoft : t.bg, borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}>
      <Text numberOfLines={1} style={[styles.pillText, { color: active ? t.text : t.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 17 },
  doneText: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingTop: 12, gap: 10 },
  title: { fontSize: 26, fontWeight: '800', paddingVertical: 4, letterSpacing: -0.3, minHeight: 44 },
  folderPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  folderText: { fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  reminders: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  remindersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9 },
  remindersTitle: { fontSize: 13, fontWeight: '700' },
  addText: { fontSize: 14, fontWeight: '700' },
  remindersEmpty: { fontSize: 13, paddingHorizontal: 12, paddingBottom: 12 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.7, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 12, fontWeight: '800', lineHeight: 14 },
  reminderTime: { fontSize: 14, fontWeight: '600' },
  reminderTimeButton: { flex: 1, minHeight: 44, justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 30, justifyContent: 'center', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, maxWidth: 120 },
  pillText: { fontSize: 12, fontWeight: '600' },
  deleteButton: { minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: isMac ? undefined : 25, paddingTop: isMac ? 0 : 4 },
});
