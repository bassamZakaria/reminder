import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { AlertType, Item, RepeatRule } from '../types';
import { desiredSchedules, signature, SNOOZE_SUFFIX, type ScheduleRequest } from './schedule';

interface NativeAlarms {
  requestPermission(): Promise<boolean>;
  requestAlarmPermission(): Promise<boolean>;
  alarmsSupported(): Promise<boolean>;
  schedule(identifier: string, itemId: string, title: string, body: string, fireAt: number, repeat: RepeatRule, alertType: AlertType): Promise<void>;
  cancel(identifiers: string[]): void;
  cancelAll(): void;
  getPending(): Promise<string[]>;
  ackAction(eventId: string): void;
  stopAlarmSound(): void;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

export type NotificationAction = 'COMPLETE' | 'SNOOZE_10' | 'SNOOZE_60' | string;
export interface NotificationActionEvent {
  eventId?: string;
  itemId: string;
  action: NotificationAction;
}
export interface AlarmFiredEvent {
  itemId: string;
  title: string;
  body: string;
}
export const DEFAULT_ACTION = 'com.apple.UNNotificationDefaultActionIdentifier';
export const DISMISS_ACTION = 'com.apple.UNNotificationDismissActionIdentifier';

const native: NativeAlarms | undefined = NativeModules.AlarmNotifications;
const supported = (Platform.OS === 'ios' || Platform.OS === 'macos') && !!native;
const emitter = supported ? new NativeEventEmitter(native as never) : null;

const scheduled = new Map<string, string>();

export const alarms = {
  supported,
  isMac: Platform.OS === 'macos',

  async requestPermission(): Promise<boolean> {
    return supported ? native!.requestPermission() : false;
  },

  async requestAlarmPermission(): Promise<boolean> {
    return supported ? native!.requestAlarmPermission() : false;
  },

  async nativeAlarmsSupported(): Promise<boolean> {
    return supported ? native!.alarmsSupported() : false;
  },

  onAction(handler: (event: NotificationActionEvent) => void): () => void {
    if (!emitter) {
      return () => {};
    }
    const sub = emitter.addListener('notificationAction', handler);
    return () => sub.remove();
  },

  onAlarmFired(handler: (event: AlarmFiredEvent) => void): () => void {
    if (!emitter) {
      return () => {};
    }
    const sub = emitter.addListener('alarmFired', handler);
    return () => sub.remove();
  },

  stopAlarmSound() {
    if (supported) {
      native!.stopAlarmSound();
    }
  },

  async scheduleOnce(identifier: string, itemId: string, title: string, body: string, fireAt: Date, alertType: AlertType): Promise<void> {
    if (!supported) {
      return;
    }
    await native!.schedule(identifier, itemId, title, body, fireAt.getTime(), 'none', alertType);
  },

  async pendingIds(): Promise<string[]> {
    return supported ? native!.getPending() : [];
  },

  cancel(identifiers: string[]) {
    if (!supported || identifiers.length === 0) {
      return;
    }
    native!.cancel(identifiers);
    identifiers.forEach(id => scheduled.delete(id));
  },

  cancelAll() {
    scheduled.clear();
    if (supported) {
      native!.cancelAll();
    }
  },

  ackAction(eventId: string) {
    if (supported && eventId) {
      native!.ackAction(eventId);
    }
  },

  async sync(items: Item[], now = new Date()): Promise<void> {
    if (!supported) {
      return;
    }
    const desired = desiredSchedules(items, now);
    const desiredIds = new Set(desired.map(d => d.identifier));
    const pending = await native!.getPending();
    const stale = pending.filter(id => !desiredIds.has(id.endsWith(SNOOZE_SUFFIX) ? id.slice(0, -SNOOZE_SUFFIX.length) : id));
    if (stale.length) {
      native!.cancel(stale);
      stale.forEach(id => scheduled.delete(id));
    }
    const pendingSet = new Set(pending);
    for (const req of desired) {
      const sig = signature(req);
      if (scheduled.get(req.identifier) === sig && pendingSet.has(req.identifier)) {
        continue;
      }
      await scheduleRequest(req);
      scheduled.set(req.identifier, sig);
    }
  },
};

async function scheduleRequest(req: ScheduleRequest) {
  await native!.schedule(req.identifier, req.itemId, req.title, req.body, req.fireAt, req.repeat, req.alertType);
}
