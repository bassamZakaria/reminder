export enum RepeatRule {
  None = 'none',
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Yearly = 'yearly',
}

export enum AlertType {
  Notification = 'notification',
  Alarm = 'alarm',
}

export enum ViewKind {
  All = 'all',
  Folder = 'folder',
  Settings = 'settings',
}

export enum ListFilter {
  All = 'all',
  Reminders = 'reminders',
  Done = 'done',
}

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
  alert_type: AlertType;
  is_completed: boolean;
  completed_at: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export type View = { kind: ViewKind.All } | { kind: ViewKind.Folder; id: string } | { kind: ViewKind.Settings };

export const REPEAT_RULES: RepeatRule[] = Object.values(RepeatRule);

export const REPEAT_LABELS: Record<RepeatRule, string> = {
  [RepeatRule.None]: 'Never',
  [RepeatRule.Hourly]: 'Hourly',
  [RepeatRule.Daily]: 'Daily',
  [RepeatRule.Weekly]: 'Weekly',
  [RepeatRule.Monthly]: 'Monthly',
  [RepeatRule.Yearly]: 'Yearly',
};

export const LIST_COLORS = ['#f7b500', '#ff3b30', '#ff9500', '#34c759', '#007aff', '#5856d6', '#af52de', '#ff2d55', '#8e8e93'];
