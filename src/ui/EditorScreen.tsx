import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { parseDateTime, toDateInput, toTimeInput } from '../lib/dates';
import { useLists, useStore, type EditorTarget } from '../store/useStore';
import { REPEAT_RULES, type AlertType, type RepeatRule } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, IconButton } from './common';
import { isMac, useTheme } from './theme';

const QUICK: { label: string; at: () => Date }[] = [
  { label: 'In 1 hour', at: () => new Date(Date.now() + 3600_000) },
  { label: 'Tonight 8 PM', at: () => atTime(new Date(), 20, 0) },
  { label: 'Tomorrow 9 AM', at: () => atTime(addDays(new Date(), 1), 9, 0) },
  { label: 'Next week', at: () => atTime(addDays(new Date(), 7), 9, 0) },
];

export function EditorScreen({ target, onClose, expanded, onToggleExpand }: { target: NonNullable<EditorTarget>; onClose?: () => void; expanded?: boolean; onToggleExpand?: () => void }) {
  const t = useTheme();
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
  const [pinned, setPinned] = useState(existing?.is_pinned ?? false);
  const [alertType, setAlertType] = useState<AlertType>(existing?.alert_type ?? 'notification');
  const initialDue = existing?.due_at ? new Date(existing.due_at) : target.kind === 'new' && target.asReminder ? atTime(addDays(new Date(), 1), 9, 0) : null;
  const [remind, setRemind] = useState(!!initialDue);
  const [date, setDate] = useState(initialDue ? toDateInput(initialDue) : toDateInput(new Date()));
  const [time, setTime] = useState(initialDue ? toTimeInput(initialDue) : '09:00');
  const [repeat, setRepeat] = useState<RepeatRule>(existing?.repeat_rule ?? 'none');
  const [showOptions, setShowOptions] = useState(false);
  const insets = useSafeAreaInsets();

  const [itemId, setItemId] = useState<string | null>(existing?.id ?? null);
  const idRef = useRef<string | null>(existing?.id ?? null);
  const dirty = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedDue = useMemo(() => (remind ? parseDateTime(date, time) : null), [remind, date, time]);
  const dateInvalid = remind && !parsedDue;
  const completed = existing?.is_completed ?? false;

  const payload = useMemo(
    () => ({
      title: title.trim(),
      body,
      list_id: listId,
      is_pinned: pinned,
      alert_type: alertType,
      due_at: parsedDue ? parsedDue.toISOString() : null,
      repeat_rule: parsedDue ? repeat : ('none' as RepeatRule),
    }),
    [title, body, listId, pinned, alertType, parsedDue, repeat],
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
    if (!dirty.current || dateInvalid) {
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
  }, [payload, dateInvalid, save]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  const done = async () => {
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    if (dirty.current && !dateInvalid) {
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
    Alert.alert('Delete Note', 'This note and its reminder will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  };

  const pickAlert = async (next: AlertType) => {
    dirty.current = true;
    setAlertType(next);
    if (next === 'alarm' && nativeAlarms) {
      await requestAlarmPermission();
    }
  };

  const setWhen = (d: Date) => {
    dirty.current = true;
    setDate(toDateInput(d));
    setTime(toTimeInput(d));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { borderBottomColor: t.border, paddingTop: isMac ? 10 : insets.top + 6, paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}>
        {isMac ? <IconButton label="✕" size={14} color={t.muted} onPress={done} /> : <IconButton label="‹ Notes" size={16} onPress={done} />}
        <View style={{ flex: 1 }} />
        {onToggleExpand ? <IconButton label={expanded ? '⤡' : '⤢'} size={15} color={t.textSecondary} onPress={onToggleExpand} /> : null}
        {itemId ? (
          <>
            <IconButton label={pinned ? '📌' : '📍'} size={14} color={t.textSecondary} onPress={() => mark(setPinned)(!pinned)} />
            <IconButton label="🗑" size={14} color={t.danger} onPress={remove} />
          </>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TextInput
          placeholder="Title"
          placeholderTextColor={t.muted}
          value={title}
          onChangeText={mark(setTitle)}
          style={[styles.title, { color: t.text, textDecorationLine: completed ? 'line-through' : 'none' }]}
          autoFocus={!existing}
        />
        <TextInput
          placeholder="Start writing…"
          placeholderTextColor={t.muted}
          value={body}
          onChangeText={mark(setBody)}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          style={[styles.body, { color: t.text, minHeight: expanded ? 420 : 180 }]}
        />
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border, backgroundColor: t.pane, paddingBottom: insets.bottom + 14, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <Pressable onPress={() => setShowOptions(v => !v)} style={styles.footerRow}>
          <Text style={{ fontSize: 15 }}>{alertType === 'alarm' ? '⏰' : '🔔'}</Text>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 }}>
            {remind && parsedDue ? `${alertType === 'alarm' ? 'Alarm' : 'Notification'} · ${parsedDue.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Add reminder'}
          </Text>
          <Switch
            value={remind}
            onValueChange={v => {
              mark(setRemind)(v);
              setShowOptions(v);
            }}
          />
        </Pressable>

        {remind && showOptions ? (
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingTop: 10 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateField value={date} onChange={mark(setDate)} placeholder="YYYY-MM-DD" flex={3} />
              <DateField value={time} onChange={mark(setTime)} placeholder="HH:MM" flex={2} />
            </View>
            {dateInvalid ? <Text style={{ color: t.danger, marginTop: 6, fontSize: 12 }}>Use YYYY-MM-DD and 24-hour HH:MM</Text> : null}

            <View style={styles.chipRow}>
              {QUICK.map(q => (
                <Chip key={q.label} label={q.label} onPress={() => setWhen(q.at())} />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: t.muted }]}>Alert style</Text>
            <View style={styles.chipRow}>
              <Chip label="🔔 Notification" active={alertType === 'notification'} onPress={() => pickAlert('notification')} />
              <Chip label="⏰ Alarm" active={alertType === 'alarm'} onPress={() => pickAlert('alarm')} />
            </View>
            <Text style={{ color: t.muted, fontSize: 11, marginBottom: 4 }}>
              {alertType === 'alarm'
                ? nativeAlarms
                  ? 'Rings until you stop it, even in silent mode.'
                  : 'Rings inside the app until you stop it.'
                : 'A normal banner you can swipe away.'}
            </Text>

            <Text style={[styles.sectionLabel, { color: t.muted }]}>Repeat</Text>
            <View style={styles.chipRow}>
              {REPEAT_RULES.map(r => (
                <Chip key={r} label={r === 'none' ? 'Never' : r[0].toUpperCase() + r.slice(1)} active={repeat === r} onPress={() => mark(setRepeat)(r)} />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: t.muted }]}>Folder</Text>
            <View style={styles.chipRow}>
              <Chip label="Notes" active={listId === null} onPress={() => mark(setListId)(null)} />
              {folders.map(f => (
                <Chip key={f.id} label={f.name} color={f.color} active={listId === f.id} onPress={() => mark(setListId)(f.id)} />
              ))}
            </View>

            {itemId && parsedDue ? (
              <Pressable onPress={() => toggleComplete(itemId)} style={[styles.completeButton, { borderColor: t.border }]}>
                <Text style={{ color: completed ? t.textSecondary : t.accent, fontWeight: '600', fontSize: 14 }}>{completed ? 'Mark as not done' : 'Mark as done'}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function DateField({ value, onChange, placeholder, flex }: { value: string; onChange: (v: string) => void; placeholder: string; flex: number }) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      autoCapitalize="none"
      style={{ flex, backgroundColor: t.card, color: t.text, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 }}
    />
  );
}

function atTime(d: Date, h: number, m: number): Date {
  const x = new Date(d.getTime());
  x.setHours(h, m, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: '700', paddingVertical: 6 },
  body: { fontSize: 16, lineHeight: 24, paddingVertical: 6 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  completeButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
});
