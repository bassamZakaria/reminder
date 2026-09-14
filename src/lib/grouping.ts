import type { Item } from '../types';
import { daysBetween } from './schedule';

export interface Section {
  key: string;
  title: string;
  data: Item[];
}

export const byUpdated = (a: Item, b: Item) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at);
export const byDue = (a: Item, b: Item) => (a.due_at ?? '').localeCompare(b.due_at ?? '');

export function groupReminders(items: Item[], now: Date, showCompleted: boolean): Section[] {
  const buckets: Record<string, Item[]> = { overdue: [], today: [], tomorrow: [], upcoming: [], done: [] };
  for (const item of items) {
    if (!item.due_at) {
      continue;
    }
    if (item.is_completed) {
      buckets.done.push(item);
      continue;
    }
    const due = new Date(item.due_at);
    const diff = daysBetween(now, due);
    const key = due.getTime() < now.getTime() && diff < 0 ? 'overdue' : diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : 'upcoming';
    buckets[key].push(item);
  }
  const titles: Record<string, string> = { overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', upcoming: 'Upcoming', done: 'Completed' };
  return Object.keys(buckets)
    .filter(k => buckets[k].length > 0 && (k !== 'done' || showCompleted))
    .map(k => ({ key: k, title: titles[k], data: buckets[k].sort(k === 'done' ? (a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '') : byDue) }));
}

export function groupNotes(items: Item[], now: Date): Section[] {
  const buckets: Record<string, Item[]> = { pinned: [], today: [], week: [], older: [] };
  for (const item of items) {
    if (item.is_pinned) {
      buckets.pinned.push(item);
      continue;
    }
    const diff = -daysBetween(now, new Date(item.updated_at));
    buckets[diff <= 0 ? 'today' : diff < 7 ? 'week' : 'older'].push(item);
  }
  const titles: Record<string, string> = { pinned: 'Pinned', today: 'Today', week: 'Previous 7 Days', older: 'Older' };
  return Object.keys(buckets)
    .filter(k => buckets[k].length > 0)
    .map(k => ({ key: k, title: titles[k], data: buckets[k].sort(byUpdated) }));
}
