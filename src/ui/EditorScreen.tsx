import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDue } from '../lib/dates';
import { useLists, useStore, type EditorTarget } from '../store/useStore';
import { REPEAT_RULES, type AlertType, type RepeatRule } from '../types';
import { DateTimeSheet } from './DateTimeSheet';
import { isMac, useTheme } from './theme';

export function EditorScreen({ target, onClose, expanded, onToggleExpand }: { target: NonNullable<EditorTarget>; onClose?: () => void; expanded?: boolean; onToggleExpand?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const existing = useStore(s => (target.kind === 'existing' ? s.items[target.id] : undefined));
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
  const [listId, setListId] = useState<string | null>(existing?.list_id ?? (target.kind === 'new' ? target.listId : null));
  const [alertType, setAlertType] = useState<AlertType>(existing?.alert_type ?? 'notification');
  const [due, setDue] = useState<Date | null>(existing?.due_at ? new Date(existing.due_at) : null);
  const [repeat, setRepeat] = useState<RepeatRule>(existing?.repeat_rule ?? 'none');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const [itemId, setItemId] = useState<string | null>(existing?.id ?? null);
  const idRef = useRef<string | null>(existing?.id ?? null);
  const dirty = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = existing?.is_completed ?? false;

  const payload = useMemo(
    () => ({
      title: title.trim(),
      body,
      list_id: listId,
      is_pinned: existing?.is_pinned ?? false,
      alert_type: alertType,
      due_at: due ? due.toISOString() : null,
      repeat_rule: due ? repeat : ('none' as RepeatRule),
    }),
    [title, body, listId, alertType, due, repeat, existing?.is_pinned],
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
      if (!data.title && !data.body) {
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
    debounce.current = setTimeout(() => {
      debounce.current = null;
      save();
    }, 500);
    return () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
        debounce.current = null;
      }
    };
  }, [payload, save]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  const done = async () => {
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    if (dirty.current) {
      await save();
    }
    (onClose ?? closeEditor)();
  };

  const remove = () => {
    if (!idRef.current) {
      (onClose ?? closeEditor)();
      return;
    }
    const id = idRef.current;
    Alert.alert('Delete note', 'This note and its reminder will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  };

  const pickAlert = async (next: AlertType) => {
    mark(setAlertType)(next);
    if (next === 'alarm' && nativeAlarms) {
      await requestAlarmPermission();
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { borderBottomColor: t.border, paddingTop: isMac ? 10 : insets.top + 6, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
        <Pressable onPress={done} hitSlop={8}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>{isMac ? 'Close' : 'Done'}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {onToggleExpand ? (
          <Pressable onPress={onToggleExpand} hitSlop={8} style={styles.headerButton}>
            <Text style={{ color: t.textSecondary, fontSize: 15 }}>{expanded ? '⤡' : '⤢'}</Text>
          </Pressable>
        ) : null}
        {itemId ? (
          <Pressable onPress={remove} hitSlop={8} style={styles.headerButton}>
            <Text style={{ color: t.danger, fontSize: 15 }}>🗑</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <TextInput
          placeholder="Title"
          placeholderTextColor={t.muted}
          value={title}
          onChangeText={mark(setTitle)}
          style={[styles.title, { color: t.text, textDecorationLine: completed ? 'line-through' : 'none' }]}
          autoFocus={!existing}
          returnKeyType="next"
        />
        <TextInput
          placeholder="Write your note…"
          placeholderTextColor={t.muted}
          value={body}
          onChangeText={mark(setBody)}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          style={[styles.body, { color: t.text, minHeight: expanded ? 400 : 220 }]}
        />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.pane, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <Pressable onPress={() => (due ? setMoreOpen(v => !v) : setPickerOpen(true))} style={styles.reminderRow}>
          <Text style={{ fontSize: 16 }}>{alertType === 'alarm' ? '⏰' : '🔔'}</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{due ? formatDue(due.toISOString()) : 'Add reminder'}</Text>
            {due ? (
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 1 }}>
                {alertType === 'alarm' ? 'Alarm' : 'Notification'}
                {repeat !== 'none' ? ` · repeats ${repeat}` : ''}
              </Text>
            ) : null}
          </View>
          <Switch
            value={!!due}
            onValueChange={on => {
              if (on) {
                setPickerOpen(true);
              } else {
                mark(setDue)(null);
                setMoreOpen(false);
              }
            }}
          />
        </Pressable>

        {due && moreOpen ? (
          <View style={styles.options}>
            <Pressable onPress={() => setPickerOpen(true)} style={[styles.optionButton, { backgroundColor: t.bg }]}>
              <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>Change date & time</Text>
            </Pressable>

            <Text style={[styles.optionLabel, { color: t.muted }]}>Alert</Text>
            <View style={styles.chipRow}>
              <Choice label="🔔 Notification" active={alertType === 'notification'} onPress={() => pickAlert('notification')} />
              <Choice label="⏰ Alarm" active={alertType === 'alarm'} onPress={() => pickAlert('alarm')} />
            </View>

            <Text style={[styles.optionLabel, { color: t.muted }]}>Repeat</Text>
            <View style={styles.chipRow}>
              {REPEAT_RULES.map(r => (
                <Choice key={r} label={r === 'none' ? 'Never' : r[0].toUpperCase() + r.slice(1)} active={repeat === r} onPress={() => mark(setRepeat)(r)} />
              ))}
            </View>

            {folders.length ? (
              <>
                <Text style={[styles.optionLabel, { color: t.muted }]}>Folder</Text>
                <View style={styles.chipRow}>
                  <Choice label="None" active={listId === null} onPress={() => mark(setListId)(null)} />
                  {folders.map(f => (
                    <Choice key={f.id} label={f.name} active={listId === f.id} onPress={() => mark(setListId)(f.id)} />
                  ))}
                </View>
              </>
            ) : null}

            {itemId ? (
              <Pressable onPress={() => toggleComplete(itemId)} style={[styles.optionButton, { backgroundColor: t.bg, marginTop: 12 }]}>
                <Text style={{ color: completed ? t.textSecondary : t.accent, fontSize: 14, fontWeight: '600' }}>{completed ? 'Mark as not done' : 'Mark as done'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <DateTimeSheet
        visible={pickerOpen}
        value={due}
        onCancel={() => setPickerOpen(false)}
        onConfirm={d => {
          setPickerOpen(false);
          mark(setDue)(d);
          setMoreOpen(true);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: active ? t.accent : t.bg, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ color: active ? '#fff' : t.textSecondary, fontSize: 13, fontWeight: active ? '600' : '500' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { paddingHorizontal: 8, paddingVertical: 2 },
  title: { fontSize: 24, fontWeight: '700', paddingVertical: 4 },
  body: { fontSize: 16, lineHeight: 24, paddingTop: 4 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  reminderRow: { flexDirection: 'row', alignItems: 'center' },
  options: { marginTop: 12 },
  optionButton: { borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  optionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
});
