import { useMemo } from 'react';
import { create } from 'zustand';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { alarms, NotificationAction, type AlarmFiredEvent, type NotificationActionEvent } from '../lib/alarms';
import { addRepeat, nextOccurrence, SNOOZE_SUFFIX } from '../lib/schedule';
import { RepeatRule, ViewKind, type Item, type List, type View } from '../types';

export enum EditorKind {
  Existing = 'existing',
  New = 'new',
}

export type EditorTarget = { kind: EditorKind.Existing; id: string } | { kind: EditorKind.New; listId: string | null; nonce: number } | null;

export interface Toast {
  id: number;
  message: string;
  undoItem?: Item;
}

interface State {
  session: Session | null;
  authReady: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  toast: Toast | null;
  items: Record<string, Item>;
  lists: Record<string, List>;
  view: View;
  search: string;
  editor: EditorTarget;
  permissionGranted: boolean | null;
  alarmPermission: boolean | null;
  nativeAlarms: boolean;
  activeAlarm: AlarmFiredEvent | null;
  mobileFolders: boolean;

  init(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  loadAll(): Promise<void>;
  refresh(): Promise<void>;
  clearError(): void;
  showToast(message: string, undoItem?: Item): void;
  dismissToast(): void;
  undoDelete(): Promise<void>;
  togglePin(id: string): Promise<void>;
  setView(view: View): void;
  setSearch(search: string): void;
  openEditor(target: EditorTarget): void;
  closeEditor(): void;
  setMobileFolders(open: boolean): void;
  onAlarmFired(event: AlarmFiredEvent): void;
  dismissAlarm(): void;
  snoozeAlarm(minutes: number): Promise<void>;
  requestAlarmPermission(): Promise<void>;
  createItem(input: Partial<Item>): Promise<Item | null>;
  updateItem(id: string, patch: Partial<Item>): Promise<void>;
  deleteItem(id: string, silent?: boolean): Promise<void>;
  toggleComplete(id: string): Promise<void>;
  snooze(id: string, minutes: number): Promise<void>;
  createList(name: string, color: string): Promise<void>;
  updateList(id: string, patch: Partial<List>): Promise<void>;
  deleteList(id: string): Promise<void>;
  handleNotificationAction(event: NotificationActionEvent): Promise<void>;
}

let channel: RealtimeChannel | null = null;
let channelUserId: string | null = null;
let resolveReady: (() => void) | null = null;
let readyPending = true;
let ready = new Promise<void>(resolve => {
  resolveReady = resolve;
});
function markReady() {
  readyPending = false;
  resolveReady?.();
  resolveReady = null;
}
function resetReady() {
  if (readyPending) {
    return;
  }
  readyPending = true;
  ready = new Promise<void>(resolve => {
    resolveReady = resolve;
  });
}
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(get: () => State) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    alarms.sync(Object.values(get().items)).catch(err => console.warn('alarm sync failed', err));
  }, 150);
}

function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const row of rows) {
    out[row.id] = row;
  }
  return out;
}

export const useStore = create<State>((set, get) => ({
  session: null,
  authReady: false,
  loading: false,
  refreshing: false,
  error: null,
  toast: null,
  items: {},
  lists: {},
  view: { kind: ViewKind.All },
  search: '',
  editor: null,
  permissionGranted: null,
  alarmPermission: null,
  nativeAlarms: false,
  activeAlarm: null,
  mobileFolders: true,

  async init() {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, authReady: true });
    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        const hadUser = get().session?.user.id;
        set({ session });
        if (session && session.user.id !== hadUser) {
          resetReady();
          get().loadAll().then(markReady);
          requestNotificationPermission(set);
        }
        if (!session) {
          teardownRealtime();
          set({ items: {}, lists: {}, editor: null, view: { kind: ViewKind.All }, activeAlarm: null, toast: null, error: null });
          alarms.cancelAll();
          resetReady();
        }
      }, 0);
    });
    if (data.session) {
      await get().loadAll();
    }
    markReady();
    if (data.session) {
      requestNotificationPermission(set);
    }
    alarms.nativeAlarmsSupported().then(nativeAlarms => set({ nativeAlarms })).catch(() => set({ nativeAlarms: false }));
  },

  async requestAlarmPermission() {
    const granted = await alarms.requestAlarmPermission().catch(() => false);
    set({ alarmPermission: granted });
    scheduleSync(get);
  },

  async signIn(email, password) {
    set({ error: null, loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false, error: error ? friendlyError(error.message) : null });
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async loadAll() {
    const session = get().session;
    if (!session) {
      return;
    }
    set({ loading: true, error: null });
    const [listsRes, itemsRes] = await Promise.all([
      supabase.from('lists').select('*').order('sort_order').order('created_at'),
      supabase.from('items').select('*').order('updated_at', { ascending: false }),
    ]);
    const error = listsRes.error ?? itemsRes.error;
    if (error) {
      set({ loading: false, error: friendlyError(error.message) });
      return;
    }
    set({
      loading: false,
      error: null,
      lists: byId((listsRes.data ?? []) as List[]),
      items: byId((itemsRes.data ?? []) as Item[]),
    });
    setupRealtime(session.user.id, set, get);
    scheduleSync(get);
  },

  async refresh() {
    set({ refreshing: true });
    try {
      await get().loadAll();
    } finally {
      set({ refreshing: false });
    }
  },

  clearError: () => set({ error: null }),

  showToast: (message, undoItem) => set({ toast: { id: Date.now(), message, undoItem } }),

  dismissToast: () => set({ toast: null }),

  async undoDelete() {
    const item = get().toast?.undoItem;
    set({ toast: null });
    if (!item) {
      return;
    }
    set(s => ({ items: { ...s.items, [item.id]: item } }));
    const { error } = await supabase.from('items').insert(item);
    if (error) {
      set(s => {
        const items = { ...s.items };
        delete items[item.id];
        return { items, error: friendlyError(error.message) };
      });
      return;
    }
    scheduleSync(get);
  },

  async togglePin(id) {
    const item = get().items[id];
    if (item) {
      await get().updateItem(id, { is_pinned: !item.is_pinned });
    }
  },

  setView: view => set({ view, editor: null, search: '', mobileFolders: false }),
  setSearch: search => set({ search }),
  openEditor: editor => set({ editor }),
  closeEditor: () => set({ editor: null }),
  setMobileFolders: mobileFolders => set({ mobileFolders }),
  onAlarmFired: event => set({ activeAlarm: event }),
  dismissAlarm: () => {
    alarms.stopAlarmSound();
    set({ activeAlarm: null });
  },
  async snoozeAlarm(minutes) {
    const active = get().activeAlarm;
    alarms.stopAlarmSound();
    set({ activeAlarm: null });
    if (active) {
      await get().snooze(active.itemId, minutes);
    }
  },

  async createItem(input) {
    const session = get().session;
    if (!session) {
      return null;
    }
    const { data, error } = await supabase
      .from('items')
      .insert({ ...input, user_id: session.user.id })
      .select()
      .single();
    if (error) {
      set({ error: friendlyError(error.message) });
      return null;
    }
    const item = data as Item;
    set(s => ({ items: { ...s.items, [item.id]: item } }));
    scheduleSync(get);
    return item;
  },

  async updateItem(id, patch) {
    const prev = get().items[id];
    if (!prev) {
      return;
    }
    const optimistic = { ...prev, ...patch, updated_at: new Date().toISOString() };
    set(s => ({ items: { ...s.items, [id]: optimistic } }));
    scheduleSync(get);
    const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single();
    if (error) {
      set(s => ({ items: { ...s.items, [id]: prev }, error: friendlyError(error.message) }));
      scheduleSync(get);
      return;
    }
    set(s => ({ items: { ...s.items, [id]: data as Item } }));
  },

  async deleteItem(id, silent) {
    const prev = get().items[id];
    set(s => {
      const items = { ...s.items };
      delete items[id];
      return { items, editor: s.editor?.kind === EditorKind.Existing && s.editor.id === id ? null : s.editor };
    });
    alarms.cancel([id, id + SNOOZE_SUFFIX]);
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error && prev) {
      set(s => ({ items: { ...s.items, [id]: prev }, error: friendlyError(error.message) }));
      scheduleSync(get);
      return;
    }
    if (prev && !silent) {
      get().showToast(prev.title ? `Deleted “${prev.title}”` : 'Note deleted', prev);
    }
  },

  async toggleComplete(id) {
    const item = get().items[id];
    if (!item) {
      return;
    }
    if (item.is_completed) {
      await get().updateItem(id, { is_completed: false, completed_at: null });
      return;
    }
    alarms.cancel([id + SNOOZE_SUFFIX]);
    if (item.repeat_rule !== RepeatRule.None && item.due_at) {
      const next = nextOccurrence(addRepeat(new Date(item.due_at), item.repeat_rule), item.repeat_rule, new Date());
      await get().updateItem(id, { due_at: next.toISOString() });
      get().showToast(`Next: ${next.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
      return;
    }
    await get().updateItem(id, { is_completed: true, completed_at: new Date().toISOString() });
  },

  async snooze(id, minutes) {
    const item = get().items[id];
    if (!item) {
      return;
    }
    const fireAt = new Date(Date.now() + minutes * 60_000);
    if (item.repeat_rule === RepeatRule.None) {
      await get().updateItem(id, { due_at: fireAt.toISOString(), is_completed: false, completed_at: null });
      return;
    }
    await alarms.scheduleOnce(id + SNOOZE_SUFFIX, id, item.title || 'Reminder', item.body, fireAt, item.alert_type);
  },

  async createList(name, color) {
    const session = get().session;
    if (!session) {
      return;
    }
    const sort_order = Object.keys(get().lists).length;
    const { data, error } = await supabase.from('lists').insert({ name, color, sort_order, user_id: session.user.id }).select().single();
    if (error) {
      set({ error: friendlyError(error.message) });
      return;
    }
    const list = data as List;
    set(s => ({ lists: { ...s.lists, [list.id]: list } }));
  },

  async updateList(id, patch) {
    const prev = get().lists[id];
    if (!prev) {
      return;
    }
    set(s => ({ lists: { ...s.lists, [id]: { ...prev, ...patch } } }));
    const { error } = await supabase.from('lists').update(patch).eq('id', id);
    if (error) {
      set(s => ({ lists: { ...s.lists, [id]: prev }, error: friendlyError(error.message) }));
    }
  },

  async deleteList(id) {
    const prev = get().lists[id];
    set(s => {
      const lists = { ...s.lists };
      delete lists[id];
      const items = { ...s.items };
      for (const item of Object.values(items)) {
        if (item.list_id === id) {
          items[item.id] = { ...item, list_id: null };
        }
      }
      return { lists, items, view: s.view.kind === ViewKind.Folder && s.view.id === id ? { kind: ViewKind.All } : s.view };
    });
    const { error } = await supabase.from('lists').delete().eq('id', id);
    if (error && prev) {
      set(s => ({ lists: { ...s.lists, [id]: prev }, error: friendlyError(error.message) }));
    }
  },

  async handleNotificationAction({ itemId, action, eventId }) {
    try {
      if (action === NotificationAction.Dismiss) {
        return;
      }
      await ready;
      if (!get().session) {
        return;
      }
      if (!get().items[itemId]) {
        await get().loadAll();
      }
      switch (action) {
        case NotificationAction.Complete:
          await get().toggleComplete(itemId);
          break;
        case NotificationAction.Snooze10:
          await get().snooze(itemId, 10);
          break;
        case NotificationAction.Snooze60:
          await get().snooze(itemId, 60);
          break;
        case NotificationAction.Open:
          if (get().items[itemId]) {
            set({ editor: { kind: EditorKind.Existing, id: itemId }, mobileFolders: false });
          }
          break;
        default:
          break;
      }
    } finally {
      if (eventId) {
        alarms.ackAction(eventId);
      }
    }
  },
}));

function requestNotificationPermission(set: (partial: Partial<State>) => void) {
  alarms
    .requestPermission()
    .then(granted => set({ permissionGranted: granted }))
    .catch(() => set({ permissionGranted: false }));
}

function teardownRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
    channelUserId = null;
  }
}

function setupRealtime(userId: string, set: (fn: (s: State) => Partial<State>) => void, get: () => State) {
  if (channel && channelUserId === userId) {
    return;
  }
  teardownRealtime();
  channelUserId = userId;
  channel = supabase
    .channel(`user-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` }, payload => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id: string }).id;
        set(s => {
          const items = { ...s.items };
          delete items[id];
          return { items };
        });
        alarms.cancel([id, id + SNOOZE_SUFFIX]);
      } else {
        const item = payload.new as Item;
        set(s => {
          const current = s.items[item.id];
          if (current && current.updated_at > item.updated_at) {
            return {};
          }
          return { items: { ...s.items, [item.id]: item } };
        });
      }
      scheduleSync(get);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `user_id=eq.${userId}` }, payload => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id: string }).id;
        set(s => {
          const lists = { ...s.lists };
          delete lists[id];
          return { lists };
        });
      } else {
        const list = payload.new as List;
        set(s => ({ lists: { ...s.lists, [list.id]: list } }));
      }
    })
    .subscribe();
}

export function friendlyError(message: string): string {
  if (/network request failed|failed to fetch|load failed/i.test(message)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Wrong email or password.';
  }
  if (/issued at future/i.test(message)) {
    return 'This device’s clock is out of sync. Turn on “Set time automatically”, then retry.';
  }
  if (/jwt expired|refresh token/i.test(message)) {
    return 'Your session expired. Please sign in again.';
  }
  return message;
}

export const selectItems = (s: State) => Object.values(s.items);
export const selectLists = (s: State) => Object.values(s.lists).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

export function useItems(): Item[] {
  const items = useStore(s => s.items);
  return useMemo(() => Object.values(items), [items]);
}

export function useLists(): List[] {
  const lists = useStore(s => s.lists);
  return useMemo(() => Object.values(lists).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)), [lists]);
}
export type { RepeatRule };
