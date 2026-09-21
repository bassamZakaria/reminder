import { groupNotes, groupReminders, remindersByNote, SectionKey } from '../src/lib/grouping';
import { AlertType, RepeatRule, type Note, type Reminder } from '../src/types';

const now = new Date(2026, 4, 10, 12, 0);

function reminder(id: string, due: Date, patch: Partial<Reminder> = {}): Reminder {
  return {
    id,
    user_id: 'u',
    note_id: 'n1',
    due_at: due.toISOString(),
    repeat_rule: RepeatRule.None,
    alert_type: AlertType.Notification,
    is_completed: false,
    completed_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...patch,
  };
}

function note(id: string, patch: Partial<Note> = {}): Note {
  return { id, user_id: 'u', list_id: null, title: id, body: '', is_pinned: false, created_at: now.toISOString(), updated_at: now.toISOString(), ...patch };
}

describe('groupReminders', () => {
  it('buckets open reminders by day and sorts by time', () => {
    const sections = groupReminders(
      [
        reminder('later-today', new Date(2026, 4, 10, 18)),
        reminder('earlier-today', new Date(2026, 4, 10, 8)),
        reminder('yesterday', new Date(2026, 4, 9, 8)),
        reminder('tomorrow', new Date(2026, 4, 11, 8)),
        reminder('friday', new Date(2026, 4, 15, 8)),
        reminder('next-month', new Date(2026, 5, 20, 8)),
        reminder('done', new Date(2026, 4, 10, 9), { is_completed: true }),
      ],
      now,
      false,
    );
    expect(sections.map(s => [s.key, s.data.map(r => r.id)])).toEqual([
      [SectionKey.Overdue, ['yesterday']],
      [SectionKey.Today, ['earlier-today', 'later-today']],
      [SectionKey.Tomorrow, ['tomorrow']],
      [SectionKey.ThisWeek, ['friday']],
      [SectionKey.Later, ['next-month']],
    ]);
  });

  it('lists completed reminders newest first', () => {
    const sections = groupReminders(
      [
        reminder('old', now, { is_completed: true, completed_at: '2026-05-01T00:00:00Z' }),
        reminder('new', now, { is_completed: true, completed_at: '2026-05-09T00:00:00Z' }),
        reminder('open', now),
      ],
      now,
      true,
    );
    expect(sections.map(s => s.data.map(r => r.id))).toEqual([['new', 'old']]);
  });
});

describe('groupNotes', () => {
  it('puts pinned notes first and splits the rest by age', () => {
    const sections = groupNotes(
      [
        note('old', { updated_at: new Date(2026, 3, 1).toISOString() }),
        note('pinned', { is_pinned: true, updated_at: new Date(2026, 3, 1).toISOString() }),
        note('recent', { updated_at: new Date(2026, 4, 8).toISOString() }),
        note('fresh'),
      ],
      now,
    );
    expect(sections.map(s => [s.key, s.data.map(n => n.id)])).toEqual([
      [SectionKey.Pinned, ['pinned']],
      [SectionKey.Recent, ['fresh']],
      [SectionKey.Week, ['recent']],
      [SectionKey.Older, ['old']],
    ]);
  });
});

describe('remindersByNote', () => {
  it('groups by note with open reminders first, soonest first', () => {
    const map = remindersByNote([
      reminder('b', new Date(2026, 4, 12)),
      reminder('done', new Date(2026, 4, 1), { is_completed: true }),
      reminder('a', new Date(2026, 4, 11)),
      reminder('other', new Date(2026, 4, 11), { note_id: 'n2' }),
    ]);
    expect(map.n1.map(r => r.id)).toEqual(['a', 'b', 'done']);
    expect(map.n2.map(r => r.id)).toEqual(['other']);
  });
});
