import { RepeatRule, type AlertType, type Item } from '../types';

export const SNOOZE_SUFFIX = ':snooze';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function addRepeat(date: Date, rule: RepeatRule, count = 1): Date {
  const d = new Date(date.getTime());
  switch (rule) {
    case RepeatRule.Hourly:
      return new Date(d.getTime() + count * HOUR);
    case RepeatRule.Daily:
      d.setDate(d.getDate() + count);
      return d;
    case RepeatRule.Weekly:
      d.setDate(d.getDate() + 7 * count);
      return d;
    case RepeatRule.Monthly:
      return addMonthsClamped(d, count);
    case RepeatRule.Yearly:
      return addMonthsClamped(d, 12 * count);
    default:
      return d;
  }
}

function addMonthsClamped(d: Date, months: number): Date {
  const day = d.getDate();
  const x = new Date(d.getTime());
  x.setDate(1);
  x.setMonth(x.getMonth() + months);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, lastDay));
  return x;
}

export function nextOccurrence(dueAt: Date, rule: RepeatRule, now: Date): Date {
  if (rule === RepeatRule.None) {
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
  alertType: AlertType;
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
    if (item.repeat_rule === RepeatRule.None && due.getTime() <= now.getTime()) {
      continue;
    }
    // A calendar repeat trigger has no start date, so a future first occurrence is armed as a
    // one-shot; once it is in the past, the next sync re-arms it as a true repeating trigger.
    const firstOccurrencePending = item.repeat_rule !== RepeatRule.None && due.getTime() > now.getTime();
    const fireAt = item.repeat_rule === RepeatRule.None || firstOccurrencePending ? due : nextOccurrence(due, item.repeat_rule, now);
    out.push({
      identifier: item.id,
      itemId: item.id,
      title: item.title || 'Reminder',
      body: firstLine(item.body),
      fireAt: fireAt.getTime(),
      repeat: firstOccurrencePending ? RepeatRule.None : item.repeat_rule,
      alertType: item.alert_type,
    });
  }
  return out;
}

export function signature(req: ScheduleRequest): string {
  return `${req.fireAt}|${req.repeat}|${req.alertType}|${req.title}|${req.body}`;
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
