import { useWindowDimensions } from 'react-native';
import { isMac } from './theme';

export const WIDE_MIN_WIDTH = 820;

// Width is read per render so iPads, Android tablets, split view and browser resizing switch layout live.
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return isMac || width >= WIDE_MIN_WIDTH;
}
