import 'react-native-url-polyfill/auto';

import { Env } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Validate environment variables
if (!Env.SUPABASE_URL || !Env.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with latest best practices
export const supabase = createClient(Env.SUPABASE_URL, Env.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Export types for TypeScript
export type Database = any; // TODO: Generate types with `supabase gen types typescript`
