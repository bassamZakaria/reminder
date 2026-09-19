import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDue } from '../lib/dates';
import { EditorKind, useLists, useStore, type EditorTarget } from '../store/useStore';
import { AlertType, REPEAT_LABELS, REPEAT_RULES, RepeatRule } from '../types';
import { ActionMenu, type MenuAction } from './common';
import { DateTimeSheet } from './DateTimeSheet';
import { isMac, useTheme } from './theme';

enum EditorMenu {
  Repeat = 'repeat',
  Folder = 'folder',
}

export function EditorScreen({ target, onClose, expanded, onToggleExpand }: { target: NonNullable<EditorTarget>; onClose?: () => void; expanded?: boolean; onToggleExpand?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const existing = useStore(s => (target.kind === EditorKind.Existing ? s.items[target.id] : undefined));
  const folders = useLists();
  const createItem = useStore(s => s.createItem);
  const updateItem = useStore(s => s.updateItem);
  const deleteItem = useStore(s => s.deleteItem);
  const closeEditor = useStore(s => s.closeEditor);
  const toggleComplete = useStore(s => s.toggleComplete);
  const nativeAlarms = useStore(s => s.nativeAlarms);
  const requestAlarmPermission = useStore(s => s.requestAlarmPermission);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [listId, setListId] = useState<string | null>(existing?.list_id ?? (target.kind === EditorKind.New ? target.listId : null));
  const [alertType, setAlertType] = useState<AlertType>(existing?.alert_type ?? AlertType.Notification);
  const [due, setDue] = useState<Date | null>(existing?.due_at ? new Date(existing.due_at) : null);
  const [repeat, setRepeat] = useState<RepeatRule>(existing?.repeat_rule ?? RepeatRule.None);
  const [pinned, setPinned] = useState(existing?.is_pinned ?? false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menu, setMenu] = useState<EditorMenu | null>(null);

  const [itemId, setItemId] = useState<string | null>(existing?.id ?? null);
  const idRef = useRef<string | null>(existing?.id ?? null);
  const dirty = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef(false);
  const bodyRef = useRef<TextInput>(null);
  const completed = useStore(s => (itemId ? s.items[itemId]?.is_completed ?? false : false));

  const payload = useMemo(
    () => ({
      title: title.trim(),
      body,
      list_id: listId,
      is_pinned: pinned,
      alert_type: alertType,
      due_at: due ? due.toISOString() : null,
      repeat_rule: due ? repeat : RepeatRule.None,
    }),
    [title, body, listId, alertType, due, repeat, pinned],
  );
  const latest = useRef(payload);
  latest.current = payload;

  // Saves run one after another so a create in flight can never be followed by a second create.
  const save = useCallback((): Promise<void> => {
    const run = async () => {
      const data = latest.current;
      if (idRef.current) {
        await updateItem(idRef.current, data);
        return;
      }
      if (!data.title && !data.body.trim()) {
        return;
      }
      const created = await createItem(data);
      if (created) {
        idRef.current = created.id;
        setItemId(created.id);
      }
    };
    saveChain.current = saveChain.current.then(run, run);
    return saveChain.current;
  }, [createItem, updateItem]);

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
    if (idRef.current && !data.title && !data.body.trim() && !data.due_at) {
      deleteItem(idRef.current, true);
    }
    close();
  };

  const remove = () => {
    cancelPendingSave();
    dirty.current = false;
    const id = idRef.current;
    close();
    if (id) {
      saveChain.current.then(() => deleteItem(id));
    }
  };

  const pickAlert = async (next: AlertType) => {
    mark(setAlertType)(next);
    if (next === AlertType.Alarm && nativeAlarms) {
      await requestAlarmPermission();
    }
  };

  const toggleReminder = (on: boolean) => {
    if (on) {
      setPickerOpen(true);
    } else {
      mark(setDue)(null);
      mark(setRepeat)(RepeatRule.None);
    }
  };

  const markDone = async () => {
    cancelPendingSave();
    await save();
    const id = idRef.current;
    if (!id) {
      return;
    }
    await toggleComplete(id);
    const nextDue = useStore.getState().items[id]?.due_at;
    setDue(nextDue ? new Date(nextDue) : null);
  };

  const folder = listId ? folders.find(f => f.id === listId) : undefined;
  const pastDue = !!due && !completed && repeat === RepeatRule.None && due.getTime() < Date.now();

  const menuActions: MenuAction[] =
    menu === EditorMenu.Repeat
      ? REPEAT_RULES.map(r => ({
          label: `${repeat === r ? '✓  ' : ''}${REPEAT_LABELS[r]}`,
          onPress: () => mark(setRepeat)(r),
        }))
      : menu === EditorMenu.Folder
      ? [
          {
            label: `${listId === null ? '✓  ' : ''}No folder`,
            onPress: () => mark(setListId)(null),
          },
          ...folders.map(f => ({
            label: `${listId === f.id ? '✓  ' : ''}${f.name}`,
            onPress: () => mark(setListId)(f.id),
          })),
        ]
      : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.flex, { backgroundColor: t.bg }]}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: t.border,
            paddingTop: isMac ? 10 : insets.top + 6,
            paddingLeft: insets.left + 12,
            paddingRight: insets.right + 8,
          },
        ]}
      >
        <Pressable testID="editor-done" accessibilityRole="button" onPress={done} hitSlop={10} style={styles.headerButton}>
          <Text style={[styles.doneText, { color: t.accent }]}>{isMac ? 'Close' : 'Done'}</Text>
        </Pressable>
        <View style={styles.flex} />
        {onToggleExpand ? <HeaderIcon label={expanded ? '⤡' : '⤢'} a11y={expanded ? 'Exit full width' : 'Full width'} onPress={onToggleExpand} color={t.textSecondary} /> : null}
        <HeaderIcon testID="editor-pin" label="📌" a11y={pinned ? 'Unpin note' : 'Pin note'} onPress={() => mark(setPinned)(!pinned)} dim={!pinned} />
        {itemId ? <HeaderIcon testID="editor-delete" label="🗑" a11y="Delete note" onPress={remove} /> : null}
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <TextInput
          testID="note-title"
          placeholder="Title"
          placeholderTextColor={t.muted}
          value={title}
          onChangeText={mark(setTitle)}
          style={[
            styles.title,
            {
              color: t.text,
              textDecorationLine: completed ? 'line-through' : 'none',
            },
          ]}
          autoFocus={!existing}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => bodyRef.current?.focus()}
        />
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
          style={[styles.body, { color: t.text, minHeight: expanded ? 400 : 220 }]}
        />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: t.border,
            backgroundColor: t.pane,
            paddingBottom: insets.bottom + 12,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <View style={styles.reminderRow}>
          <View style={[styles.reminderIcon, { backgroundColor: due ? t.accent : t.input }]}>
            <Text style={styles.reminderGlyph}>{alertType === AlertType.Alarm ? '⏰' : '🔔'}</Text>
          </View>
          <Pressable testID="reminder-date" accessibilityRole="button" style={styles.flex} onPress={() => setPickerOpen(true)}>
            <Text style={[styles.reminderTitle, { color: pastDue ? t.danger : t.text }]}>{due ? formatDue(due.toISOString()) : 'Remind me'}</Text>
            <Text style={[styles.reminderSub, { color: pastDue ? t.danger : t.muted }]}>
              {pastDue ? 'This time has passed. Tap to pick a new one.' : due ? 'Tap to change' : 'Get an alert at a set time'}
            </Text>
          </Pressable>
          <Switch testID="reminder-switch" accessibilityLabel="Remind me" value={!!due} onValueChange={toggleReminder} trackColor={{ true: t.accent, false: t.check }} />
        </View>

        {due || folders.length ? (
          <View style={styles.pills}>
            {due ? (
              <>
                <Pill
                  testID="alert-toggle"
                  label={alertType === AlertType.Alarm ? '⏰ Alarm' : '🔔 Notification'}
                  onPress={() => pickAlert(alertType === AlertType.Alarm ? AlertType.Notification : AlertType.Alarm)}
                />
                <Pill testID="repeat-pill" label={`↻ ${REPEAT_LABELS[repeat]}`} active={repeat !== RepeatRule.None} onPress={() => setMenu(EditorMenu.Repeat)} />
              </>
            ) : null}
            {folders.length ? <Pill testID="folder-pill" label={folder ? `● ${folder.name}` : 'No folder'} color={folder?.color} onPress={() => setMenu(EditorMenu.Folder)} /> : null}
          </View>
        ) : null}

        {due && itemId ? (
          <Pressable
            testID="mark-done"
            accessibilityRole="button"
            onPress={markDone}
            style={({ pressed }) => [
              styles.markDone,
              {
                backgroundColor: completed ? t.input : t.accentSoft,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.markDoneText, { color: completed ? t.textSecondary : t.text }]}>
              {completed ? '↺  Mark as not done' : repeat !== RepeatRule.None ? '✓  Done — move to next' : '✓  Mark as done'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <DateTimeSheet
        visible={pickerOpen}
        value={due}
        onCancel={() => setPickerOpen(false)}
        onConfirm={d => {
          setPickerOpen(false);
          mark(setDue)(d);
          if (completed && idRef.current) {
            toggleComplete(idRef.current);
          }
        }}
      />
      <ActionMenu visible={menu !== null} title={menu === EditorMenu.Repeat ? 'Repeat' : 'Move to folder'} actions={menuActions} onClose={() => setMenu(null)} />
    </KeyboardAvoidingView>
  );
}

function HeaderIcon({ label, a11y, onPress, color, dim, testID }: { label: string; a11y: string; onPress: () => void; color?: string; dim?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.5 : dim ? 0.35 : 1 }]}
    >
      <Text style={[styles.headerIcon, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, onPress, active, color, testID }: { label: string; onPress: () => void; active?: boolean; color?: string; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? t.accentSoft : t.bg,
          borderColor: t.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.pillText, { color: color ?? (active ? t.text : t.textSecondary) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { paddingHorizontal: 8, paddingVertical: 4 },
  headerIcon: { fontSize: 17 },
  doneText: { fontSize: 17, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    paddingVertical: 4,
    letterSpacing: -0.3,
    minHeight: 44,
  },
  body: { fontSize: 17, lineHeight: isMac ? undefined : 25, paddingTop: isMac ? 0 : 6, marginTop: isMac ? 10 : 4 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderGlyph: { fontSize: 16 },
  reminderTitle: { fontSize: 16, fontWeight: '700' },
  reminderSub: { fontSize: 12, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 200,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  markDone: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  markDoneText: { fontSize: 15, fontWeight: '700' },
});
