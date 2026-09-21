import { Platform, useColorScheme } from 'react-native';

export const isMac = Platform.OS === 'macos';

// Text colours meet WCAG AA (4.5:1) on bg, pane and their soft tints; `check` meets 3:1 for controls.
export interface Theme {
  dark: boolean;
  bg: string;
  pane: string;
  card: string;
  hover: string;
  selected: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  accent: string;
  accentFill: string;
  onAccent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  sidebar: string;
  input: string;
  check: string;
  scrim: string;
  toast: string;
  toastText: string;
  toastAction: string;
}

const light: Theme = {
  dark: false,
  bg: '#ffffff',
  pane: '#f6f7f9',
  card: '#ffffff',
  hover: '#f0f1f4',
  selected: '#fdf1dc',
  text: '#191f28',
  textSecondary: '#4b5563',
  muted: '#6b7280',
  border: '#e2e5ea',
  accent: '#9a4a08',
  accentFill: '#f7a61b',
  onAccent: '#1f1300',
  accentSoft: '#fdf1dc',
  danger: '#c62828',
  dangerSoft: '#fdecea',
  sidebar: '#f6f7f9',
  input: '#f0f1f4',
  check: '#8a929c',
  scrim: 'rgba(15,18,24,0.38)',
  toast: '#1f2329',
  toastText: '#ffffff',
  toastAction: '#ffb63d',
};

const dark: Theme = {
  dark: true,
  bg: '#191919',
  pane: '#202020',
  card: '#242424',
  hover: '#2a2a2a',
  selected: '#3a2e18',
  text: '#f0f0f0',
  textSecondary: '#c3c7cd',
  muted: '#979ca4',
  border: '#333333',
  accent: '#ffb63d',
  accentFill: '#ffb63d',
  onAccent: '#1f1300',
  accentSoft: '#3a2e18',
  danger: '#ff6b6b',
  dangerSoft: '#3a2323',
  sidebar: '#1e1e1e',
  input: '#2a2a2a',
  check: '#6e737c',
  scrim: 'rgba(0,0,0,0.55)',
  toast: '#f0f0f0',
  toastText: '#191919',
  toastAction: '#9a4a08',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
