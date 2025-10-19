// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import type { NotificationRequestEntry, ProcessingStats } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Function-Secret',
};

/**
 * Sends a single notification request to the send-push-notification Edge Function
 */
async function sendNotification(
  request: NotificationRequestEntry,
  edgeFunctionSecret: string,
  supabaseUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract collapse_key and thread_id from data
    const collapseKey = request.data?.collapse_key || undefined;
    const threadId = request.data?.thread_id || undefined;

    // Build request payload for send-push-notification
    const payload = {
      userId: request.user_id,
      type: request.type,
      title: request.title,
      body: request.body,
      data: request.data || {},
      deepLink: request.deep_link || undefined,
      collapseKey,
      threadId,
    };

    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Function-Secret': edgeFunctionSecret,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();

    // Check if the send was successful
    if (result.success === false) {
      return {
        success: false,
        error: result.reason || result.error || 'Unknown error',
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error)?.message || String(err),
    };
  }
}

/**
 * Implements exponential backoff retry logic
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(
  request: NotificationRequestEntry,
  edgeFunctionSecret: string,
  supabaseUrl: string,
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await sendNotification(
      request,
      edgeFunctionSecret,
      supabaseUrl
    );

    if (result.success) {
      return result;
    }

    lastError = result.error || 'Unknown error';

    // Don't retry on user opt-out or missing tokens
    if (
      lastError.includes('User opted out') ||
      lastError.includes('No active push tokens')
    ) {
      return result;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(
        `Retry attempt ${attempt + 1} for request ${request.id} after ${backoffMs}ms`
      );
      await sleep(backoffMs);
    }
  }

  return { success: false, error: lastError };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    // Guard: ensure the Edge Function has the configured secret
    const configuredSecret = Deno.env.get('EDGE_FUNCTION_SECRET') ?? null;
    if (!configuredSecret) {
      throw new Error('EDGE_FUNCTION_SECRET is not configured');
    }

    // Validate incoming request header
    const incomingSecret = req.headers.get('x-function-secret') ?? null;
    if (!incomingSecret || incomingSecret !== configuredSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 401,
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch unprocessed notification requests (limit to 100 per batch)
    const { data: requests, error: fetchError } = await supabase
      .from('notification_requests')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      throw new Error(
        `Failed to fetch notification requests: ${fetchError.message}`
      );
    }

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending notification requests',
          stats: { processed: 0, succeeded: 0, failed: 0, errors: [] },
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        }
      );
    }

    console.log(`Processing ${requests.length} notification requests...`);

    const stats: ProcessingStats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Process each request
    for (const request of requests as NotificationRequestEntry[]) {
      stats.processed++;

      // Send notification with retry logic
      const result = await sendWithRetry(
        request,
        configuredSecret,
        supabaseUrl
      );

      if (result.success) {
        stats.succeeded++;

        // Mark as processed
        const { error: updateError } = await supabase
          .from('notification_requests')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        if (updateError) {
          console.error(
            `Failed to update request ${request.id} as processed:`,
            updateError
          );
        }
      } else {
        stats.failed++;
        stats.errors.push({
          requestId: request.id,
          error: result.error || 'Unknown error',
        });

        console.error(`Failed to process request ${request.id}:`, result.error);

        // Mark as processed even on failure to avoid infinite retries
        // The error is logged in stats for monitoring
        const { error: updateError } = await supabase
          .from('notification_requests')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('id', request.id);

        if (updateError) {
          console.error(
            `Failed to update request ${request.id} as processed:`,
            updateError
          );
        }
      }
    }

    console.log('Processing complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.processed} notification requests`,
        stats,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message || 'Internal server error',
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 500,
      }
    );
  }
});
