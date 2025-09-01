import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Import a client-safe env export. We assume the client-only env lives in `src/lib/env.js`
// and is reachable via the project's absolute import aliases. This avoids pulling any
// build-time/server secrets into the client bundle. If your project uses a different
// convention (for example `@env/client`), adjust this import accordingly and ensure
// your bundler alias for `@env` resolves to the client-only export.
import { Env as ClientEnv } from '@/lib/env';

// Validate environment variables (avoid throwing during tests)
const missingEnv = !ClientEnv.SUPABASE_URL || !ClientEnv.SUPABASE_ANON_KEY;
if (missingEnv && process.env.JEST_WORKER_ID === undefined) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with latest best practices
export const supabase = createClient(
  ClientEnv.SUPABASE_URL || 'http://localhost',
  ClientEnv.SUPABASE_ANON_KEY || 'test-key',
  {
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
  }
);

// Export types for TypeScript
export type Database = any; // TODO: Generate types with `supabase gen types typescript`
