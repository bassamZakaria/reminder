import { Platform, useColorScheme } from 'react-native';

export const isMac = Platform.OS === 'macos';

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
  accentSoft: string;
  danger: string;
  success: string;
  sidebar: string;
  input: string;
  check: string;
}

const light: Theme = {
  dark: false,
  bg: '#ffffff',
  pane: '#f6f7f9',
  card: '#ffffff',
  hover: '#f2f3f5',
  selected: '#e8eefc',
  text: '#191f28',
  textSecondary: '#5b6472',
  muted: '#9aa3ae',
  border: '#e6e8ec',
  accent: '#4772fa',
  accentSoft: '#e8eefc',
  danger: '#e53935',
  success: '#2fb344',
  sidebar: '#f6f7f9',
  input: '#f2f3f5',
  check: '#c4c9d1',
};

const dark: Theme = {
  dark: true,
  bg: '#191919',
  pane: '#202020',
  card: '#242424',
  hover: '#2a2a2a',
  selected: '#2c3550',
  text: '#f0f0f0',
  textSecondary: '#b0b4bb',
  muted: '#7a7f88',
  border: '#303030',
  accent: '#5b83ff',
  accentSoft: '#26325a',
  danger: '#ff5c5c',
  success: '#4cd964',
  sidebar: '#1e1e1e',
  input: '#2a2a2a',
  check: '#4a4f58',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
