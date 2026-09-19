import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { AlertType, RepeatRule, type Item } from '../types';
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

export enum NotificationAction {
  Complete = 'COMPLETE',
  Snooze10 = 'SNOOZE_10',
  Snooze60 = 'SNOOZE_60',
  Open = 'com.apple.UNNotificationDefaultActionIdentifier',
  Dismiss = 'com.apple.UNNotificationDismissActionIdentifier',
}
export interface NotificationActionEvent {
  eventId?: string;
  itemId: string;
  action: string;
}
export interface AlarmFiredEvent {
  itemId: string;
  title: string;
  body: string;
}

const native: NativeAlarms | undefined = NativeModules.AlarmNotifications;
const supported = (Platform.OS === 'ios' || Platform.OS === 'macos') && !!native;
const emitter = supported ? new NativeEventEmitter(native as never) : null;

const scheduled = new Map<string, string>();

export const TEST_PREFIX = 'test:';

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
    await native!.schedule(identifier, itemId, title, body, fireAt.getTime(), RepeatRule.None, alertType);
  },

  async scheduleTest(fireAt: Date, alertType: AlertType): Promise<void> {
    if (!supported) {
      return;
    }
    const title = alertType === AlertType.Alarm ? 'Test alarm' : 'Test reminder';
    await native!.schedule(`${TEST_PREFIX}${fireAt.getTime()}`, 'test', title, 'Recall alerts are working on this device.', fireAt.getTime(), RepeatRule.None, alertType);
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
    const stale = pending.filter(id => !id.startsWith(TEST_PREFIX) && !desiredIds.has(id.endsWith(SNOOZE_SUFFIX) ? id.slice(0, -SNOOZE_SUFFIX.length) : id));
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
