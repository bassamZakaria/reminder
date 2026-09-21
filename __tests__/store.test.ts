import { AlertType, RepeatRule, type Note, type Reminder } from '../src/types';

type Result = { data: unknown; error: { message: string } | null };
const mockCalls: { table: string; op: string; payload?: unknown }[] = [];
let mockNextResult: Result = { data: null, error: null };

function mockQuery(table: string) {
  let op = 'select';
  let payload: unknown;
  const chain: Record<string, unknown> = {};
  const record = () => mockCalls.push({ table, op, payload });
  let rowId: string | undefined;
  for (const method of ['select', 'order', 'single']) {
    chain[method] = () => chain;
  }
  chain.eq = (_col: string, value: string) => {
    rowId = value;
    return chain;
  };
  chain.insert = (p: unknown) => {
    op = 'insert';
    payload = p;
    return chain;
  };
  chain.update = (p: unknown) => {
    op = 'update';
    payload = p;
    return chain;
  };
  chain.delete = () => {
    op = 'delete';
    return chain;
  };
  chain.then = (resolve: (r: Result) => unknown) => {
    record();
    const r = mockNextResult;
    if (op === 'insert' && !r.error && r.data === null) {
      return Promise.resolve(resolve({ data: { id: 'new-' + mockCalls.length, created_at: 'x', updated_at: 'x', ...(payload as object) }, error: null }));
    }
    if (op === 'update' && !r.error) {
      const current = require('../src/store/useStore').useStore.getState()[table][rowId!];
      return Promise.resolve(resolve({ data: { ...current, ...(payload as object) }, error: null }));
    }
    return Promise.resolve(resolve(r));
  };
  return chain;
}

jest.mock('../src/lib/supabase', () => ({
  isConfigured: true,
  supabase: {
    from: (table: string) => mockQuery(table),
    auth: { signOut: jest.fn(), onAuthStateChange: jest.fn(), getSession: jest.fn() },
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

jest.mock('../src/lib/alarms', () => ({
  alarms: { sync: jest.fn(() => Promise.resolve()), requestPermission: jest.fn(() => Promise.resolve(true)), cancel: jest.fn(), scheduleOnce: jest.fn(() => Promise.resolve()), cancelAll: jest.fn() },
  NotificationAction: {},
}));

import { alarms } from '../src/lib/alarms';
import { friendlyError, useStore } from '../src/store/useStore';

const NOTE: Note = {
  id: 'n1',
  user_id: 'u',
  list_id: null,
  title: 'Water plants',
  body: 'Balcony first',
  is_pinned: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function reminder(patch: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    user_id: 'u',
    note_id: 'n1',
    due_at: '2026-01-01T09:00:00Z',
    repeat_rule: RepeatRule.None,
    alert_type: AlertType.Notification,
    is_completed: false,
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...patch,
  };
}

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResult = { data: null, error: null };
  (alarms.requestPermission as jest.Mock).mockClear();
  useStore.setState({ session: { user: { id: 'u' } } as never, notes: { n1: NOTE }, reminders: {}, lists: {}, toast: null, error: null, editor: null, permissionGranted: null });
});

describe('completeReminder', () => {
  it('completes a one-off reminder', async () => {
    useStore.setState({ reminders: { r1: reminder() } });
    await useStore.getState().completeReminder('r1');
    expect(useStore.getState().reminders.r1.is_completed).toBe(true);
  });

  it('advances a repeating reminder instead of completing it', async () => {
    const due = new Date(Date.now() - 3600_000);
    useStore.setState({ reminders: { r1: reminder({ due_at: due.toISOString(), repeat_rule: RepeatRule.Daily }) } });
    await useStore.getState().completeReminder('r1');
    const updated = useStore.getState().reminders.r1;
    expect(updated.is_completed).toBe(false);
    expect(new Date(updated.due_at).getTime()).toBeGreaterThan(Date.now());
    expect(useStore.getState().toast?.message).toMatch(/^Next:/);
  });

  it('moves a future weekly reminder one full week ahead', async () => {
    const due = new Date(Date.now() + 3600_000);
    useStore.setState({ reminders: { r1: reminder({ due_at: due.toISOString(), repeat_rule: RepeatRule.Weekly }) } });
    await useStore.getState().completeReminder('r1');
    const next = new Date(useStore.getState().reminders.r1.due_at);
    expect(Math.round((next.getTime() - due.getTime()) / 86400_000)).toBe(7);
  });
});

describe('reminders on a note', () => {
  it('adds several reminders to one note', async () => {
    await useStore.getState().createReminder('n1', { due_at: '2026-02-01T09:00:00Z' });
    await useStore.getState().createReminder('n1', { due_at: '2026-02-02T09:00:00Z', alert_type: AlertType.Alarm });
    const mine = Object.values(useStore.getState().reminders).filter(r => r.note_id === 'n1');
    expect(mine).toHaveLength(2);
    expect(mine.map(r => r.alert_type).sort()).toEqual([AlertType.Alarm, AlertType.Notification]);
  });

  it('asks for notification permission only when the first reminder is added', async () => {
    expect(alarms.requestPermission).not.toHaveBeenCalled();
    await useStore.getState().createReminder('n1', { due_at: '2026-02-01T09:00:00Z' });
    expect(alarms.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('deleting a reminder keeps the note and can be undone', async () => {
    const r = reminder();
    useStore.setState({ reminders: { r1: r } });
    await useStore.getState().deleteReminder('r1');
    expect(useStore.getState().reminders.r1).toBeUndefined();
    expect(useStore.getState().notes.n1).toBeDefined();
    await useStore.getState().undoDelete();
    expect(useStore.getState().reminders.r1).toEqual(r);
    expect(mockCalls.at(-1)).toEqual({ table: 'reminders', op: 'insert', payload: [r] });
  });
});

describe('delete note and undo', () => {
  it('removes the note with its reminders and restores both on undo', async () => {
    const r = reminder();
    useStore.setState({ reminders: { r1: r, r2: reminder({ id: 'r2', note_id: 'other' }) } });
    await useStore.getState().deleteNote('n1');
    expect(useStore.getState().notes.n1).toBeUndefined();
    expect(Object.keys(useStore.getState().reminders)).toEqual(['r2']);
    expect(useStore.getState().toast?.undo).toEqual({ note: NOTE, reminders: [r] });

    await useStore.getState().undoDelete();
    expect(useStore.getState().notes.n1).toEqual(NOTE);
    expect(useStore.getState().reminders.r1).toEqual(r);
    expect(mockCalls.slice(-2).map(c => [c.table, c.op])).toEqual([
      ['notes', 'insert'],
      ['reminders', 'insert'],
    ]);
  });

  it('silent delete shows no toast', async () => {
    await useStore.getState().deleteNote('n1', true);
    expect(useStore.getState().toast).toBeNull();
  });

  it('rolls back when the server rejects the delete', async () => {
    useStore.setState({ reminders: { r1: reminder() } });
    mockNextResult = { data: null, error: { message: 'Failed to fetch' } };
    await useStore.getState().deleteNote('n1');
    expect(useStore.getState().notes.n1).toBeDefined();
    expect(useStore.getState().reminders.r1).toBeDefined();
    expect(useStore.getState().error).toMatch(/Can’t reach the server/);
  });
});

describe('loadAll', () => {
  it('keeps the current data when the network fails', async () => {
    useStore.setState({ reminders: { r1: reminder() } });
    mockNextResult = { data: null, error: { message: 'Network request failed' } };
    await useStore.getState().loadAll();
    expect(useStore.getState().notes.n1).toBeDefined();
    expect(useStore.getState().reminders.r1).toBeDefined();
    expect(useStore.getState().error).toMatch(/Can’t reach the server/);
  });
});

describe('togglePin', () => {
  it('flips the pinned flag', async () => {
    await useStore.getState().togglePin('n1');
    expect(useStore.getState().notes.n1.is_pinned).toBe(true);
  });
});

describe('friendlyError', () => {
  it('maps auth failures to plain language', () => {
    expect(friendlyError('Invalid login credentials')).toBe('Wrong email or password.');
  });
});
