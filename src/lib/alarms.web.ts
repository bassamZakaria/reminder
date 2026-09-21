import { AlertType, RepeatRule, type Note, type Reminder } from '../types';
import { addRepeat, desiredSchedules, signature, SNOOZE_SUFFIX, type ScheduleRequest } from './schedule';

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
  snoozeUntil?: number;
}
export interface AlarmFiredEvent {
  itemId: string;
  title: string;
  body: string;
}

enum PermissionState {
  Granted = 'granted',
  Denied = 'denied',
}

interface Armed {
  timer: ReturnType<typeof setTimeout>;
  sig: string;
}

const HOUR = 3600_000;
const ARM_WINDOW = 24 * HOUR;
const ICON = '/icons/icon-192.png';

export const TEST_PREFIX = 'test:';

const supported = typeof window !== 'undefined' && 'Notification' in window;
const armed = new Map<string, Armed>();
const alarmListeners = new Set<(event: AlarmFiredEvent) => void>();
let lastSync: { reminders: Reminder[]; notes: Record<string, Note> } | null = null;
let resyncTimer: ReturnType<typeof setInterval> | null = null;

function baseId(id: string): string {
  return id.endsWith(SNOOZE_SUFFIX) ? id.slice(0, -SNOOZE_SUFFIX.length) : id;
}

function disarm(id: string) {
  const entry = armed.get(id);
  if (entry) {
    clearTimeout(entry.timer);
    armed.delete(id);
  }
}

async function showNotification(req: ScheduleRequest) {
  if (!supported || Notification.permission !== PermissionState.Granted) {
    return;
  }
  const options: NotificationOptions = { body: req.body, tag: req.identifier, icon: ICON, data: { itemId: req.reminderId } };
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
  if (registration) {
    await registration.showNotification(req.title, options);
    return;
  }
  const notification = new Notification(req.title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

function fire(req: ScheduleRequest) {
  armed.delete(req.identifier);
  showNotification(req).catch(err => console.warn('notification failed', err));
  if (req.alertType === AlertType.Alarm) {
    const event: AlarmFiredEvent = { itemId: req.reminderId, title: req.title, body: req.body };
    alarmListeners.forEach(listener => listener(event));
  }
  if (req.repeat !== RepeatRule.None) {
    arm({ ...req, fireAt: addRepeat(new Date(req.fireAt), req.repeat).getTime() });
  }
}

function arm(req: ScheduleRequest, now = Date.now()) {
  disarm(req.identifier);
  const delay = req.fireAt - now;
  if (delay < 0 || delay > ARM_WINDOW) {
    return;
  }
  armed.set(req.identifier, { timer: setTimeout(() => fire(req), delay), sig: signature(req) });
}

function ensureResync() {
  if (resyncTimer) {
    return;
  }
  resyncTimer = setInterval(() => {
    if (lastSync) {
      alarms.sync(lastSync.reminders, lastSync.notes).catch(() => undefined);
    }
  }, HOUR);
}

export const alarms = {
  supported,
  isMac: false,

  async requestPermission(): Promise<boolean> {
    if (!supported) {
      return false;
    }
    if (Notification.permission === PermissionState.Granted) {
      return true;
    }
    if (Notification.permission === PermissionState.Denied) {
      return false;
    }
    return (await Notification.requestPermission()) === PermissionState.Granted;
  },

  async requestAlarmPermission(): Promise<boolean> {
    return false;
  },

  async alarmPermissionStatus(): Promise<boolean | null> {
    return null;
  },

  async nativeAlarmsSupported(): Promise<boolean> {
    return false;
  },

  onAction(_handler: (event: NotificationActionEvent) => void): () => void {
    return () => {};
  },

  onAlarmFired(handler: (event: AlarmFiredEvent) => void): () => void {
    alarmListeners.add(handler);
    return () => {
      alarmListeners.delete(handler);
    };
  },

  stopAlarmSound() {},

  async scheduleOnce(identifier: string, reminderId: string, title: string, body: string, fireAt: Date, alertType: AlertType): Promise<void> {
    if (!supported) {
      return;
    }
    arm({ identifier, reminderId, title, body, fireAt: fireAt.getTime(), repeat: RepeatRule.None, alertType });
  },

  async scheduleTest(fireAt: Date, alertType: AlertType): Promise<void> {
    if (!supported) {
      return;
    }
    const title = alertType === AlertType.Alarm ? 'Test alarm' : 'Test reminder';
    arm({
      identifier: `${TEST_PREFIX}${fireAt.getTime()}`,
      reminderId: 'test',
      title,
      body: 'Recall alerts are working in this browser.',
      fireAt: fireAt.getTime(),
      repeat: RepeatRule.None,
      alertType,
    });
  },

  async pendingIds(): Promise<string[]> {
    return [...armed.keys()];
  },

  cancel(identifiers: string[]) {
    identifiers.forEach(disarm);
  },

  cancelAll() {
    [...armed.keys()].forEach(disarm);
    lastSync = null;
  },

  ackAction(_eventId: string) {},

  async sync(reminders: Reminder[], notes: Record<string, Note>, now = new Date()): Promise<void> {
    if (!supported) {
      return;
    }
    lastSync = { reminders, notes };
    ensureResync();
    const desired = desiredSchedules(reminders, notes, now);
    const desiredIds = new Set(desired.map(d => d.identifier));
    [...armed.keys()]
      .filter(id => !id.startsWith(TEST_PREFIX) && !desiredIds.has(baseId(id)))
      .forEach(disarm);
    for (const req of desired) {
      if (armed.get(req.identifier)?.sig === signature(req)) {
        continue;
      }
      arm(req, now.getTime());
    }
  },
};
