import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupNotes, groupReminders, SectionKey, type Section } from '../lib/grouping';
import { firstLine } from '../lib/schedule';
import { EditorKind, useItems, useStore } from '../store/useStore';
import { ListFilter, ViewKind, type Item } from '../types';
import { ActionMenu, Empty, ErrorBanner, IconButton, Input, type MenuAction } from './common';
import { NoteRow } from './NoteRow';
import { isMac, useTheme } from './theme';

const FILTER_LABELS: Record<ListFilter, string> = {
  [ListFilter.All]: 'Notes',
  [ListFilter.Reminders]: 'Reminders',
  [ListFilter.Done]: 'Done',
};

const EMPTY: Record<ListFilter, { icon: string; title: string; hint: string }> = {
  [ListFilter.All]: { icon: '🗒️', title: 'No notes yet', hint: isMac ? 'Press ＋ to write your first note.' : 'Tap ＋ to write your first note.' },
  [ListFilter.Reminders]: { icon: '⏰', title: 'Nothing scheduled', hint: 'Open a note and switch on “Remind me” to get an alert.' },
  [ListFilter.Done]: { icon: '✓', title: 'Nothing done yet', hint: 'Tick the circle on a reminder to complete it.' },
};

export function NoteList({ headerLeft }: { headerLeft?: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const items = useItems();
  const view = useStore(s => s.view);
  const folders = useStore(s => s.lists);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const openEditor = useStore(s => s.openEditor);
  const refreshing = useStore(s => s.refreshing);
  const refresh = useStore(s => s.refresh);
  const togglePin = useStore(s => s.togglePin);
  const toggleComplete = useStore(s => s.toggleComplete);
  const deleteItem = useStore(s => s.deleteItem);
  const snooze = useStore(s => s.snooze);
  const [filter, setFilter] = useState<ListFilter>(ListFilter.All);
  const [menuItem, setMenuItem] = useState<Item | null>(null);

  const folderId = view.kind === ViewKind.Folder ? view.id : null;
  const folder = folderId ? folders[folderId] : undefined;
  const title = folder?.name ?? 'All Notes';

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inFolder = folderId ? items.filter(i => i.list_id === folderId) : items;
    return q ? inFolder.filter(i => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)) : inFolder;
  }, [items, folderId, search]);

  const counts = useMemo(
    () => ({
      [ListFilter.All]: scoped.filter(i => !i.is_completed).length,
      [ListFilter.Reminders]: scoped.filter(i => i.due_at && !i.is_completed).length,
      [ListFilter.Done]: scoped.filter(i => i.is_completed).length,
    }),
    [scoped],
  );

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    if (filter === ListFilter.Reminders) {
      return groupReminders(scoped.filter(i => i.due_at && !i.is_completed), now, false);
    }
    if (filter === ListFilter.Done) {
      return groupReminders(scoped.filter(i => i.is_completed), now, true);
    }
    return groupNotes(scoped.filter(i => !i.is_completed), now);
  }, [scoped, filter]);

  const newNote = () => openEditor({ kind: EditorKind.New, listId: folderId, nonce: Date.now() });

  const onLongPress = useCallback((item: Item) => setMenuItem(item), []);

  const menuActions: MenuAction[] = menuItem
    ? [
        { label: menuItem.is_pinned ? 'Unpin' : 'Pin to top', icon: '📌', onPress: () => togglePin(menuItem.id) },
        ...(menuItem.due_at
          ? [
              { label: menuItem.is_completed ? 'Mark as not done' : 'Mark as done', icon: '✓', onPress: () => toggleComplete(menuItem.id) },
              ...(!menuItem.is_completed ? [{ label: 'Snooze 1 hour', icon: '💤', onPress: () => snooze(menuItem.id, 60) }] : []),
            ]
          : []),
        { label: 'Delete', icon: '🗑', destructive: true, onPress: () => deleteItem(menuItem.id) },
      ]
    : [];

  const empty = search ? { icon: '🔍', title: 'No results', hint: `Nothing matches “${search.trim()}”.` } : EMPTY[filter];

  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { paddingTop: isMac ? 14 : insets.top + 6, paddingLeft: insets.left + 16, paddingRight: insets.right + 12 }]}>
        {headerLeft}
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {isMac ? <IconButton testID="new-note" label="＋" size={22} accessibilityLabel="New note" onPress={newNote} /> : null}
      </View>

      <View style={{ paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }}>
        <Input testID="search" placeholder="Search" value={search} onChangeText={setSearch} clearButtonMode="while-editing" autoCorrect={false} />
        <View style={[styles.segment, { backgroundColor: t.pane }]} accessibilityRole="tablist">
          {Object.values(ListFilter).map(f => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                testID={`filter-${f}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f)}
                style={[styles.segmentItem, active && [styles.segmentActive, { backgroundColor: t.bg }]]}>
                <Text style={[styles.segmentText, { color: active ? t.text : t.muted, fontWeight: active ? '700' : '500' }]}>
                  {FILTER_LABELS[f]}
                  {counts[f] ? <Text style={{ color: t.muted, fontWeight: '500' }}>{`  ${counts[f]}`}</Text> : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ErrorBanner />

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <NoteRow item={item} showFolder={!folderId} onLongPress={onLongPress} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: section.key === SectionKey.Overdue ? t.danger : t.muted, backgroundColor: t.bg }]}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : { paddingBottom: insets.bottom + 110 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={isMac ? undefined : <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.muted} />}
        ListEmptyComponent={<Empty icon={empty.icon} title={empty.title} hint={empty.hint} />}
      />

      {!isMac ? (
        <Pressable
          testID="new-note"
          accessibilityRole="button"
          accessibilityLabel="New note"
          onPress={newNote}
          style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, bottom: insets.bottom + 22, right: insets.right + 20, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Text style={styles.fabIcon}>＋</Text>
        </Pressable>
      ) : null}

      <ActionMenu visible={!!menuItem} title={menuItem ? menuItem.title || firstLine(menuItem.body) || 'Note' : undefined} actions={menuActions} onClose={() => setMenuItem(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, marginTop: 10, marginBottom: 6 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segmentActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 13 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 3, textTransform: 'uppercase' },
  emptyContainer: { flexGrow: 1 },
  fab: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  fabIcon: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '400' },
});
