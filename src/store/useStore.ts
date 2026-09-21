import { useMemo } from 'react';
import { create } from 'zustand';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AppearanceMode, applyAppearance, loadAppearance, saveAppearance } from '../lib/appearance';
import { alarms, NotificationAction, type AlarmFiredEvent, type NotificationActionEvent } from '../lib/alarms';
import { nextAfterCompletion, noteHeadline, SNOOZE_SUFFIX } from '../lib/schedule';
import { AlertType, RepeatRule, ViewKind, type List, type Note, type Reminder, type View } from '../types';

export enum EditorKind {
  Existing = 'existing',
  New = 'new',
}

export type EditorTarget = { kind: EditorKind.Existing; id: string; focusReminderId?: string; addReminder?: boolean } | { kind: EditorKind.New; listId: string | null; nonce: number; withReminder?: boolean } | null;

export type NoteInput = Partial<Pick<Note, 'title' | 'body' | 'list_id' | 'is_pinned'>>;
export type ReminderInput = Pick<Reminder, 'due_at'> & Partial<Pick<Reminder, 'repeat_rule' | 'alert_type'>>;

enum RealtimeEvent {
  Delete = 'DELETE',
}

enum Table {
  Notes = 'notes',
  Reminders = 'reminders',
  Lists = 'lists',
}

export interface Toast {
  id: number;
  message: string;
  undo?: { note?: Note; reminders: Reminder[] };
}

interface State {
  session: Session | null;
  authReady: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  toast: Toast | null;
  notes: Record<string, Note>;
  reminders: Record<string, Reminder>;
  lists: Record<string, List>;
  view: View;
  search: string;
  editor: EditorTarget;
  permissionGranted: boolean | null;
  alarmPermission: boolean | null;
  nativeAlarms: boolean;
  activeAlarm: AlarmFiredEvent | null;
  appearance: AppearanceMode;

  init(): Promise<void>;
  setAppearance(mode: AppearanceMode): void;
  info: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<boolean>;
  requestNotificationPermission(): void;
  loadAll(): Promise<void>;
  refresh(): Promise<void>;
  clearError(): void;
  showToast(message: string, undo?: Toast['undo']): void;
  dismissToast(): void;
  undoDelete(): Promise<void>;
  setView(view: View): void;
  setSearch(search: string): void;
  openEditor(target: EditorTarget): void;
  closeEditor(): void;
  onAlarmFired(event: AlarmFiredEvent): void;
  dismissAlarm(): void;
  snoozeAlarm(minutes: number): Promise<void>;
  requestAlarmPermission(): Promise<void>;
  createNote(input: NoteInput): Promise<Note | null>;
  updateNote(id: string, patch: NoteInput): Promise<void>;
  deleteNote(id: string, silent?: boolean): Promise<void>;
  togglePin(id: string): Promise<void>;
  createReminder(noteId: string, input: ReminderInput): Promise<Reminder | null>;
  updateReminder(id: string, patch: Partial<Pick<Reminder, 'due_at' | 'repeat_rule' | 'alert_type' | 'is_completed' | 'completed_at'>>): Promise<void>;
  deleteReminder(id: string): Promise<void>;
  completeReminder(id: string): Promise<void>;
  snoozeReminder(id: string, minutes: number, until?: number): Promise<void>;
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
    const { reminders, notes } = get();
    alarms.sync(Object.values(reminders), notes).catch(err => console.warn('alarm sync failed', err));
  }, 150);
}

function byId<T extends { id: string }>(rows: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const row of rows) {
    out[row.id] = row;
  }
  return out;
}

function without<T>(record: Record<string, T>, ids: string[]): Record<string, T> {
  const out = { ...record };
  for (const id of ids) {
    delete out[id];
  }
  return out;
}

function reminderIdsOf(reminders: Record<string, Reminder>, noteId: string): string[] {
  return Object.values(reminders)
    .filter(r => r.note_id === noteId)
    .map(r => r.id);
}

function alarmIds(reminderIds: string[]): string[] {
  return reminderIds.flatMap(id => [id, id + SNOOZE_SUFFIX]);
}

export function friendlyError(message: string): string {
  if (/network request failed|failed to fetch|load failed/i.test(message)) {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Wrong email or password.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email first: open the link we sent you, then sign in.';
  }
  if (/already registered/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/password should be at least/i.test(message)) {
    return 'Use a password with at least 6 characters.';
  }
  if (/issued at future/i.test(message)) {
    return 'This device’s clock is out of sync. Turn on “Set time automatically”, then retry.';
  }
  if (/jwt expired|refresh token/i.test(message)) {
    return 'Your session expired. Please sign in again.';
  }
  return message;
}

function requestNotificationPermission(set: (partial: Partial<State>) => void) {
  alarms
    .requestPermission()
    .then(granted => set({ permissionGranted: granted }))
    .catch(() => set({ permissionGranted: false }));
}

export const useStore = create<State>((set, get) => ({
  session: null,
  authReady: false,
  loading: false,
  refreshing: false,
  error: null,
  info: null,
  toast: null,
  notes: {},
  reminders: {},
  lists: {},
  view: { kind: ViewKind.Reminders },
  search: '',
  editor: null,
  permissionGranted: null,
  alarmPermission: null,
  nativeAlarms: false,
  activeAlarm: null,
  appearance: AppearanceMode.System,

  setAppearance(mode) {
    applyAppearance(mode);
    set({ appearance: mode });
    saveAppearance(mode);
  },

  async init() {
    loadAppearance().then(mode => {
      applyAppearance(mode);
      set({ appearance: mode });
    });
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, authReady: true });
    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        const hadUser = get().session?.user.id;
        set({ session });
        if (session && session.user.id !== hadUser) {
          resetReady();
          get().loadAll().then(markReady);
        }
        if (!session) {
          teardownRealtime();
          set({ notes: {}, reminders: {}, lists: {}, editor: null, view: { kind: ViewKind.Reminders }, activeAlarm: null, toast: null, error: null, permissionGranted: null });
          alarms.cancelAll();
          resetReady();
        }
      }, 0);
    });
    if (data.session) {
      await get().loadAll();
    }
    markReady();
    alarms
      .nativeAlarmsSupported()
      .then(nativeAlarms => set({ nativeAlarms }))
      .catch(() => set({ nativeAlarms: false }));
    alarms
      .alarmPermissionStatus()
      .then(alarmPermission => alarmPermission !== null && set({ alarmPermission }))
      .catch(() => undefined);
  },

  async requestAlarmPermission() {
    const granted = await alarms.requestAlarmPermission().catch(() => false);
    set({ alarmPermission: granted });
    scheduleSync(get);
  },

  async signIn(email, password) {
    set({ error: null, info: null, loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false, error: error ? friendlyError(error.message) : null });
  },

  async signUp(email, password) {
    set({ error: null, info: null, loading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ loading: false, error: friendlyError(error.message) });
      return;
    }
    set({ loading: false, info: data.session ? null : `We sent a confirmation link to ${email}. Open it, then sign in.` });
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  requestNotificationPermission: () => requestNotificationPermission(set),

  async deleteAccount() {
    const { error } = await supabase.rpc('delete_account');
    if (error) {
      set({ error: friendlyError(error.message) });
      return false;
    }
    await supabase.auth.signOut({ scope: 'local' });
    return true;
  },

  async loadAll() {
    const session = get().session;
    if (!session) {
      return;
    }
    set({ loading: true, error: null });
    const [listsRes, notesRes, remindersRes] = await Promise.all([
      supabase.from(Table.Lists).select('*').order('sort_order').order('created_at'),
      supabase.from(Table.Notes).select('*').order('updated_at', { ascending: false }),
      supabase.from(Table.Reminders).select('*').order('due_at'),
    ]);
    const error = listsRes.error ?? notesRes.error ?? remindersRes.error;
    if (error) {
      set({ loading: false, error: friendlyError(error.message) });
      return;
    }
    set({
      loading: false,
      error: null,
      lists: byId((listsRes.data ?? []) as List[]),
      notes: byId((notesRes.data ?? []) as Note[]),
      reminders: byId((remindersRes.data ?? []) as Reminder[]),
    });
    setupRealtime(session.user.id, set, get);
    scheduleSync(get);
    if (get().permissionGranted === null && Object.values(get().reminders).some(r => !r.is_completed)) {
      requestNotificationPermission(set);
    }
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
  showToast: (message, undo) => set({ toast: { id: Date.now(), message, undo } }),
  dismissToast: () => set({ toast: null }),

  async undoDelete() {
    const undo = get().toast?.undo;
    set({ toast: null });
    if (!undo) {
      return;
    }
    const { note, reminders } = undo;
    set(s => ({ notes: note ? { ...s.notes, [note.id]: note } : s.notes, reminders: { ...s.reminders, ...byId(reminders) } }));
    const noteRes = note ? await supabase.from(Table.Notes).insert(note) : null;
    const reminderRes = noteRes?.error || reminders.length === 0 ? null : await supabase.from(Table.Reminders).insert(reminders);
    const error = noteRes?.error ?? reminderRes?.error;
    if (error) {
      set(s => ({ notes: note ? without(s.notes, [note.id]) : s.notes, reminders: without(s.reminders, reminders.map(r => r.id)), error: friendlyError(error.message) }));
      return;
    }
    scheduleSync(get);
  },

  setView: view => set({ view, search: '' }),
  setSearch: search => set({ search }),
  openEditor: editor => set({ editor }),
  closeEditor: () => set({ editor: null }),
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
      await get().snoozeReminder(active.itemId, minutes);
    }
  },

  async createNote(input) {
    const session = get().session;
    if (!session) {
      return null;
    }
    const { data, error } = await supabase
      .from(Table.Notes)
      .insert({ ...input, user_id: session.user.id })
      .select()
      .single();
    if (error) {
      set({ error: friendlyError(error.message) });
      return null;
    }
    const note = data as Note;
    set(s => ({ notes: { ...s.notes, [note.id]: note } }));
    return note;
  },

  async updateNote(id, patch) {
    const prev = get().notes[id];
    if (!prev) {
      return;
    }
    set(s => ({ notes: { ...s.notes, [id]: { ...prev, ...patch, updated_at: new Date().toISOString() } } }));
    scheduleSync(get);
    const { data, error } = await supabase.from(Table.Notes).update(patch).eq('id', id).select().single();
    if (error) {
      set(s => ({ notes: { ...s.notes, [id]: prev }, error: friendlyError(error.message) }));
      scheduleSync(get);
      return;
    }
    set(s => ({ notes: { ...s.notes, [id]: data as Note } }));
  },

  async deleteNote(id, silent) {
    const prev = get().notes[id];
    const reminderIds = reminderIdsOf(get().reminders, id);
    const prevReminders = reminderIds.map(rid => get().reminders[rid]);
    set(s => ({
      notes: without(s.notes, [id]),
      reminders: without(s.reminders, reminderIds),
      editor: s.editor?.kind === EditorKind.Existing && s.editor.id === id ? null : s.editor,
    }));
    alarms.cancel(alarmIds(reminderIds));
    const { error } = await supabase.from(Table.Notes).delete().eq('id', id);
    if (error && prev) {
      set(s => ({ notes: { ...s.notes, [id]: prev }, reminders: { ...s.reminders, ...byId(prevReminders) }, error: friendlyError(error.message) }));
      scheduleSync(get);
      return;
    }
    if (prev && !silent) {
      get().showToast(`Deleted “${noteHeadline(prev) === 'Reminder' ? 'note' : noteHeadline(prev)}”`, { note: prev, reminders: prevReminders });
    }
  },

  async togglePin(id) {
    const note = get().notes[id];
    if (note) {
      await get().updateNote(id, { is_pinned: !note.is_pinned });
    }
  },

  async createReminder(noteId, input) {
    const session = get().session;
    if (!session) {
      return null;
    }
    const row = { repeat_rule: RepeatRule.None, alert_type: AlertType.Notification, ...input, note_id: noteId, user_id: session.user.id };
    const { data, error } = await supabase.from(Table.Reminders).insert(row).select().single();
    if (error) {
      set({ error: friendlyError(error.message) });
      return null;
    }
    const reminder = data as Reminder;
    set(s => ({ reminders: { ...s.reminders, [reminder.id]: reminder } }));
    if (get().permissionGranted === null) {
      requestNotificationPermission(set);
    }
    scheduleSync(get);
    return reminder;
  },

  async updateReminder(id, patch) {
    const prev = get().reminders[id];
    if (!prev) {
      return;
    }
    set(s => ({ reminders: { ...s.reminders, [id]: { ...prev, ...patch, updated_at: new Date().toISOString() } } }));
    scheduleSync(get);
    const { data, error } = await supabase.from(Table.Reminders).update(patch).eq('id', id).select().single();
    if (error) {
      set(s => ({ reminders: { ...s.reminders, [id]: prev }, error: friendlyError(error.message) }));
      scheduleSync(get);
      return;
    }
    set(s => ({ reminders: { ...s.reminders, [id]: data as Reminder } }));
  },

  async deleteReminder(id) {
    const prev = get().reminders[id];
    set(s => ({ reminders: without(s.reminders, [id]) }));
    alarms.cancel(alarmIds([id]));
    const { error } = await supabase.from(Table.Reminders).delete().eq('id', id);
    if (error && prev) {
      set(s => ({ reminders: { ...s.reminders, [id]: prev }, error: friendlyError(error.message) }));
      scheduleSync(get);
      return;
    }
    if (prev) {
      get().showToast('Reminder deleted', { reminders: [prev] });
    }
  },

  async completeReminder(id) {
    const reminder = get().reminders[id];
    if (!reminder) {
      return;
    }
    if (reminder.is_completed) {
      await get().updateReminder(id, { is_completed: false, completed_at: null });
      return;
    }
    alarms.cancel([id + SNOOZE_SUFFIX]);
    if (reminder.repeat_rule !== RepeatRule.None) {
      const next = nextAfterCompletion(reminder, new Date());
      await get().updateReminder(id, { due_at: next.toISOString() });
      get().showToast(`Next: ${next.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
      return;
    }
    await get().updateReminder(id, { is_completed: true, completed_at: new Date().toISOString() });
  },

  async snoozeReminder(id, minutes, until) {
    const reminder = get().reminders[id];
    if (!reminder) {
      return;
    }
    const fireAt = new Date(until ?? Date.now() + minutes * 60_000);
    if (reminder.repeat_rule === RepeatRule.None) {
      await get().updateReminder(id, { due_at: fireAt.toISOString(), is_completed: false, completed_at: null });
    } else {
      const note = get().notes[reminder.note_id];
      await alarms.scheduleOnce(id + SNOOZE_SUFFIX, id, noteHeadline(note), note?.title ? note.body : '', fireAt, reminder.alert_type);
    }
    get().showToast(`Snoozed until ${fireAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
  },

  async createList(name, color) {
    const session = get().session;
    if (!session) {
      return;
    }
    const sort_order = Object.keys(get().lists).length;
    const { data, error } = await supabase.from(Table.Lists).insert({ name, color, sort_order, user_id: session.user.id }).select().single();
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
    const { error } = await supabase.from(Table.Lists).update(patch).eq('id', id);
    if (error) {
      set(s => ({ lists: { ...s.lists, [id]: prev }, error: friendlyError(error.message) }));
    }
  },

  async deleteList(id) {
    const prev = get().lists[id];
    set(s => {
      const notes = { ...s.notes };
      for (const note of Object.values(notes)) {
        if (note.list_id === id) {
          notes[note.id] = { ...note, list_id: null };
        }
      }
      return { lists: without(s.lists, [id]), notes, view: s.view.kind === ViewKind.Folder && s.view.id === id ? { kind: ViewKind.Notes } : s.view };
    });
    const { error } = await supabase.from(Table.Lists).delete().eq('id', id);
    if (error && prev) {
      set(s => ({ lists: { ...s.lists, [id]: prev }, error: friendlyError(error.message) }));
    }
  },

  async handleNotificationAction({ itemId, action, eventId, snoozeUntil }) {
    try {
      if (action === NotificationAction.Dismiss) {
        return;
      }
      await ready;
      if (!get().session) {
        return;
      }
      if (!get().reminders[itemId]) {
        await get().loadAll();
      }
      switch (action) {
        case NotificationAction.Complete:
          await get().completeReminder(itemId);
          break;
        case NotificationAction.Snooze10:
          await get().snoozeReminder(itemId, 10, snoozeUntil);
          break;
        case NotificationAction.Snooze60:
          await get().snoozeReminder(itemId, 60, snoozeUntil);
          break;
        case NotificationAction.Open: {
          const reminder = get().reminders[itemId];
          if (reminder) {
            set({ editor: { kind: EditorKind.Existing, id: reminder.note_id, focusReminderId: reminder.id } });
          }
          break;
        }
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

function teardownRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
    channelUserId = null;
  }
}

type Rows = Record<Table, Record<string, { id: string; updated_at: string }>>;

function applyChange<T extends { id: string; updated_at: string }>(
  table: Table,
  payload: { eventType: string; new: unknown; old: unknown },
  set: (fn: (s: State) => Partial<State>) => void,
) {
  if (payload.eventType === RealtimeEvent.Delete) {
    const id = (payload.old as { id: string }).id;
    set(s => ({ [table]: without((s as unknown as Rows)[table], [id]) }) as Partial<State>);
    return id;
  }
  const row = payload.new as T;
  set(s => {
    const rows = (s as unknown as Rows)[table];
    const current = rows[row.id];
    if (current && current.updated_at > row.updated_at) {
      return {};
    }
    return { [table]: { ...rows, [row.id]: row } } as Partial<State>;
  });
  return null;
}

function setupRealtime(userId: string, set: (fn: (s: State) => Partial<State>) => void, get: () => State) {
  if (channel && channelUserId === userId) {
    return;
  }
  teardownRealtime();
  channelUserId = userId;
  const filter = `user_id=eq.${userId}`;
  channel = supabase
    .channel(`user-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: Table.Notes, filter }, payload => {
      const deletedId = applyChange<Note>(Table.Notes, payload, set);
      if (deletedId) {
        const ids = reminderIdsOf(get().reminders, deletedId);
        set(s => ({ reminders: without(s.reminders, ids) }));
        alarms.cancel(alarmIds(ids));
      }
      scheduleSync(get);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: Table.Reminders, filter }, payload => {
      const deletedId = applyChange<Reminder>(Table.Reminders, payload, set);
      if (deletedId) {
        alarms.cancel(alarmIds([deletedId]));
      }
      scheduleSync(get);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: Table.Lists, filter }, payload => {
      applyChange<List>(Table.Lists, payload, set);
    })
    .subscribe();
}

export function useNotes(): Note[] {
  const notes = useStore(s => s.notes);
  return useMemo(() => Object.values(notes), [notes]);
}

export function useReminders(): Reminder[] {
  const reminders = useStore(s => s.reminders);
  return useMemo(() => Object.values(reminders), [reminders]);
}

export function useLists(): List[] {
  const lists = useStore(s => s.lists);
  return useMemo(() => Object.values(lists).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)), [lists]);
}
