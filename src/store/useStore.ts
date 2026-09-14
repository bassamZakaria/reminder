import { create } from 'zustand';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { alarms, type NotificationActionEvent } from '../lib/alarms';
import { nextOccurrence, SNOOZE_SUFFIX } from '../lib/schedule';
import type { Item, List, ReminderFilter, RepeatRule, Tab } from '../types';

export type EditorTarget = { kind: 'existing'; id: string } | { kind: 'new'; listId: string | null; asReminder: boolean } | null;

interface State {
  session: Session | null;
  authReady: boolean;
  loading: boolean;
  error: string | null;
  items: Record<string, Item>;
  lists: Record<string, List>;
  tab: Tab;
  reminderFilter: ReminderFilter;
  search: string;
  editor: EditorTarget;
  activeListId: string | null;
  permissionGranted: boolean | null;

  init(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  loadAll(): Promise<void>;
  setTab(tab: Tab): void;
  setReminderFilter(filter: ReminderFilter): void;
  setSearch(search: string): void;
  openEditor(target: EditorTarget): void;
  closeEditor(): void;
  setActiveList(id: string | null): void;
  createItem(input: Partial<Item>): Promise<Item | null>;
  updateItem(id: string, patch: Partial<Item>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  toggleComplete(id: string): Promise<void>;
  snooze(id: string, minutes: number): Promise<void>;
  createList(name: string, color: string): Promise<void>;
  updateList(id: string, patch: Partial<List>): Promise<void>;
  deleteList(id: string): Promise<void>;
  handleNotificationAction(event: NotificationActionEvent): Promise<void>;
}

let channel: RealtimeChannel | null = null;
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
  error: null,
  items: {},
  lists: {},
  tab: 'reminders',
  reminderFilter: 'today',
  search: '',
  editor: null,
  activeListId: null,
  permissionGranted: null,

  async init() {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, authReady: true });
    supabase.auth.onAuthStateChange((_event, session) => {
      const hadUser = get().session?.user.id;
      set({ session });
      if (session && session.user.id !== hadUser) {
        get().loadAll();
      }
      if (!session) {
        teardownRealtime();
        set({ items: {}, lists: {} });
        alarms.cancel([]);
      }
    });
    if (data.session) {
      await get().loadAll();
    }
    alarms.requestPermission().then(granted => set({ permissionGranted: granted })).catch(() => set({ permissionGranted: false }));
  },

  async signIn(email, password) {
    set({ error: null, loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false, error: error?.message ?? null });
  },

  async signUp(email, password) {
    set({ error: null, loading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    set({ loading: false, error: error?.message ?? null });
    if (error) {
      return null;
    }
    return data.session ? null : 'Check your email to confirm your account, then sign in.';
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
    set({
      loading: false,
      error: error?.message ?? null,
      lists: byId((listsRes.data ?? []) as List[]),
      items: byId((itemsRes.data ?? []) as Item[]),
    });
    setupRealtime(session.user.id, set, get);
    scheduleSync(get);
  },

  setTab: tab => set({ tab, editor: null }),
  setReminderFilter: reminderFilter => set({ reminderFilter }),
  setSearch: search => set({ search }),
  openEditor: editor => set({ editor }),
  closeEditor: () => set({ editor: null }),
  setActiveList: activeListId => set({ activeListId }),

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
      set({ error: error.message });
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
      set(s => ({ items: { ...s.items, [id]: prev }, error: error.message }));
      scheduleSync(get);
      return;
    }
    set(s => ({ items: { ...s.items, [id]: data as Item } }));
  },

  async deleteItem(id) {
    const prev = get().items[id];
    set(s => {
      const items = { ...s.items };
      delete items[id];
      return { items, editor: s.editor?.kind === 'existing' && s.editor.id === id ? null : s.editor };
    });
    alarms.cancel([id, id + SNOOZE_SUFFIX]);
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error && prev) {
      set(s => ({ items: { ...s.items, [id]: prev }, error: error.message }));
      scheduleSync(get);
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
    if (item.repeat_rule !== 'none' && item.due_at) {
      const next = nextOccurrence(new Date(item.due_at), item.repeat_rule, new Date());
      await get().updateItem(id, { due_at: next.toISOString() });
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
    if (item.repeat_rule === 'none') {
      await get().updateItem(id, { due_at: fireAt.toISOString() });
      return;
    }
    await alarms.scheduleOnce(id + SNOOZE_SUFFIX, id, item.title || 'Reminder', item.body, fireAt);
  },

  async createList(name, color) {
    const session = get().session;
    if (!session) {
      return;
    }
    const sort_order = Object.keys(get().lists).length;
    const { data, error } = await supabase.from('lists').insert({ name, color, sort_order, user_id: session.user.id }).select().single();
    if (error) {
      set({ error: error.message });
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
      set(s => ({ lists: { ...s.lists, [id]: prev }, error: error.message }));
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
      return { lists, items, activeListId: s.activeListId === id ? null : s.activeListId };
    });
    const { error } = await supabase.from('lists').delete().eq('id', id);
    if (error && prev) {
      set(s => ({ lists: { ...s.lists, [id]: prev }, error: error.message }));
    }
  },

  async handleNotificationAction({ itemId, action }) {
    if (!get().items[itemId]) {
      await get().loadAll();
    }
    switch (action) {
      case 'COMPLETE':
        await get().toggleComplete(itemId);
        break;
      case 'SNOOZE_10':
        await get().snooze(itemId, 10);
        break;
      case 'SNOOZE_60':
        await get().snooze(itemId, 60);
        break;
      default:
        if (get().items[itemId]) {
          set({ tab: 'reminders', editor: { kind: 'existing', id: itemId } });
        }
    }
  },
}));

function teardownRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function setupRealtime(userId: string, set: (fn: (s: State) => Partial<State>) => void, get: () => State) {
  teardownRealtime();
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
        set(s => ({ items: { ...s.items, [item.id]: item } }));
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

export const selectItems = (s: State) => Object.values(s.items);
export const selectLists = (s: State) => Object.values(s.lists).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
export type { RepeatRule };
