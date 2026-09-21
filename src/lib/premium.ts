import { AlertType, RepeatRule, type Reminder } from '../types';

export const FREE_REMINDER_LIMIT = 10;
export const TRIAL_DAYS = 14;

export enum PremiumFeature {
  UnlimitedReminders = 'unlimited-reminders',
  Alarms = 'alarms',
  Repeat = 'repeat',
  Folders = 'folders',
}

export const PREMIUM_FEATURES: { feature: PremiumFeature; icon: string; title: string; detail: string }[] = [
  { feature: PremiumFeature.UnlimitedReminders, icon: '♾️', title: 'Unlimited reminders', detail: `Free includes ${FREE_REMINDER_LIMIT} active reminders.` },
  { feature: PremiumFeature.Alarms, icon: '⏰', title: 'Ringing alarms', detail: 'Reminders that ring until you stop them.' },
  { feature: PremiumFeature.Repeat, icon: '↻', title: 'Repeating reminders', detail: 'Hourly, daily, weekly, monthly or yearly.' },
  { feature: PremiumFeature.Folders, icon: '🗂️', title: 'Folders', detail: 'Organise notes into colour-coded folders.' },
];

export function openReminderCount(reminders: Reminder[]): number {
  return reminders.filter(r => !r.is_completed).length;
}

export function canAddReminder(reminders: Reminder[], premium: boolean): boolean {
  return premium || openReminderCount(reminders) < FREE_REMINDER_LIMIT;
}

export function blockedFeature(patch: { alert_type?: AlertType; repeat_rule?: RepeatRule }, premium: boolean): PremiumFeature | null {
  if (premium) {
    return null;
  }
  if (patch.alert_type === AlertType.Alarm) {
    return PremiumFeature.Alarms;
  }
  if (patch.repeat_rule && patch.repeat_rule !== RepeatRule.None) {
    return PremiumFeature.Repeat;
  }
  return null;
}
