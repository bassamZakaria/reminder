import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { parseDateTime, toDateInput, toTimeInput } from '../lib/dates';
import { selectLists, useStore, type EditorTarget } from '../store/useStore';
import { REPEAT_RULES, type RepeatRule } from '../types';
import { Chip, Header, IconButton, Input } from './common';
import { useTheme } from './theme';

const QUICK: { label: string; at: () => Date }[] = [
  { label: 'In 1 hour', at: () => new Date(Date.now() + 3600_000) },
  { label: 'Tonight 8pm', at: () => atTime(new Date(), 20, 0) },
  { label: 'Tomorrow 9am', at: () => atTime(addDays(new Date(), 1), 9, 0) },
  { label: 'Next week', at: () => atTime(addDays(new Date(), 7), 9, 0) },
];

export function EditorScreen({ target }: { target: NonNullable<EditorTarget> }) {
  const t = useTheme();
  const existing = useStore(s => (target.kind === 'existing' ? s.items[target.id] : undefined));
  const lists = useStore(selectLists);
  const createItem = useStore(s => s.createItem);
  const updateItem = useStore(s => s.updateItem);
  const deleteItem = useStore(s => s.deleteItem);
  const closeEditor = useStore(s => s.closeEditor);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [listId, setListId] = useState<string | null>(existing?.list_id ?? (target.kind === 'new' ? target.listId : null));
  const [pinned, setPinned] = useState(existing?.is_pinned ?? false);
  const initialDue = existing?.due_at ? new Date(existing.due_at) : target.kind === 'new' && target.asReminder ? atTime(addDays(new Date(), 1), 9, 0) : null;
  const [remind, setRemind] = useState(!!initialDue);
  const [date, setDate] = useState(initialDue ? toDateInput(initialDue) : toDateInput(new Date()));
  const [time, setTime] = useState(initialDue ? toTimeInput(initialDue) : '09:00');
  const [repeat, setRepeat] = useState<RepeatRule>(existing?.repeat_rule ?? 'none');
  const idRef = useRef<string | null>(existing?.id ?? null);
  const dirty = useRef(false);

  const parsedDue = useMemo(() => (remind ? parseDateTime(date, time) : null), [remind, date, time]);
  const dateInvalid = remind && !parsedDue;

  const payload = useMemo(
    () => ({
      title: title.trim(),
      body,
      list_id: listId,
      is_pinned: pinned,
      due_at: parsedDue ? parsedDue.toISOString() : null,
      repeat_rule: parsedDue ? repeat : ('none' as RepeatRule),
    }),
    [title, body, listId, pinned, parsedDue, repeat],
  );

  useEffect(() => {
    if (!dirty.current || dateInvalid) {
      return;
    }
    const handle = setTimeout(async () => {
      if (!payload.title && !payload.body) {
        return;
      }
      if (idRef.current) {
        await updateItem(idRef.current, payload);
      } else {
        const created = await createItem(payload);
        if (created) {
          idRef.current = created.id;
        }
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [payload, dateInvalid, createItem, updateItem]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  const done = async () => {
    if (dirty.current && !dateInvalid && (payload.title || payload.body)) {
      if (idRef.current) {
        await updateItem(idRef.current, payload);
      } else {
        await createItem(payload);
      }
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <Header
        title={existing ? 'Edit' : 'New'}
        left={<IconButton label="Done" onPress={done} />}
        right={idRef.current ? <IconButton label="Delete" color={t.danger} onPress={remove} /> : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <TextInput
          placeholder="Title"
          placeholderTextColor={t.muted}
          value={title}
          onChangeText={mark(setTitle)}
          style={[styles.title, { color: t.text }]}
          autoFocus={!existing}
        />
        <TextInput
          placeholder="Write your note…"
          placeholderTextColor={t.muted}
          value={body}
          onChangeText={mark(setBody)}
          multiline
          textAlignVertical="top"
          style={[styles.body, { color: t.text }]}
        />

        <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: t.text }]}>⏰ Remind me</Text>
            <Switch value={remind} onValueChange={mark(setRemind)} />
          </View>
          {remind ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Input value={date} onChangeText={mark(setDate)} placeholder="YYYY-MM-DD" style={{ flex: 3 }} autoCapitalize="none" />
                <Input value={time} onChangeText={mark(setTime)} placeholder="HH:MM" style={{ flex: 2 }} autoCapitalize="none" />
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

        <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: t.text }]}>📌 Pin note</Text>
            <Switch value={pinned} onValueChange={mark(setPinned)} />
          </View>
          <Text style={[styles.sublabel, { color: t.muted }]}>List</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="None" active={listId === null} onPress={() => mark(setListId)(null)} />
            {lists.map(l => (
              <Chip key={l.id} label={l.name} color={l.color} active={listId === l.id} onPress={() => mark(setListId)(l.id)} />
            ))}
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
  title: { fontSize: 24, fontWeight: '700', paddingVertical: 8 },
  body: { fontSize: 17, lineHeight: 24, minHeight: 160, paddingVertical: 8 },
  section: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginTop: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 16, fontWeight: '600' },
  sublabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
});
