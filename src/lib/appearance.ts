import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export enum AppearanceMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

const STORAGE_KEY = 'recall.appearance';

export function applyAppearance(mode: AppearanceMode) {
  Appearance.setColorScheme(mode === AppearanceMode.System ? null : mode);
}

export async function loadAppearance(): Promise<AppearanceMode> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return Object.values(AppearanceMode).find(mode => mode === stored) ?? AppearanceMode.System;
}

export async function saveAppearance(mode: AppearanceMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
}
