import { addRepeat, daysBetween, desiredSchedules, firstLine, nextAfterCompletion, nextOccurrence, noteHeadline } from '../src/lib/schedule';
import { AlertType, RepeatRule, type Note, type Reminder } from '../src/types';

const NOTE: Note = {
  id: 'n1',
  user_id: 'u',
  list_id: null,
  title: 'Pay rent',
  body: 'Transfer to landlord\nRef 42',
  is_pinned: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const NOTES = { n1: NOTE };

function reminder(patch: Partial<Reminder>): Reminder {
  return {
    id: 'r1',
    user_id: 'u',
    note_id: 'n1',
    due_at: '2026-05-11T09:00:00Z',
    repeat_rule: RepeatRule.None,
    alert_type: AlertType.Notification,
    is_completed: false,
    completed_at: null,
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

  it('skips completed and past one-off reminders', () => {
    const reminders = [
      reminder({ id: 'done', due_at: new Date(2026, 4, 11).toISOString(), is_completed: true }),
      reminder({ id: 'past', due_at: new Date(2026, 4, 9).toISOString() }),
      reminder({ id: 'future', due_at: new Date(2026, 4, 11, 9).toISOString() }),
    ];
    expect(desiredSchedules(reminders, NOTES, now).map(r => r.identifier)).toEqual(['future']);
  });

  it('uses the note title and first body line as the alert text', () => {
    const [req] = desiredSchedules([reminder({ due_at: new Date(2026, 4, 11).toISOString() })], NOTES, now);
    expect([req.title, req.body]).toEqual(['Pay rent', 'Transfer to landlord']);
  });

  it('arms a future first occurrence of a repeating reminder as a one-shot', () => {
    const [req] = desiredSchedules([reminder({ due_at: new Date(2026, 4, 11, 9).toISOString(), repeat_rule: RepeatRule.Weekly })], NOTES, now);
    expect(req.repeat).toBe(RepeatRule.None);
  });

  it('arms a past repeating reminder as a repeating trigger at its next occurrence', () => {
    const [req] = desiredSchedules([reminder({ due_at: new Date(2026, 4, 1, 9).toISOString(), repeat_rule: RepeatRule.Daily, alert_type: AlertType.Alarm })], NOTES, now);
    expect(req.repeat).toBe(RepeatRule.Daily);
    expect(req.alertType).toBe(AlertType.Alarm);
    expect(new Date(req.fireAt).getDate()).toBe(11);
  });

  it('schedules every reminder of a note separately', () => {
    const reqs = desiredSchedules(
      [reminder({ id: 'a', due_at: new Date(2026, 4, 11).toISOString() }), reminder({ id: 'b', due_at: new Date(2026, 4, 12).toISOString() })],
      NOTES,
      now,
    );
    expect(reqs.map(r => r.identifier)).toEqual(['a', 'b']);
  });
});

describe('nextAfterCompletion', () => {
  it('moves a future repeating reminder one full period ahead', () => {
    const due = new Date(2026, 4, 11, 9);
    const next = nextAfterCompletion({ due_at: due.toISOString(), repeat_rule: RepeatRule.Weekly }, new Date(2026, 4, 10));
    expect(next.getDate()).toBe(18);
  });
});

describe('helpers', () => {
  it('firstLine skips blank lines and trims', () => {
    expect(firstLine('\n\n  hello world  \nsecond')).toBe('hello world');
  });

  it('noteHeadline falls back to the first body line, then a default', () => {
    expect(noteHeadline({ title: '', body: '\nBuy milk\nand eggs' })).toBe('Buy milk');
    expect(noteHeadline(undefined)).toBe('Reminder');
  });

  it('daysBetween counts calendar days', () => {
    expect(daysBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1))).toBe(1);
  });
});
