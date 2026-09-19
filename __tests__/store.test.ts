import { AlertType, RepeatRule, type Item } from '../src/types';

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
    if (op === 'update' && !r.error) {
      const current = require('../src/store/useStore').useStore.getState().items[rowId!];
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
  alarms: { sync: jest.fn(() => Promise.resolve()), cancel: jest.fn(), scheduleOnce: jest.fn(() => Promise.resolve()), cancelAll: jest.fn() },
  NotificationAction: {},
}));

import { friendlyError, useStore } from '../src/store/useStore';

function item(patch: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    user_id: 'u',
    list_id: null,
    title: 'Water plants',
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

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResult = { data: null, error: null };
  useStore.setState({ items: {}, lists: {}, toast: null, error: null, editor: null });
});

describe('toggleComplete', () => {
  it('completes a one-off reminder', async () => {
    useStore.setState({ items: { i1: item({ due_at: '2026-01-01T09:00:00Z' }) } });
    await useStore.getState().toggleComplete('i1');
    expect(useStore.getState().items.i1.is_completed).toBe(true);
  });

  it('advances a repeating reminder instead of completing it', async () => {
    const due = new Date(Date.now() - 3600_000);
    useStore.setState({ items: { i1: item({ due_at: due.toISOString(), repeat_rule: RepeatRule.Daily }) } });
    await useStore.getState().toggleComplete('i1');
    const updated = useStore.getState().items.i1;
    expect(updated.is_completed).toBe(false);
    expect(new Date(updated.due_at!).getTime()).toBeGreaterThan(Date.now());
    expect(useStore.getState().toast?.message).toMatch(/^Next:/);
  });
});

describe('toggleComplete on a future repeating reminder', () => {
  it('moves it one full period ahead', async () => {
    const due = new Date(Date.now() + 3600_000);
    useStore.setState({ items: { i1: item({ due_at: due.toISOString(), repeat_rule: RepeatRule.Weekly }) } });
    await useStore.getState().toggleComplete('i1');
    const next = new Date(useStore.getState().items.i1.due_at!);
    expect(Math.round((next.getTime() - due.getTime()) / 86400_000)).toBe(7);
  });
});

describe('delete and undo', () => {
  it('offers undo after deleting, and restores the same row', async () => {
    const original = item();
    useStore.setState({ items: { i1: original } });
    await useStore.getState().deleteItem('i1');
    expect(useStore.getState().items.i1).toBeUndefined();
    expect(useStore.getState().toast?.undoItem).toEqual(original);

    await useStore.getState().undoDelete();
    expect(useStore.getState().items.i1).toEqual(original);
    expect(mockCalls.at(-1)).toEqual({ table: 'items', op: 'insert', payload: original });
  });

  it('silent delete shows no toast', async () => {
    useStore.setState({ items: { i1: item() } });
    await useStore.getState().deleteItem('i1', true);
    expect(useStore.getState().toast).toBeNull();
  });

  it('rolls back when the server rejects the delete', async () => {
    useStore.setState({ items: { i1: item() } });
    mockNextResult = { data: null, error: { message: 'Failed to fetch' } };
    await useStore.getState().deleteItem('i1');
    expect(useStore.getState().items.i1).toBeDefined();
    expect(useStore.getState().error).toMatch(/Can’t reach the server/);
  });
});

describe('loadAll', () => {
  it('keeps the current notes when the network fails', async () => {
    useStore.setState({ session: { user: { id: 'u' } } as never, items: { i1: item() } });
    mockNextResult = { data: null, error: { message: 'Network request failed' } };
    await useStore.getState().loadAll();
    expect(useStore.getState().items.i1).toBeDefined();
    expect(useStore.getState().error).toMatch(/Can’t reach the server/);
  });
});

describe('togglePin', () => {
  it('flips the pinned flag', async () => {
    useStore.setState({ items: { i1: item() } });
    await useStore.getState().togglePin('i1');
    expect(useStore.getState().items.i1.is_pinned).toBe(true);
  });
});

describe('friendlyError', () => {
  it('maps auth failures to plain language', () => {
    expect(friendlyError('Invalid login credentials')).toBe('Wrong email or password.');
  });
});
