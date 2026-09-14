import { addRepeat, desiredSchedules, firstLine, nextOccurrence } from '../src/lib/schedule';
import { formatDue, parseDateTime, toDateInput, toTimeInput } from '../src/lib/dates';
import type { Item } from '../src/types';

const base = (over: Partial<Item>): Item => ({
  id: 'a',
  user_id: 'u',
  list_id: null,
  title: 'Pay rent',
  body: '\n  first line here\nsecond',
  due_at: null,
  repeat_rule: 'none',
  is_completed: false,
  completed_at: null,
  is_pinned: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('nextOccurrence', () => {
  const now = new Date(2026, 8, 14, 12, 0, 0);
  it('returns due date unchanged for one-shot', () => {
    const due = new Date(2026, 8, 10, 9, 0);
    expect(nextOccurrence(due, 'none', now)).toEqual(due);
  });
  it('advances daily past now', () => {
    const due = new Date(2026, 8, 10, 9, 0);
    expect(nextOccurrence(due, 'daily', now)).toEqual(new Date(2026, 8, 15, 9, 0));
  });
  it('advances monthly keeping day', () => {
    const due = new Date(2026, 6, 31, 9, 0);
    const next = nextOccurrence(due, 'monthly', now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
  it('addRepeat weekly adds 7 days', () => {
    expect(addRepeat(new Date(2026, 0, 1), 'weekly')).toEqual(new Date(2026, 0, 8));
  });
});

describe('desiredSchedules', () => {
  const now = new Date(2026, 8, 14, 12, 0, 0);
  it('skips completed, undated, and past one-shots', () => {
    const items = [
      base({ id: '1', due_at: new Date(2026, 8, 15, 9).toISOString() }),
      base({ id: '2', due_at: new Date(2026, 8, 15, 9).toISOString(), is_completed: true }),
      base({ id: '3' }),
      base({ id: '4', due_at: new Date(2026, 8, 1, 9).toISOString() }),
      base({ id: '5', due_at: new Date(2026, 8, 1, 9).toISOString(), repeat_rule: 'daily' }),
    ];
    const out = desiredSchedules(items, now);
    expect(out.map(o => o.identifier)).toEqual(['1', '5']);
    expect(out[1].fireAt).toBe(new Date(2026, 8, 15, 9).getTime());
    expect(out[0].body).toBe('first line here');
  });
});

describe('dates', () => {
  it('round-trips date and time inputs', () => {
    const d = new Date(2026, 2, 5, 7, 45);
    expect(toDateInput(d)).toBe('2026-03-05');
    expect(toTimeInput(d)).toBe('07:45');
    expect(parseDateTime('2026-03-05', '07:45')).toEqual(d);
  });
  it('rejects malformed input', () => {
    expect(parseDateTime('2026/03/05', '07:45')).toBeNull();
    expect(parseDateTime('2026-03-05', '7pm')).toBeNull();
  });
  it('labels today and tomorrow', () => {
    const now = new Date(2026, 8, 14, 12, 0);
    expect(formatDue(new Date(2026, 8, 14, 18, 30).toISOString(), now)).toMatch(/^Today, /);
    expect(formatDue(new Date(2026, 8, 15, 8, 0).toISOString(), now)).toMatch(/^Tomorrow, /);
  });
  it('firstLine trims and skips blanks', () => {
    expect(firstLine('\n\n  hello \nworld')).toBe('hello');
    expect(firstLine('')).toBe('');
  });
});
