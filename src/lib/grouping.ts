import type { Note, Reminder } from '../types';
import { daysBetween } from './schedule';

export enum SectionKey {
  Overdue = 'overdue',
  Today = 'today',
  Tomorrow = 'tomorrow',
  ThisWeek = 'this-week',
  Later = 'later',
  Done = 'done',
  Pinned = 'pinned',
  Recent = 'recent',
  Week = 'week',
  Older = 'older',
}

export interface Section<T> {
  key: SectionKey;
  title: string;
  data: T[];
}

const TITLES: Record<SectionKey, string> = {
  [SectionKey.Overdue]: 'Overdue',
  [SectionKey.Today]: 'Today',
  [SectionKey.Tomorrow]: 'Tomorrow',
  [SectionKey.ThisWeek]: 'Next 7 Days',
  [SectionKey.Later]: 'Later',
  [SectionKey.Done]: 'Completed',
  [SectionKey.Pinned]: 'Pinned',
  [SectionKey.Recent]: 'Today',
  [SectionKey.Week]: 'Previous 7 Days',
  [SectionKey.Older]: 'Older',
};

export const byDue = (a: Reminder, b: Reminder) => a.due_at.localeCompare(b.due_at);
const byCompletedDesc = (a: Reminder, b: Reminder) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '');
export const byUpdated = (a: Note, b: Note) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at);

function toSections<T>(order: SectionKey[], buckets: Partial<Record<SectionKey, T[]>>, sort: (key: SectionKey) => (a: T, b: T) => number): Section<T>[] {
  return order.filter(key => (buckets[key]?.length ?? 0) > 0).map(key => ({ key, title: TITLES[key], data: [...buckets[key]!].sort(sort(key)) }));
}

export function reminderBucket(due: Date, now: Date): SectionKey {
  const diff = daysBetween(now, due);
  if (diff < 0) {
    return SectionKey.Overdue;
  }
  if (diff === 0) {
    return SectionKey.Today;
  }
  if (diff === 1) {
    return SectionKey.Tomorrow;
  }
  return diff < 7 ? SectionKey.ThisWeek : SectionKey.Later;
}

export function groupReminders(reminders: Reminder[], now: Date, completed: boolean): Section<Reminder>[] {
  if (completed) {
    return toSections([SectionKey.Done], { [SectionKey.Done]: reminders.filter(r => r.is_completed) }, () => byCompletedDesc);
  }
  const buckets: Partial<Record<SectionKey, Reminder[]>> = {};
  for (const reminder of reminders) {
    if (reminder.is_completed) {
      continue;
    }
    (buckets[reminderBucket(new Date(reminder.due_at), now)] ??= []).push(reminder);
  }
  return toSections([SectionKey.Overdue, SectionKey.Today, SectionKey.Tomorrow, SectionKey.ThisWeek, SectionKey.Later], buckets, () => byDue);
}

export function groupNotes(notes: Note[], now: Date): Section<Note>[] {
  const buckets: Partial<Record<SectionKey, Note[]>> = {};
  for (const note of notes) {
    const age = -daysBetween(now, new Date(note.updated_at));
    const key = note.is_pinned ? SectionKey.Pinned : age <= 0 ? SectionKey.Recent : age < 7 ? SectionKey.Week : SectionKey.Older;
    (buckets[key] ??= []).push(note);
  }
  return toSections([SectionKey.Pinned, SectionKey.Recent, SectionKey.Week, SectionKey.Older], buckets, () => byUpdated);
}

export function remindersByNote(reminders: Reminder[]): Record<string, Reminder[]> {
  const out: Record<string, Reminder[]> = {};
  for (const reminder of reminders) {
    (out[reminder.note_id] ??= []).push(reminder);
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => Number(a.is_completed) - Number(b.is_completed) || byDue(a, b));
  }
  return out;
}
