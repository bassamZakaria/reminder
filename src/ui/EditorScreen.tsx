import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { parseDateTime, toDateInput, toTimeInput } from '../lib/dates';
import { useLists, useStore, type EditorTarget } from '../store/useStore';
import { REPEAT_RULES, type Priority, type RepeatRule } from '../types';
import { PRIORITIES } from '../lib/priority';
import { Chip, IconButton, Input } from './common';
import { isMac, useTheme } from './theme';

const QUICK: { label: string; at: () => Date }[] = [
  { label: 'In 1 hour', at: () => new Date(Date.now() + 3600_000) },
  { label: 'Tonight 8pm', at: () => atTime(new Date(), 20, 0) },
  { label: 'Tomorrow 9am', at: () => atTime(addDays(new Date(), 1), 9, 0) },
  { label: 'Next week', at: () => atTime(addDays(new Date(), 7), 9, 0) },
];

export function EditorScreen({ target }: { target: NonNullable<EditorTarget> }) {
  const t = useTheme();
  const existing = useStore(s => (target.kind === 'existing' ? s.items[target.id] : undefined));
  const lists = useLists();
  const createItem = useStore(s => s.createItem);
  const updateItem = useStore(s => s.updateItem);
  const deleteItem = useStore(s => s.deleteItem);
  const closeEditor = useStore(s => s.closeEditor);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [listId, setListId] = useState<string | null>(existing?.list_id ?? (target.kind === 'new' ? target.listId : null));
  const [pinned, setPinned] = useState(existing?.is_pinned ?? false);
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 0);
  const initialDue = existing?.due_at ? new Date(existing.due_at) : target.kind === 'new' && target.dueAt ? new Date(target.dueAt) : target.kind === 'new' && target.asReminder ? atTime(addDays(new Date(), 1), 9, 0) : null;
  const [remind, setRemind] = useState(!!initialDue);
  const [date, setDate] = useState(initialDue ? toDateInput(initialDue) : toDateInput(new Date()));
  const [time, setTime] = useState(initialDue ? toTimeInput(initialDue) : '09:00');
  const [repeat, setRepeat] = useState<RepeatRule>(existing?.repeat_rule ?? 'none');
  const [itemId, setItemId] = useState<string | null>(existing?.id ?? null);
  const idRef = useRef<string | null>(existing?.id ?? null);
  const dirty = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedDue = useMemo(() => (remind ? parseDateTime(date, time) : null), [remind, date, time]);
  const dateInvalid = remind && !parsedDue;

  const payload = useMemo(
    () => ({
      title: title.trim(),
      body,
      list_id: listId,
      is_pinned: pinned,
      priority,
      due_at: parsedDue ? parsedDue.toISOString() : null,
      repeat_rule: parsedDue ? repeat : ('none' as RepeatRule),
    }),
    [title, body, listId, pinned, priority, parsedDue, repeat],
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
    closeEditor();
  };

  const remove = () => {
    if (!idRef.current) {
      closeEditor();
      return;
    }
    const id = idRef.current;
    Alert.alert('Delete', 'Delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  };

  const toggleComplete = useStore(s => s.toggleComplete);
  const completed = existing?.is_completed ?? false;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        {isMac ? (
          <IconButton label="✕" size={15} color={t.muted} onPress={done} />
        ) : (
          <IconButton label="Done" size={16} onPress={done} />
        )}
        <View style={{ flex: 1 }} />
        {itemId ? (
          <>
            <IconButton label={completed ? 'Reopen' : 'Complete'} size={13} color={t.textSecondary} onPress={() => toggleComplete(itemId)} />
            <IconButton label="Delete" size={13} color={t.danger} onPress={remove} />
          </>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => itemId && toggleComplete(itemId)}
            style={[styles.check, { borderColor: priority ? PRIORITIES.find(p => p.value === priority)!.color : t.check, backgroundColor: completed ? t.check : 'transparent' }]}>
            {completed ? <Text style={styles.tick}>✓</Text> : null}
          </Pressable>
          <TextInput
            placeholder="What needs to be done?"
            placeholderTextColor={t.muted}
            value={title}
            onChangeText={mark(setTitle)}
            style={[styles.title, { color: t.text, textDecorationLine: completed ? 'line-through' : 'none' }]}
            autoFocus={!existing}
          />
        </View>
        <TextInput
          placeholder="Notes"
          placeholderTextColor={t.muted}
          value={body}
          onChangeText={mark(setBody)}
          multiline
          textAlignVertical="top"
          style={[styles.body, { color: t.text }]}
        />

        <View style={[styles.section, { backgroundColor: t.pane }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: t.text }]}>⏰ Date & alarm</Text>
            <Switch value={remind} onValueChange={mark(setRemind)} />
          </View>
          {remind ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Input value={date} onChangeText={mark(setDate)} placeholder="YYYY-MM-DD" style={{ flex: 3, backgroundColor: t.card }} autoCapitalize="none" />
                <Input value={time} onChangeText={mark(setTime)} placeholder="HH:MM" style={{ flex: 2, backgroundColor: t.card }} autoCapitalize="none" />
              </View>
              {dateInvalid ? <Text style={{ color: t.danger, marginTop: 6, fontSize: 12 }}>Use YYYY-MM-DD and 24h HH:MM</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                {QUICK.map(q => (
                  <Chip
                    key={q.label}
                    label={q.label}
                    onPress={() => {
                      const d = q.at();
                      dirty.current = true;
                      setDate(toDateInput(d));
                      setTime(toTimeInput(d));
                    }}
                  />
                ))}
              </View>
              <Text style={[styles.sublabel, { color: t.muted }]}>Repeat</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {REPEAT_RULES.map(r => (
                  <Chip key={r} label={r === 'none' ? 'Never' : r[0].toUpperCase() + r.slice(1)} active={repeat === r} onPress={() => mark(setRepeat)(r)} />
                ))}
              </View>
            </>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: t.pane }]}>
          <Text style={[styles.sublabel, { color: t.muted, marginTop: 0 }]}>Priority</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {PRIORITIES.map(p => (
              <Chip key={p.value} label={`⚑ ${p.label}`} color={p.color} active={priority === p.value} onPress={() => mark(setPriority)(p.value)} />
            ))}
          </View>
          <Text style={[styles.sublabel, { color: t.muted }]}>List</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Inbox" active={listId === null} onPress={() => mark(setListId)(null)} />
            {lists.map(l => (
              <Chip key={l.id} label={l.name} color={l.color} active={listId === l.id} onPress={() => mark(setListId)(l.id)} />
            ))}
          </View>
          <View style={[styles.switchRow, { marginTop: 8 }]}>
            <Text style={[styles.label, { color: t.text }]}>📌 Pin in Notes</Text>
            <Switch value={pinned} onValueChange={mark(setPinned)} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', paddingVertical: 8 },
  body: { fontSize: 15, lineHeight: 22, minHeight: 120, paddingVertical: 8, paddingLeft: 30 },
  section: { borderRadius: 12, padding: 14, marginTop: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 15, fontWeight: '600' },
  sublabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
});
