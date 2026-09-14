import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import config from '../../app.config.json';

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
