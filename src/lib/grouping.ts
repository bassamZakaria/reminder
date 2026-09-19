import type { Item } from '../types';
import { daysBetween } from './schedule';

export enum SectionKey {
  Overdue = 'overdue',
  Today = 'today',
  Tomorrow = 'tomorrow',
  Upcoming = 'upcoming',
  Done = 'done',
  Pinned = 'pinned',
  Week = 'week',
  Older = 'older',
}

export interface Section {
  key: SectionKey;
  title: string;
  data: Item[];
}

const TITLES: Record<SectionKey, string> = {
  [SectionKey.Overdue]: 'Overdue',
  [SectionKey.Today]: 'Today',
  [SectionKey.Tomorrow]: 'Tomorrow',
  [SectionKey.Upcoming]: 'Upcoming',
  [SectionKey.Done]: 'Completed',
  [SectionKey.Pinned]: 'Pinned',
  [SectionKey.Week]: 'Previous 7 Days',
  [SectionKey.Older]: 'Older',
};

export const byUpdated = (a: Item, b: Item) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at);
export const byDue = (a: Item, b: Item) => (a.due_at ?? '').localeCompare(b.due_at ?? '');
const byCompletedDesc = (a: Item, b: Item) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '');

function toSections(order: SectionKey[], buckets: Partial<Record<SectionKey, Item[]>>, sort: (key: SectionKey) => (a: Item, b: Item) => number): Section[] {
  return order
    .filter(key => (buckets[key]?.length ?? 0) > 0)
    .map(key => ({ key, title: TITLES[key], data: [...buckets[key]!].sort(sort(key)) }));
}

export function reminderBucket(due: Date, now: Date): SectionKey {
  const diff = daysBetween(now, due);
  if (diff < 0) {
    return SectionKey.Overdue;
  }
  if (diff === 0) {
    return SectionKey.Today;
  }
  return diff === 1 ? SectionKey.Tomorrow : SectionKey.Upcoming;
}

export function groupReminders(items: Item[], now: Date, showCompleted: boolean): Section[] {
  const buckets: Partial<Record<SectionKey, Item[]>> = {};
  for (const item of items) {
    if (item.is_completed ? !showCompleted : !item.due_at) {
      continue;
    }
    const key = item.is_completed ? SectionKey.Done : reminderBucket(new Date(item.due_at!), now);
    (buckets[key] ??= []).push(item);
  }
  return toSections([SectionKey.Overdue, SectionKey.Today, SectionKey.Tomorrow, SectionKey.Upcoming, SectionKey.Done], buckets, key =>
    key === SectionKey.Done ? byCompletedDesc : byDue,
  );
}

export function groupNotes(items: Item[], now: Date): Section[] {
  const buckets: Partial<Record<SectionKey, Item[]>> = {};
  for (const item of items) {
    const age = -daysBetween(now, new Date(item.updated_at));
    const key = item.is_pinned ? SectionKey.Pinned : age <= 0 ? SectionKey.Today : age < 7 ? SectionKey.Week : SectionKey.Older;
    (buckets[key] ??= []).push(item);
  }
  return toSections([SectionKey.Pinned, SectionKey.Today, SectionKey.Week, SectionKey.Older], buckets, () => byUpdated);
}
