import type { Item, RepeatRule } from '../types';

export const SNOOZE_SUFFIX = ':snooze';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function addRepeat(date: Date, rule: RepeatRule, count = 1): Date {
  const d = new Date(date.getTime());
  switch (rule) {
    case 'hourly':
      return new Date(d.getTime() + count * HOUR);
    case 'daily':
      d.setDate(d.getDate() + count);
      return d;
    case 'weekly':
      d.setDate(d.getDate() + 7 * count);
      return d;
    case 'monthly':
      d.setMonth(d.getMonth() + count);
      return d;
    case 'yearly':
      d.setFullYear(d.getFullYear() + count);
      return d;
    default:
      return d;
  }
}

export function nextOccurrence(dueAt: Date, rule: RepeatRule, now: Date): Date {
  if (rule === 'none') {
    return dueAt;
  }
  let next = dueAt;
  let guard = 0;
  while (next.getTime() <= now.getTime() && guard < 10_000) {
    next = addRepeat(next, rule);
    guard += 1;
  }
  return next;
}

export interface ScheduleRequest {
  identifier: string;
  itemId: string;
  title: string;
  body: string;
  fireAt: number;
  repeat: RepeatRule;
}

export function desiredSchedules(items: Item[], now: Date): ScheduleRequest[] {
  const out: ScheduleRequest[] = [];
  for (const item of items) {
    if (item.is_completed || !item.due_at) {
      continue;
    }
    const due = new Date(item.due_at);
    if (Number.isNaN(due.getTime())) {
      continue;
    }
    if (item.repeat_rule === 'none' && due.getTime() <= now.getTime()) {
      continue;
    }
    const fireAt = item.repeat_rule === 'none' ? due : nextOccurrence(due, item.repeat_rule, now);
    out.push({
      identifier: item.id,
      itemId: item.id,
      title: item.title || 'Reminder',
      body: firstLine(item.body),
      fireAt: fireAt.getTime(),
      repeat: item.repeat_rule,
    });
  }
  return out;
}

export function signature(req: ScheduleRequest): string {
  return `${req.fireAt}|${req.repeat}|${req.title}|${req.body}`;
}

export function firstLine(text: string): string {
  return (text || '').split('\n').find(line => line.trim().length > 0)?.trim().slice(0, 120) ?? '';
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}
