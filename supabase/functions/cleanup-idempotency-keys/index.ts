// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

// This Edge Function runs on a 6-hour cron schedule to clean up expired idempotency keys
// Schedule: 0 */6 * * * (every 6 hours)

Deno.serve(async (req: Request) => {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Use service role key for cleanup operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete expired idempotency keys (completed: 24h TTL, failed: 7d TTL)
    const { data, error } = await supabase
      .from('idempotency_keys')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .in('status', ['completed', 'failed'])
      .select('id');

    if (error) {
      console.error('Cleanup failed:', error);
      return new Response(
        JSON.stringify({
          error: 'Cleanup failed',
          details: error.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const deletedCount = data?.length ?? 0;
    console.log(`Cleaned up ${deletedCount} expired idempotency keys`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: deletedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message ?? 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
