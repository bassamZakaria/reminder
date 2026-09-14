import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { formatDayHeading } from '../lib/dates';
import { isSameDay, startOfDay } from '../lib/schedule';
import { selectItems, useStore } from '../store/useStore';
import type { Item, ReminderFilter } from '../types';
import { Empty, Header, IconButton, Segmented } from './common';
import { ItemRow } from './ItemRow';
import { useTheme } from './theme';

const FILTERS: { value: ReminderFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
];

function groupByDay(items: Item[]): { title: string; data: Item[] }[] {
  const now = new Date();
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.due_at ? startOfDay(new Date(item.due_at)).toISOString() : 'none';
    const overdueKey = item.due_at && new Date(item.due_at).getTime() < now.getTime() && !isSameDay(new Date(item.due_at), now) ? 'overdue' : key;
    const arr = groups.get(overdueKey) ?? [];
    arr.push(item);
    groups.set(overdueKey, arr);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === 'overdue' ? -1 : b === 'overdue' ? 1 : a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)));
  return keys.map(key => ({
    title: key === 'overdue' ? 'Overdue' : key === 'none' ? 'No date' : formatDayHeading(groups.get(key)![0].due_at!, now),
    data: groups.get(key)!.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '')),
  }));
}

export function RemindersScreen() {
  const t = useTheme();
  const items = useStore(selectItems);
  const filter = useStore(s => s.reminderFilter);
  const setFilter = useStore(s => s.setReminderFilter);
  const openEditor = useStore(s => s.openEditor);

  const sections = useMemo(() => {
    const now = new Date();
    let filtered: Item[];
    switch (filter) {
      case 'today':
        filtered = items.filter(i => !i.is_completed && i.due_at && new Date(i.due_at).getTime() <= endOfToday(now).getTime());
        break;
      case 'scheduled':
        filtered = items.filter(i => !i.is_completed && i.due_at);
        break;
      case 'done':
        filtered = items.filter(i => i.is_completed);
        break;
      default:
        filtered = items.filter(i => !i.is_completed && i.due_at);
    }
    if (filter === 'done') {
      return [{ title: 'Completed', data: filtered.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')) }];
    }
    return groupByDay(filtered);
  }, [items, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Reminders" right={<IconButton label="＋" onPress={() => openEditor({ kind: 'new', listId: null, asReminder: true })} />} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <ItemRow item={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.section, { color: section.title === 'Overdue' ? t.danger : t.accent, backgroundColor: t.bg }]}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled
        contentContainerStyle={sections.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        ListEmptyComponent={<Empty title="Nothing here" hint="Tap ＋ to add a reminder with a date and alarm." />}
      />
    </View>
  );
}

function endOfToday(now: Date): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() + 1);
  return d;
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
});
