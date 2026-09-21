import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupReminders, SectionKey, type Section } from '../lib/grouping';
import { noteHeadline } from '../lib/schedule';
import { EditorKind, useReminders, useStore } from '../store/useStore';
import { ReminderFilter, type Reminder } from '../types';
import { ActionMenu, Empty, ErrorBanner, IconButton, Input, type MenuAction } from './common';
import { ReminderRow } from './ReminderRow';
import { isMac, useTheme } from './theme';

const FILTER_LABELS: Record<ReminderFilter, string> = {
  [ReminderFilter.Upcoming]: 'Upcoming',
  [ReminderFilter.Done]: 'Done',
};

export function ReminderList({ bottomInset }: { bottomInset: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reminders = useReminders();
  const notes = useStore(s => s.notes);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const openEditor = useStore(s => s.openEditor);
  const refreshing = useStore(s => s.refreshing);
  const refresh = useStore(s => s.refresh);
  const completeReminder = useStore(s => s.completeReminder);
  const snoozeReminder = useStore(s => s.snoozeReminder);
  const deleteReminder = useStore(s => s.deleteReminder);
  const [filter, setFilter] = useState<ReminderFilter>(ReminderFilter.Upcoming);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuReminder, setMenuReminder] = useState<Reminder | null>(null);

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return reminders;
    }
    return reminders.filter(r => {
      const note = notes[r.note_id];
      return !!note && (note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q));
    });
  }, [reminders, notes, search]);

  const openCount = useMemo(() => matching.filter(r => !r.is_completed).length, [matching]);
  const doneCount = matching.length - openCount;
  const overdueCount = useMemo(() => {
    const now = Date.now();
    return matching.filter(r => !r.is_completed && new Date(r.due_at).getTime() < now).length;
  }, [matching]);

  const sections = useMemo<Section<Reminder>[]>(() => groupReminders(matching, new Date(), filter === ReminderFilter.Done), [matching, filter]);

  const siblings = useMemo(() => {
    const open: Record<string, number> = {};
    for (const r of reminders) {
      if (!r.is_completed) {
        open[r.note_id] = (open[r.note_id] ?? 0) + 1;
      }
    }
    return open;
  }, [reminders]);

  const toggleExpand = useCallback((id: string) => setExpandedId(current => (current === id ? null : id)), []);
  const onLongPress = useCallback((r: Reminder) => setMenuReminder(r), []);

  const newReminder = () => openEditor({ kind: EditorKind.New, listId: null, nonce: Date.now(), withReminder: true });

  const menuActions: MenuAction[] = menuReminder
    ? [
        { label: 'Open note', icon: '📝', onPress: () => openEditor({ kind: EditorKind.Existing, id: menuReminder.note_id, focusReminderId: menuReminder.id }) },
        { label: menuReminder.is_completed ? 'Mark as not done' : 'Mark as done', icon: '✓', onPress: () => completeReminder(menuReminder.id) },
        ...(!menuReminder.is_completed
          ? [
              { label: 'Snooze 10 minutes', icon: '💤', onPress: () => snoozeReminder(menuReminder.id, 10) },
              { label: 'Snooze 1 hour', icon: '💤', onPress: () => snoozeReminder(menuReminder.id, 60) },
            ]
          : []),
        { label: 'Delete reminder', icon: '🗑', destructive: true, onPress: () => deleteReminder(menuReminder.id) },
      ]
    : [];

  const empty = search
    ? { icon: '🔍', title: 'No results', hint: `No reminders match “${search.trim()}”.` }
    : filter === ReminderFilter.Done
    ? { icon: '✓', title: 'Nothing completed yet', hint: 'Tick a reminder’s circle to complete it.' }
    : { icon: '⏰', title: 'You’re all caught up', hint: isMac ? 'Press ＋ to add a reminder.' : 'Tap ＋ to add a reminder.' };

  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { paddingTop: isMac ? 14 : insets.top + 6, paddingLeft: insets.left + 16, paddingRight: insets.right + 12 }]}>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text }]} accessibilityRole="header">
            Reminders
          </Text>
          <Text style={[styles.subtitle, { color: overdueCount ? t.danger : t.muted }]}>
            {overdueCount ? `${overdueCount} overdue · ` : ''}
            {openCount} upcoming
          </Text>
        </View>
        {isMac ? <IconButton testID="new-reminder" label="＋" size={22} accessibilityLabel="New reminder" onPress={newReminder} /> : null}
      </View>

      <View style={[styles.controls, { paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
        <Input testID="search" placeholder="Search reminders" value={search} onChangeText={setSearch} clearButtonMode="while-editing" autoCorrect={false} style={styles.search} />
        <View style={[styles.segment, { backgroundColor: t.pane }]} accessibilityRole="tablist">
          {Object.values(ReminderFilter).map(f => {
            const active = filter === f;
            const count = f === ReminderFilter.Done ? doneCount : openCount;
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
                  {count ? <Text style={{ color: t.muted, fontWeight: '500' }}>{`  ${count}`}</Text> : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ErrorBanner />

      <SectionList
        sections={sections}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <ReminderRow reminder={item} siblingCount={Math.max(0, (siblings[item.note_id] ?? 0) - (item.is_completed ? 0 : 1))} expanded={expandedId === item.id} onToggleExpand={toggleExpand} onLongPress={onLongPress} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: t.bg }]}>
            <Text style={[styles.sectionTitle, { color: section.key === SectionKey.Overdue ? t.danger : t.muted }]}>{section.title}</Text>
            <Text style={[styles.sectionCount, { color: t.muted }]}>{section.data.length}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={!isMac}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : { paddingBottom: bottomInset + 90 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={isMac ? undefined : <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.muted} />}
        ListEmptyComponent={<Empty icon={empty.icon} title={empty.title} hint={empty.hint} />}
      />

      <ActionMenu
        visible={!!menuReminder}
        title={menuReminder ? noteHeadline(notes[menuReminder.note_id]) : undefined}
        actions={menuActions}
        onClose={() => setMenuReminder(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  controls: { gap: 8, paddingBottom: 4 },
  search: { paddingVertical: 8 },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 7 },
  segmentActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segmentText: { fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 3 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionCount: { fontSize: 11, fontWeight: '600' },
  emptyContainer: { flexGrow: 1 },
});
