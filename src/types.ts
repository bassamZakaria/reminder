export type RepeatRule = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface List {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  list_id: string | null;
  title: string;
  body: string;
  due_at: string | null;
  repeat_rule: RepeatRule;
  is_completed: boolean;
  completed_at: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type Tab = 'notes' | 'reminders' | 'lists' | 'settings';
export type ReminderFilter = 'today' | 'scheduled' | 'all' | 'done';

export const REPEAT_RULES: RepeatRule[] = ['none', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'];
export const LIST_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280'];
