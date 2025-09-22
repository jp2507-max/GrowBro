import 'react-native-url-polyfill/auto';

// Import a client-safe env export. We assume the client-only env lives in `src/lib/env.js`
// and is reachable via the project's absolute import aliases. This avoids pulling any
// build-time/server secrets into the client bundle. If your project uses a different
// convention (for example `@env/client`), adjust this import accordingly and ensure
// your bundler alias for `@env` resolves to the client-only export.
import { Env as ClientEnv } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Determine if we're running in a test environment
const isTestEnvironment =
  typeof process !== 'undefined' &&
  process.env &&
  (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);

// Validate environment variables and set up Supabase configuration
let supabaseUrl: string;
let supabaseAnonKey: string;

if (isTestEnvironment) {
  // Use dummy values for tests
  supabaseUrl = 'http://localhost';
  supabaseAnonKey = 'test-key';
} else {
  // In production/staging/development, require real environment variables
  if (!ClientEnv.SUPABASE_URL && (ClientEnv as any).EXPO_PUBLIC_SUPABASE_URL) {
    // Fallback to public-prefixed keys if only those are present in extra
    (ClientEnv as any).SUPABASE_URL = (
      ClientEnv as any
    ).EXPO_PUBLIC_SUPABASE_URL;
  }
  if (
    !ClientEnv.SUPABASE_ANON_KEY &&
    (ClientEnv as any).EXPO_PUBLIC_SUPABASE_ANON_KEY
  ) {
    (ClientEnv as any).SUPABASE_ANON_KEY = (
      ClientEnv as any
    ).EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }

  if (!ClientEnv.SUPABASE_URL) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!ClientEnv.SUPABASE_ANON_KEY) {
    throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
  }
  supabaseUrl = ClientEnv.SUPABASE_URL;
  supabaseAnonKey = ClientEnv.SUPABASE_ANON_KEY;
}

// Create Supabase client with latest best practices
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-gdpr-compliant': 'true',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Export types for TypeScript
export type Database = any; // TODO: Generate types with `supabase gen types typescript`
