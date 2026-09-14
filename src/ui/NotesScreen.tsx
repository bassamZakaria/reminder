import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { formatRelative } from '../lib/dates';
import { selectItems, useStore } from '../store/useStore';
import type { Item } from '../types';
import { Empty, Header, IconButton, Input } from './common';
import { isMac, useTheme } from './theme';

export function NotesScreen() {
  const t = useTheme();
  const items = useStore(selectItems);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const openEditor = useStore(s => s.openEditor);
  const { width } = useWindowDimensions();
  const columns = isMac ? Math.max(2, Math.floor((width - 220) / 260)) : 2;

  const notes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(i => !q || i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
  }, [items, search]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Notes" right={<IconButton label="＋" onPress={() => openEditor({ kind: 'new', listId: null, asReminder: false })} />} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Input placeholder="Search" value={search} onChangeText={setSearch} clearButtonMode="while-editing" />
      </View>
      <FlatList
        key={columns}
        data={notes}
        numColumns={columns}
        keyExtractor={i => i.id}
        columnWrapperStyle={{ paddingHorizontal: 12 }}
        contentContainerStyle={notes.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        renderItem={({ item }) => <NoteCard item={item} />}
        ListEmptyComponent={<Empty title="No notes" hint="Tap ＋ to write your first note." />}
      />
    </View>
  );
}

function NoteCard({ item }: { item: Item }) {
  const t = useTheme();
  const list = useStore(s => (item.list_id ? s.lists[item.list_id] : undefined));
  const openEditor = useStore(s => s.openEditor);
  return (
    <Pressable onPress={() => openEditor({ kind: 'existing', id: item.id })} style={({ pressed }) => [styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={styles.cardTop}>
        <Text numberOfLines={1} style={[styles.cardTitle, { color: t.text, flex: 1 }]}>
          {item.title || 'Untitled'}
        </Text>
        {item.is_pinned ? <Text style={{ color: t.accent }}>📌</Text> : null}
      </View>
      <Text numberOfLines={6} style={{ color: t.muted, fontSize: 13, lineHeight: 18, minHeight: 36 }}>
        {item.body || ' '}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={{ color: t.muted, fontSize: 11 }}>{formatRelative(item.updated_at)}</Text>
        {item.due_at && !item.is_completed ? <Text style={{ color: t.accent, fontSize: 11 }}>⏰ {formatRelative(item.due_at)}</Text> : null}
        {list ? <Text style={{ color: list.color, fontSize: 11 }}>● {list.name}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 4, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, minHeight: 120 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 },
});
