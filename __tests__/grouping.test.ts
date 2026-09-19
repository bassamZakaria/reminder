import { groupNotes, groupReminders, SectionKey } from '../src/lib/grouping';
import { AlertType, RepeatRule, type Item } from '../src/types';

const now = new Date(2026, 4, 10, 12, 0);

function item(id: string, patch: Partial<Item> = {}): Item {
  return {
    id,
    user_id: 'u',
    list_id: null,
    title: id,
    body: '',
    due_at: null,
    repeat_rule: RepeatRule.None,
    alert_type: AlertType.Notification,
    is_completed: false,
    completed_at: null,
    is_pinned: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...patch,
  };
}

describe('groupReminders', () => {
  it('buckets reminders by day and sorts by due time', () => {
    const sections = groupReminders(
      [
        item('later-today', { due_at: new Date(2026, 4, 10, 18).toISOString() }),
        item('earlier-today', { due_at: new Date(2026, 4, 10, 8).toISOString() }),
        item('yesterday', { due_at: new Date(2026, 4, 9, 8).toISOString() }),
        item('tomorrow', { due_at: new Date(2026, 4, 11, 8).toISOString() }),
        item('next-week', { due_at: new Date(2026, 4, 17, 8).toISOString() }),
        item('note'),
      ],
      now,
      false,
    );
    expect(sections.map(s => [s.key, s.data.map(i => i.id)])).toEqual([
      [SectionKey.Overdue, ['yesterday']],
      [SectionKey.Today, ['earlier-today', 'later-today']],
      [SectionKey.Tomorrow, ['tomorrow']],
      [SectionKey.Upcoming, ['next-week']],
    ]);
  });

  it('shows completed items, including ones without a date, newest first', () => {
    const sections = groupReminders(
      [
        item('old', { is_completed: true, completed_at: '2026-05-01T00:00:00Z', due_at: '2026-05-01T00:00:00Z' }),
        item('new', { is_completed: true, completed_at: '2026-05-09T00:00:00Z' }),
      ],
      now,
      true,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map(i => i.id)).toEqual(['new', 'old']);
  });
});

describe('groupNotes', () => {
  it('puts pinned notes first and splits the rest by age', () => {
    const sections = groupNotes(
      [
        item('old', { updated_at: new Date(2026, 3, 1).toISOString() }),
        item('pinned', { is_pinned: true, updated_at: new Date(2026, 3, 1).toISOString() }),
        item('recent', { updated_at: new Date(2026, 4, 8).toISOString() }),
        item('fresh'),
      ],
      now,
    );
    expect(sections.map(s => [s.key, s.data.map(i => i.id)])).toEqual([
      [SectionKey.Pinned, ['pinned']],
      [SectionKey.Today, ['fresh']],
      [SectionKey.Week, ['recent']],
      [SectionKey.Older, ['old']],
    ]);
  });
});
