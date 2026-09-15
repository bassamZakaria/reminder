import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupNotes, groupReminders, type Section } from '../lib/grouping';
import { useItems, useStore } from '../store/useStore';
import type { Item } from '../types';
import { Empty, Input } from './common';
import { NoteRow } from './NoteRow';
import { isMac, useTheme } from './theme';

type Filter = 'all' | 'reminders' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'done', label: 'Done' },
];

export function NoteList({ headerLeft }: { headerLeft?: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const items = useItems();
  const view = useStore(s => s.view);
  const folders = useStore(s => s.lists);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const openEditor = useStore(s => s.openEditor);
  const [filter, setFilter] = useState<Filter>('all');

  const folder = view.kind === 'folder' ? folders[view.id] : undefined;
  const title = folder?.name ?? 'Notes';

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    let scoped: Item[] = view.kind === 'folder' ? items.filter(i => i.list_id === view.id) : items;
    if (q) {
      scoped = scoped.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
    }
    if (filter === 'reminders') {
      return groupReminders(scoped.filter(i => i.due_at && !i.is_completed), now, false);
    }
    if (filter === 'done') {
      return groupReminders(scoped.filter(i => i.is_completed), now, true);
    }
    return groupNotes(scoped.filter(i => !i.is_completed), now);
  }, [items, view, search, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { paddingTop: isMac ? 14 : insets.top + 6, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        {headerLeft}
        <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
          {title}
        </Text>
      </View>

      <View style={{ paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }}>
        <Input placeholder="Search" value={search} onChangeText={setSearch} clearButtonMode="while-editing" />
        <View style={[styles.segment, { backgroundColor: t.pane }]}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.segmentItem, active && { backgroundColor: t.bg }]}>
                <Text style={{ color: active ? t.text : t.muted, fontSize: 13, fontWeight: active ? '700' : '500' }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <NoteRow item={item} showFolder={view.kind !== 'folder'} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: section.key === 'overdue' ? t.danger : t.muted, backgroundColor: t.bg }]}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Empty
            icon={filter === 'reminders' ? '⏰' : '🗒️'}
            title={search ? 'Nothing found' : filter === 'reminders' ? 'No reminders' : filter === 'done' ? 'Nothing done yet' : 'No notes yet'}
            hint={search ? undefined : 'Tap the button below to write one.'}
          />
        }
      />

      <Pressable
        onPress={() => openEditor({ kind: 'new', listId: view.kind === 'folder' ? view.id : null, asReminder: false })}
        style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, bottom: insets.bottom + 22, right: insets.right + 20, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  title: { flex: 1, fontSize: 26, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 3, marginTop: 10, marginBottom: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 7 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4, textTransform: 'uppercase' },
  fab: { position: 'absolute', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabIcon: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});
