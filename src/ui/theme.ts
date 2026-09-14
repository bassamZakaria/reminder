import { Platform, useColorScheme } from 'react-native';

export const isMac = Platform.OS === 'macos';

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  danger: string;
  sidebar: string;
  sidebarActive: string;
  input: string;
}

const light: Theme = {
  dark: false,
  bg: '#f2f2f7',
  card: '#ffffff',
  cardAlt: '#f9f9fb',
  text: '#111114',
  muted: '#7a7a82',
  border: '#e2e2e8',
  accent: '#ff9f0a',
  danger: '#ff3b30',
  sidebar: '#ebebf0',
  sidebarActive: '#d9d9e0',
  input: '#ffffff',
};

const dark: Theme = {
  dark: true,
  bg: '#000000',
  card: '#1c1c1e',
  cardAlt: '#2c2c2e',
  text: '#f5f5f7',
  muted: '#8e8e93',
  border: '#2c2c2e',
  accent: '#ffb340',
  danger: '#ff453a',
  sidebar: '#141416',
  sidebarActive: '#2a2a2e',
  input: '#1c1c1e',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
