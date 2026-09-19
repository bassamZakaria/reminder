import { addRepeat, daysBetween, desiredSchedules, firstLine, nextOccurrence } from '../src/lib/schedule';
import { AlertType, RepeatRule, type Item } from '../src/types';

function item(patch: Partial<Item>): Item {
  return {
    id: 'a',
    user_id: 'u',
    list_id: null,
    title: 'Pay rent',
    body: '',
    due_at: null,
    repeat_rule: RepeatRule.None,
    alert_type: AlertType.Notification,
    is_completed: false,
    completed_at: null,
    is_pinned: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...patch,
  };
}

describe('addRepeat', () => {
  it('clamps monthly repeats to the last day of shorter months', () => {
    const jan31 = new Date(2026, 0, 31, 9, 0);
    const next = addRepeat(jan31, RepeatRule.Monthly);
    expect([next.getMonth(), next.getDate()]).toEqual([1, 28]);
  });

  it('adds a year for yearly repeats, clamping Feb 29', () => {
    const leap = new Date(2028, 1, 29, 9, 0);
    const next = addRepeat(leap, RepeatRule.Yearly);
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2029, 1, 28]);
  });

  it('keeps wall-clock time for daily repeats', () => {
    const d = new Date(2026, 2, 28, 7, 30);
    const next = addRepeat(d, RepeatRule.Daily);
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([29, 7, 30]);
  });
});

describe('nextOccurrence', () => {
  it('returns the first occurrence after now', () => {
    const due = new Date(2026, 0, 1, 9, 0);
    const now = new Date(2026, 0, 3, 10, 0);
    const next = nextOccurrence(due, RepeatRule.Daily, now);
    expect(next.getDate()).toBe(4);
    expect(next.getHours()).toBe(9);
  });

  it('leaves non-repeating dates untouched', () => {
    const due = new Date(2026, 0, 1, 9, 0);
    expect(nextOccurrence(due, RepeatRule.None, new Date(2026, 5, 1)).getTime()).toBe(due.getTime());
  });
});

describe('desiredSchedules', () => {
  const now = new Date(2026, 4, 10, 12, 0);

  it('skips notes, completed items and past one-off reminders', () => {
    const items = [
      item({ id: 'note' }),
      item({ id: 'done', due_at: new Date(2026, 4, 11).toISOString(), is_completed: true }),
      item({ id: 'past', due_at: new Date(2026, 4, 9).toISOString() }),
      item({ id: 'future', due_at: new Date(2026, 4, 11, 9).toISOString() }),
    ];
    expect(desiredSchedules(items, now).map(r => r.identifier)).toEqual(['future']);
  });

  it('arms a future first occurrence of a repeating reminder as a one-shot', () => {
    const [req] = desiredSchedules([item({ due_at: new Date(2026, 4, 11, 9).toISOString(), repeat_rule: RepeatRule.Weekly })], now);
    expect(req.repeat).toBe(RepeatRule.None);
  });

  it('arms a past repeating reminder as a repeating trigger at its next occurrence', () => {
    const [req] = desiredSchedules([item({ due_at: new Date(2026, 4, 1, 9).toISOString(), repeat_rule: RepeatRule.Daily, alert_type: AlertType.Alarm })], now);
    expect(req.repeat).toBe(RepeatRule.Daily);
    expect(req.alertType).toBe(AlertType.Alarm);
    expect(new Date(req.fireAt).getDate()).toBe(11);
  });

  it('falls back to a generic title', () => {
    const [req] = desiredSchedules([item({ title: '', due_at: new Date(2026, 4, 11).toISOString() })], now);
    expect(req.title).toBe('Reminder');
  });
});

describe('helpers', () => {
  it('firstLine skips blank lines and trims', () => {
    expect(firstLine('\n\n  hello world  \nsecond')).toBe('hello world');
  });

  it('daysBetween counts calendar days', () => {
    expect(daysBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1))).toBe(1);
  });
});
