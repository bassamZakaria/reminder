import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import config from '../../app.config.json';

type AppConfig = { supabaseUrl: string; supabaseAnonKey: string; privacyPolicyUrl?: string; supportUrl?: string; termsUrl?: string; forcePremium?: boolean };

const appConfig = config as AppConfig;

export const links = {
  privacyPolicyUrl: appConfig.privacyPolicyUrl || null,
  supportUrl: appConfig.supportUrl || null,
  termsUrl: appConfig.termsUrl || (Platform.OS === 'ios' || Platform.OS === 'macos' ? 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' : null),
  forcePremium: appConfig.forcePremium === true,
};

export const isConfigured =
  !!config.supabaseUrl && !config.supabaseUrl.includes('YOUR_PROJECT_REF') && !!config.supabaseAnonKey;

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
