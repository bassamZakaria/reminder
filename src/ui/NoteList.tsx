import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupNotes, remindersByNote, SectionKey, type Section } from '../lib/grouping';
import { PremiumFeature } from '../lib/premium';
import { noteHeadline } from '../lib/schedule';
import { EditorKind, useLists, useNotes, useReminders, useStore } from '../store/useStore';
import { LIST_COLORS, ViewKind, type List, type Note } from '../types';
import { ActionMenu, Empty, ErrorBanner, IconButton, Input, PromptSheet, type MenuAction } from './common';
import { NoteRow } from './NoteRow';
import { useIsWide } from './layout';
import { useTheme } from './theme';

const NO_REMINDERS: never[] = [];

export function NoteList({ bottomInset }: { bottomInset: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const notes = useNotes();
  const reminders = useReminders();
  const view = useStore(s => s.view);
  const folders = useStore(s => s.lists);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const openEditor = useStore(s => s.openEditor);
  const refreshing = useStore(s => s.refreshing);
  const refresh = useStore(s => s.refresh);
  const togglePin = useStore(s => s.togglePin);
  const deleteNote = useStore(s => s.deleteNote);
  const [menuNote, setMenuNote] = useState<Note | null>(null);

  const folderId = view.kind === ViewKind.Folder ? view.id : null;
  const folder = folderId ? folders[folderId] : undefined;
  const byNote = useMemo(() => remindersByNote(reminders), [reminders]);

  const sections = useMemo<Section<Note>[]>(() => {
    const q = search.trim().toLowerCase();
    let scoped = folderId ? notes.filter(n => n.list_id === folderId) : notes;
    if (q) {
      scoped = scoped.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }
    return groupNotes(scoped, new Date());
  }, [notes, folderId, search]);

  const count = sections.reduce((sum, s) => sum + s.data.length, 0);
  const newNote = () => openEditor({ kind: EditorKind.New, listId: folderId, nonce: Date.now() });
  const onLongPress = useCallback((n: Note) => setMenuNote(n), []);

  const menuActions: MenuAction[] = menuNote
    ? [
        { label: 'Add reminder', icon: '⏰', onPress: () => openEditor({ kind: EditorKind.Existing, id: menuNote.id, addReminder: true }) },
        { label: menuNote.is_pinned ? 'Unpin' : 'Pin to top', icon: '📌', onPress: () => togglePin(menuNote.id) },
        { label: 'Delete note', icon: '🗑', destructive: true, onPress: () => deleteNote(menuNote.id) },
      ]
    : [];

  const empty = search
    ? { icon: '🔍', title: 'No results', hint: `Nothing matches “${search.trim()}”.` }
    : { icon: '🗒️', title: folder ? `No notes in ${folder.name}` : 'No notes yet', hint: wide ? 'Press ＋ to write a note.' : 'Tap ＋ to write a note.' };

  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { paddingTop: wide ? 14 : insets.top + 6, paddingLeft: insets.left + 16, paddingRight: insets.right + 12 }]}>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]} accessibilityRole="header">
            {folder?.name ?? 'Notes'}
          </Text>
          <Text style={[styles.subtitle, { color: t.muted }]}>
            {count} {count === 1 ? 'note' : 'notes'}
          </Text>
        </View>
        {wide ? <IconButton testID="new-note" label="＋" size={22} accessibilityLabel="New note" onPress={newNote} /> : null}
      </View>

      <View style={[styles.controls, { paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
        <Input testID="search" placeholder="Search notes" value={search} onChangeText={setSearch} clearButtonMode="while-editing" autoCorrect={false} style={styles.search} />
      </View>
      {!wide ? <FolderChips /> : null}

      <ErrorBanner />

      <SectionList
        sections={sections}
        keyExtractor={n => n.id}
        renderItem={({ item }) => <NoteRow note={item} wide={wide} reminders={byNote[item.id] ?? NO_REMINDERS} showFolder={!folderId} onLongPress={onLongPress} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: t.muted, backgroundColor: t.bg }]}>{section.key === SectionKey.Pinned ? '📌 Pinned' : section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : { paddingBottom: bottomInset + 90 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={wide ? undefined : <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.muted} />}
        ListEmptyComponent={<Empty icon={empty.icon} title={empty.title} hint={empty.hint} />}
      />

      <ActionMenu visible={!!menuNote} title={menuNote ? noteHeadline(menuNote) : undefined} actions={menuActions} onClose={() => setMenuNote(null)} />
    </View>
  );
}

function FolderChips() {
  const folders = useLists();
  const premium = useStore(s => s.isPremium());
  const openPaywall = useStore(s => s.openPaywall);
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const createList = useStore(s => s.createList);
  const updateList = useStore(s => s.updateList);
  const deleteList = useStore(s => s.deleteList);
  const [creating, setCreating] = useState(false);
  const [menuFolder, setMenuFolder] = useState<List | null>(null);
  const [renaming, setRenaming] = useState<List | null>(null);
  const activeId = view.kind === ViewKind.Folder ? view.id : null;

  const confirmDelete = (f: List) =>
    Alert.alert(`Delete “${f.name}”?`, 'Notes in this folder are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Folder', style: 'destructive', onPress: () => deleteList(f.id) },
    ]);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" style={styles.chipBar}>
        <Chip testID="folder-all" label="All" active={!activeId} onPress={() => setView({ kind: ViewKind.Notes })} />
        {folders.map(f => (
          <Chip
            key={f.id}
            testID={`folder-${f.name}`}
            label={f.name}
            color={f.color}
            active={activeId === f.id}
            onPress={() => setView({ kind: ViewKind.Folder, id: f.id })}
            onLongPress={() => setMenuFolder(f)}
          />
        ))}
        <Chip testID="add-folder" label={premium ? '＋ Folder' : '＋ Folder 🔒'} onPress={() => (premium ? setCreating(true) : openPaywall(PremiumFeature.Folders))} dashed />
      </ScrollView>
      <PromptSheet
        visible={creating}
        title="New folder"
        placeholder="Folder name"
        initialValue=""
        confirmLabel="Create"
        onCancel={() => setCreating(false)}
        onConfirm={name => {
          setCreating(false);
          createList(name, LIST_COLORS[folders.length % LIST_COLORS.length]);
        }}
      />
      <PromptSheet
        visible={!!renaming}
        title="Rename folder"
        initialValue={renaming?.name ?? ''}
        confirmLabel="Save"
        onCancel={() => setRenaming(null)}
        onConfirm={name => {
          if (renaming) {
            updateList(renaming.id, { name });
          }
          setRenaming(null);
        }}
      />
      <ActionMenu
        visible={!!menuFolder}
        title={menuFolder?.name}
        onClose={() => setMenuFolder(null)}
        actions={
          menuFolder
            ? [
                { label: 'Rename', icon: '✎', onPress: () => setRenaming(menuFolder) },
                { label: 'Delete Folder', icon: '🗑', destructive: true, onPress: () => confirmDelete(menuFolder) },
              ]
            : []
        }
      />
    </>
  );
}

function Chip({ label, active, color, dashed, onPress, onLongPress, testID }: { label: string; active?: boolean; color?: string; dashed?: boolean; onPress: () => void; onLongPress?: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={{ top: 5, bottom: 5 }}
      style={({ pressed }) => [
        styles.chip,
        dashed && styles.chipDashed,
        { backgroundColor: active ? t.text : t.pane, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, { color: active ? t.bg : dashed ? t.accent : t.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  controls: { paddingBottom: 4 },
  search: { paddingVertical: 8 },
  chipBar: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 34, borderRadius: 17 },
  chipDashed: { borderWidth: 1, borderStyle: 'dashed' },
  chipText: { fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 3, textTransform: 'uppercase' },
  emptyContainer: { flexGrow: 1 },
});
