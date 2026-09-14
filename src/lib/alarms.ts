import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { RepeatRule } from '../types';
import { desiredSchedules, signature, type ScheduleRequest } from './schedule';
import type { Item } from '../types';

interface NativeAlarms {
  requestPermission(): Promise<boolean>;
  schedule(identifier: string, itemId: string, title: string, body: string, fireAt: number, repeat: RepeatRule): Promise<void>;
  cancel(identifiers: string[]): void;
  cancelAll(): void;
  getPending(): Promise<string[]>;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

export type NotificationAction = 'COMPLETE' | 'SNOOZE_10' | 'SNOOZE_60' | string;
export interface NotificationActionEvent {
  itemId: string;
  action: NotificationAction;
}

const native: NativeAlarms | undefined = NativeModules.AlarmNotifications;
const supported = (Platform.OS === 'ios' || Platform.OS === 'macos') && !!native;

const scheduled = new Map<string, string>();

export const alarms = {
  supported,

  async requestPermission(): Promise<boolean> {
    if (!supported) {
      return false;
    }
    return native!.requestPermission();
  },

  onAction(handler: (event: NotificationActionEvent) => void): () => void {
    if (!supported) {
      return () => {};
    }
    const emitter = new NativeEventEmitter(native as never);
    const sub = emitter.addListener('notificationAction', handler);
    return () => sub.remove();
  },

  async scheduleOnce(identifier: string, itemId: string, title: string, body: string, fireAt: Date): Promise<void> {
    if (!supported) {
      return;
    }
    await native!.schedule(identifier, itemId, title, body, fireAt.getTime(), 'none');
  },

  cancel(identifiers: string[]) {
    if (!supported || identifiers.length === 0) {
      return;
    }
    native!.cancel(identifiers);
    identifiers.forEach(id => scheduled.delete(id));
  },

  async sync(items: Item[], now = new Date()): Promise<void> {
    if (!supported) {
      return;
    }
    const desired = desiredSchedules(items, now);
    const desiredIds = new Set(desired.map(d => d.identifier));
    const pending = await native!.getPending();
    const stale = pending.filter(id => !desiredIds.has(id) && !id.endsWith(':snooze'));
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
  await native!.schedule(req.identifier, req.itemId, req.title, req.body, req.fireAt, req.repeat);
}
