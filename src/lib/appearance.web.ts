import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export enum AppearanceMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

type Scheme = AppearanceMode.Light | AppearanceMode.Dark;
type Listener = Parameters<typeof Appearance.addChangeListener>[0];

const STORAGE_KEY = 'recall.appearance';

const systemScheme = Appearance.getColorScheme.bind(Appearance);
const systemAddListener = Appearance.addChangeListener.bind(Appearance);
const listeners = new Set<Listener>();
let override: Scheme | null = null;

// react-native-web's Appearance has no setColorScheme, so its getter and listener registry are
// wrapped here; useColorScheme reads through them, so this module must load before first render.
Appearance.getColorScheme = () => override ?? systemScheme();
Appearance.addChangeListener = listener => {
  listeners.add(listener);
  const sub = systemAddListener(preferences => {
    if (!override) {
      listener(preferences);
    }
  });
  return {
    remove() {
      listeners.delete(listener);
      sub.remove();
    },
  } as ReturnType<typeof Appearance.addChangeListener>;
};

export function applyAppearance(mode: AppearanceMode) {
  override = mode === AppearanceMode.System ? null : mode;
  const colorScheme = Appearance.getColorScheme() ?? AppearanceMode.Light;
  if (typeof document !== 'undefined') {
    document.documentElement.style.colorScheme = override ?? 'light dark';
  }
  listeners.forEach(listener => listener({ colorScheme }));
}

export async function loadAppearance(): Promise<AppearanceMode> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return Object.values(AppearanceMode).find(mode => mode === stored) ?? AppearanceMode.System;
}

export async function saveAppearance(mode: AppearanceMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
}
