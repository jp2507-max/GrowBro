import 'react-native-url-polyfill/auto';

// Import a client-safe env export. We assume the client-only env lives in `src/lib/env.js`
// and is reachable via the project's absolute import aliases. This avoids pulling any
// build-time/server secrets into the client bundle. If your project uses a different
// convention (for example `@env/client`), adjust this import accordingly and ensure
// your bundler alias for `@env` resolves to the client-only export.
import { Env } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Determine if we're running in a test environment
const isTestEnvironment =
  typeof process !== 'undefined' &&
  process.env &&
  (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);

// Validate environment variables and set up Supabase configuration
let supabaseUrl: string;
let supabaseAnonKey: string;

const runtimeEnv =
  typeof process !== 'undefined' && process.env ? process.env : undefined;

const expoExtra =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ??
  (Constants.manifest2?.extra as Record<string, unknown> | undefined) ??
  {};

const pickFirstString = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
};

if (isTestEnvironment) {
  // Use dummy values for tests
  supabaseUrl = 'http://localhost';
  supabaseAnonKey = 'test-key';
} else {
  // In production/staging/development, require real environment variables
  const resolvedSupabaseUrl = pickFirstString(
    Env?.SUPABASE_URL,
    (Env as any)?.EXPO_PUBLIC_SUPABASE_URL,
    expoExtra?.SUPABASE_URL,
    expoExtra?.EXPO_PUBLIC_SUPABASE_URL,
    runtimeEnv?.EXPO_PUBLIC_SUPABASE_URL,
    runtimeEnv?.SUPABASE_URL
  );

  const resolvedSupabaseAnonKey = pickFirstString(
    Env?.SUPABASE_ANON_KEY,
    (Env as any)?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    expoExtra?.SUPABASE_ANON_KEY,
    expoExtra?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    runtimeEnv?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    runtimeEnv?.SUPABASE_ANON_KEY
  );

  if (!resolvedSupabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!resolvedSupabaseAnonKey) {
    throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
  }
  supabaseUrl = resolvedSupabaseUrl;
  supabaseAnonKey = resolvedSupabaseAnonKey;
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
