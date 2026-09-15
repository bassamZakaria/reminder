import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { groupNotes, groupReminders, type Section } from '../lib/grouping';
import { useItems, useStore } from '../store/useStore';
import type { Item } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Empty, IconButton, Input } from './common';
import { NoteRow } from './NoteRow';
import { isMac, useTheme } from './theme';

export function NoteList({ headerLeft }: { headerLeft?: React.ReactNode }) {
  const t = useTheme();
  const items = useItems();
  const view = useStore(s => s.view);
  const folders = useStore(s => s.lists);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const openEditor = useStore(s => s.openEditor);
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const insets = useSafeAreaInsets();

  const folder = view.kind === 'folder' ? folders[view.id] : undefined;
  const title = view.kind === 'reminders' ? 'Reminders' : view.kind === 'folder' ? folder?.name ?? 'Folder' : 'All Notes';

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    let scoped: Item[];
    if (q) {
      scoped = items.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q));
    } else if (view.kind === 'reminders') {
      scoped = items.filter(i => i.due_at);
    } else if (view.kind === 'folder') {
      scoped = items.filter(i => i.list_id === view.id);
    } else {
      scoped = items;
    }
    const grouped = view.kind === 'reminders' && !q ? groupReminders(scoped, now, showCompleted) : groupNotes(scoped, now);
    return grouped.map(s => (collapsed[s.key] ? { ...s, data: [] } : s));
  }, [items, view, search, showCompleted, collapsed]);

  const newNote = () => openEditor({ kind: 'new', listId: view.kind === 'folder' ? view.id : null, asReminder: view.kind === 'reminders' });
  const count = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { paddingTop: isMac ? 14 : insets.top + 8, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        {headerLeft}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
            {title}
          </Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>{count === 1 ? '1 note' : `${count} notes`}</Text>
        </View>
        {view.kind === 'reminders' ? (
          <IconButton label={showCompleted ? 'Hide done' : 'Show done'} size={12} color={t.textSecondary} onPress={() => setShowCompleted(v => !v)} />
        ) : null}
        <IconButton label="✎" size={20} onPress={newNote} />
      </View>
      <View style={{ paddingLeft: insets.left + 12, paddingRight: insets.right + 12, paddingBottom: 8 }}>
        <Input placeholder="Search" value={search} onChangeText={setSearch} clearButtonMode="while-editing" />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <NoteRow item={item} showFolder={view.kind !== 'folder'} />}
        renderSectionHeader={({ section }) => (
          <Pressable onPress={() => setCollapsed(c => ({ ...c, [section.key]: !c[section.key] }))} style={[styles.sectionHeader, { backgroundColor: t.bg }]}>
            <Text style={{ color: t.muted, fontSize: 9, marginRight: 6 }}>{collapsed[section.key] ? '▶' : '▼'}</Text>
            <Text style={[styles.sectionTitle, { color: section.key === 'overdue' ? t.danger : t.textSecondary }]}>{section.title}</Text>
          </Pressable>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? { flex: 1 } : { paddingBottom: 90 }}
        ListEmptyComponent={
          <Empty
            icon={view.kind === 'reminders' ? '⏰' : '🗒️'}
            title={search ? 'No results' : view.kind === 'reminders' ? 'No reminders' : 'No notes yet'}
            hint={search ? undefined : 'Tap ✎ to write a note. Add a reminder to it whenever you need one.'}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
});
