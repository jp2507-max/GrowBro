// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import type {
  ExpoPushReceipt,
  ExpoPushReceiptsResponse,
  NotificationQueueEntry,
} from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Function-Secret',
};

/**
 * Deactivates a push token due to delivery failure
 */
// eslint-disable-next-line max-params
async function deactivateToken(
  supabase: any,
  token: string,
  platform: string,
  reason: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token)
      .eq('platform', platform)
      .eq('is_active', true);

    if (error) {
      console.error(
        `Failed to deactivate token ${token.substring(0, 10)}...`,
        error
      );
    } else {
      console.log(
        `Deactivated token ${token.substring(0, 10)}... due to: ${reason}`
      );
    }
  } catch (err) {
    console.error('Error deactivating token:', err);
  }
}

/**
 * Fetches receipts from Expo Push API
 */
async function fetchReceipts(
  ticketIds: string[]
): Promise<Record<string, ExpoPushReceipt>> {
  if (ticketIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch(
      'https://exp.host/--/api/v2/push/getReceipts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ids: ticketIds }),
      }
    );

    if (!response.ok) {
      console.error(
        `Expo receipts API returned HTTP ${response.status}`,
        await response.text()
      );
      return {};
    }

    const result: ExpoPushReceiptsResponse = await response.json();
    return result.data || {};
  } catch (err) {
    console.error('Error fetching Expo receipts:', err);
    return {};
  }
}

/**
 * Processes receipts and updates notification queue
 */
// eslint-disable-next-line max-lines-per-function
async function processReceipts(
  supabase: any,
  entries: NotificationQueueEntry[],
  receipts: Record<string, ExpoPushReceipt>
): Promise<{
  delivered: number;
  failed: number;
  tokensDeactivated: number;
}> {
  let delivered = 0;
  let failed = 0;
  let tokensDeactivated = 0;

  for (const entry of entries) {
    const receipt = receipts[entry.provider_message_name];

    if (!receipt) {
      // Receipt not available yet, skip for now
      continue;
    }

    if (receipt.status === 'ok') {
      // Successfully delivered
      const { error } = await supabase
        .from('push_notification_queue')
        .update({
          status: 'delivered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (error) {
        console.error(`Failed to update queue entry ${entry.id}:`, error);
      } else {
        delivered++;
      }
    } else if (receipt.status === 'error') {
      // Delivery failed
      const errorCode = receipt.details?.error || 'UnknownError';
      const errorMessage = receipt.message || errorCode;

      const { error } = await supabase
        .from('push_notification_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (error) {
        console.error(`Failed to update queue entry ${entry.id}:`, error);
      } else {
        failed++;

        // Deactivate token if it's no longer registered
        if (errorCode === 'DeviceNotRegistered') {
          await deactivateToken(
            supabase,
            entry.device_token,
            entry.platform,
            'DeviceNotRegistered'
          );
          tokensDeactivated++;
        }
      }
    }
  }

  return { delivered, failed, tokensDeactivated };
}

// eslint-disable-next-line max-lines-per-function
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

    // Fetch pending receipts (notifications sent but not yet confirmed delivered/failed)
    // Limit to 1000 to avoid overwhelming the Expo API
    const { data: entries, error: fetchError } = await supabase
      .from('push_notification_queue')
      .select('id, provider_message_name, device_token, platform, user_id')
      .eq('status', 'sent')
      .not('provider_message_name', 'is', null)
      .limit(1000);

    if (fetchError) {
      throw new Error(
        `Failed to fetch notification queue: ${fetchError.message}`
      );
    }

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending receipts to poll',
          stats: { delivered: 0, failed: 0, tokensDeactivated: 0 },
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        }
      );
    }

    // Extract ticket IDs
    const ticketIds = entries
      .map((e: NotificationQueueEntry) => e.provider_message_name)
      .filter((id): id is string => Boolean(id));

    console.log(`Polling ${ticketIds.length} Expo push receipts...`);

    // Fetch receipts from Expo
    const receipts = await fetchReceipts(ticketIds);

    console.log(`Received ${Object.keys(receipts).length} receipts from Expo`);

    // Process receipts and update queue
    const stats = await processReceipts(
      supabase,
      entries as NotificationQueueEntry[],
      receipts
    );

    console.log('Receipt processing stats:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${entries.length} receipts`,
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
