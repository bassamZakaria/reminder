import { daysBetween, isSameDay } from './schedule';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateTime(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dm || !tm) {
    return null;
  }
  const [year, month, day, hour, minute] = [Number(dm[1]), Number(dm[2]), Number(dm[3]), Number(tm[1]), Number(tm[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

export function formatDue(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const diff = daysBetween(now, d);
  if (isSameDay(d, now)) {
    return `Today, ${time}`;
  }
  if (diff === 1) {
    return `Tomorrow, ${time}`;
  }
  if (diff === -1) {
    return `Yesterday, ${time}`;
  }
  if (diff > 1 && diff < 7) {
    return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${time}`;
  }
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}, ${time}`;
}

export function formatDayHeading(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = daysBetween(now, d);
  if (diff === 0) {
    return 'Today';
  }
  if (diff === 1) {
    return 'Tomorrow';
  }
  if (diff < 0) {
    return 'Overdue';
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatRelative(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isSameDay(d, now)) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatReminderTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = daysBetween(now, d);
  if (diff === 0 || diff === 1) {
    return formatTime(d);
  }
  if (diff > 1 && diff < 7) {
    return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${formatTime(d)}`;
  }
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}, ${formatTime(d)}`;
}
