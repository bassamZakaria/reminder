import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { alarms } from './src/lib/alarms';
import { useStore } from './src/store/useStore';
import { AuthScreen } from './src/ui/AuthScreen';
import { Shell } from './src/ui/Shell';
import { useTheme } from './src/ui/theme';

export default function App() {
  const t = useTheme();
  const session = useStore(s => s.session);
  const authReady = useStore(s => s.authReady);

  useEffect(() => {
    useStore.getState().init();
    const unsubscribe = alarms.onAction(event => useStore.getState().handleNotificationAction(event));
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && useStore.getState().session) {
        useStore.getState().loadAll();
      }
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} />
      {!authReady ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
          <ActivityIndicator />
        </View>
      ) : session ? (
        <Shell />
      ) : (
        <AuthScreen />
      )}
    </SafeAreaProvider>
  );
}
