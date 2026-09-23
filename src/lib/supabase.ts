import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import config from '../../app.config.json';

type AppConfig = { supabaseUrl: string; supabaseAnonKey: string; privacyPolicyUrl?: string; supportUrl?: string; termsUrl?: string; webUrl?: string; forcePremium?: boolean };

const appConfig = config as AppConfig;

const LOCAL_SERVER = /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2|\[::1\])(:|\/|$)/;

export const links = {
  privacyPolicyUrl: appConfig.privacyPolicyUrl || null,
  supportUrl: appConfig.supportUrl || null,
  termsUrl: appConfig.termsUrl || (Platform.OS === 'ios' || Platform.OS === 'macos' ? 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' : null),
  webUrl: appConfig.webUrl || null,
  // forcePremium unlocks every paid feature; it is only honoured against a local test server so a
  // release build pointed at the cloud project can never ship with Premium given away.
  forcePremium: appConfig.forcePremium === true && LOCAL_SERVER.test(appConfig.supabaseUrl || ''),
};

export const isConfigured =
  !!config.supabaseUrl && !config.supabaseUrl.includes('YOUR_PROJECT_REF') && !!config.supabaseAnonKey;

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
