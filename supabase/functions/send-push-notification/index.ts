// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import type {
  ExpoPushMessage,
  ExpoPushResponse,
  ExpoPushTicket,
  NotificationPreferences,
  NotificationQueueRow,
  NotificationRequest,
  PushToken,
  SendResult,
} from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Function-Secret',
};

/**
 * Maps notification type to Android channel ID
 */
function getChannelId(type: string): string {
  const channelMap: Record<string, string> = {
    'community.reply': 'community.interactions.v1',
    'community.like': 'community.likes.v1',
    'cultivation.reminder': 'cultivation.reminders.v1',
    'system.update': 'system.updates.v1',
  };
  return channelMap[type] || 'system.updates.v1';
}

/**
 * Maps notification type to iOS category ID
 */
function getCategoryId(type: string): string {
  const categoryMap: Record<string, string> = {
    'community.reply': 'COMMUNITY_INTERACTIONS',
    'community.like': 'COMMUNITY_LIKES',
    'cultivation.reminder': 'CULTIVATION_REMINDERS',
    'system.update': 'SYSTEM_UPDATES',
  };
  return categoryMap[type] || 'SYSTEM_UPDATES';
}

/**
 * Checks if user has opted into this notification type
 */
function isNotificationAllowed(
  type: string,
  preferences: NotificationPreferences | null
): boolean {
  if (!preferences) return true; // Default to allowed if no preferences set

  const typeMap: Record<string, boolean | undefined> = {
    'community.reply': preferences.community_interactions,
    'community.like': preferences.community_likes,
    'cultivation.reminder': preferences.cultivation_reminders,
    'system.update': preferences.system_updates,
  };

  return typeMap[type] ?? true;
}

/**
 * Sends push notification to a single device via Expo Push API
 */

async function sendToDevice(
  tokenData: PushToken,
  type: string,
  title: string,
  body: string,
  data: Record<string, any>,
  deepLink?: string,
  collapseKey?: string,
  threadId?: string
): Promise<SendResult> {
  const messageId = `msg_${crypto.randomUUID()}`;

  // Construct Expo Push message
  const expoPushMessage: ExpoPushMessage = {
    to: tokenData.token,
    title,
    body,
    data: {
      ...data,
      deeplink: deepLink,
      type,
      message_id: messageId,
      // Add iOS thread-id for grouping (Expo will map to apns payload)
      ...(threadId && tokenData.platform === 'ios' ? { threadId } : {}),
      // Add Android collapse key for deduplication
      ...(collapseKey && tokenData.platform === 'android'
        ? { collapseKey }
        : {}),
    },
    sound: 'default',
    badge: 1,
    priority: type === 'cultivation.reminder' ? 'high' : 'default',
    ttl: 21600, // 6 hours in seconds
  };

  // Add platform-specific fields
  if (tokenData.platform === 'android') {
    expoPushMessage.channelId = getChannelId(type);
  } else {
    expoPushMessage.categoryId = getCategoryId(type);
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(expoPushMessage),
    });

    if (!response.ok) {
      return {
        success: false,
        messageId,
        platform: tokenData.platform,
        providerMessageName: null,
        error: `HTTP ${response.status}`,
      };
    }

    const result: ExpoPushResponse = await response.json();
    const ticket: ExpoPushTicket = result.data[0];

    if (ticket.status === 'error') {
      return {
        success: false,
        messageId,
        platform: tokenData.platform,
        providerMessageName: null,
        error: ticket.details?.error || ticket.message || 'Unknown error',
      };
    }

    return {
      success: true,
      messageId,
      platform: tokenData.platform,
      providerMessageName: ticket.id || null,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      messageId,
      platform: tokenData.platform,
      providerMessageName: null,
      error: (err as Error)?.message || String(err),
    };
  }
}

/**
 * Sends push notifications to multiple devices in batch
 * Expo supports up to 100 messages per request
 */

async function sendBatch(
  tokens: PushToken[],
  type: string,
  title: string,
  body: string,
  data: Record<string, any>,
  deepLink?: string,
  collapseKey?: string,
  threadId?: string
): Promise<SendResult[]> {
  const BATCH_SIZE = 100;
  const results: SendResult[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((token) =>
        sendToDevice(
          token,
          type,
          title,
          body,
          data,
          deepLink,
          collapseKey,
          threadId
        )
      )
    );
    results.push(...batchResults);
  }

  return results;
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
    // Guard: ensure the Edge Function has the configured secret in its environment
    const configuredSecret = Deno.env.get('EDGE_FUNCTION_SECRET') ?? null;
    if (!configuredSecret) {
      // Fail fast: refuse to run without a configured secret to avoid accepting
      // unauthenticated requests
      throw new Error('EDGE_FUNCTION_SECRET is not configured');
    }

    // Validate incoming request header 'X-Function-Secret' matches configured secret
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

    // Parse request body
    const requestData: NotificationRequest = await req.json();
    const { userId, type, title, body, data, deepLink, collapseKey, threadId } =
      requestData;

    // Validate required fields
    if (!userId || !type || !title || !body) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, type, title, body',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
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

    // Get user's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (tokensError) {
      throw new Error(`Failed to fetch push tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'No active push tokens found',
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        }
      );
    }

    // Get user's notification preferences
    const { data: preferences, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsError) {
      console.warn(
        `Failed to fetch preferences for user ${userId}:`,
        prefsError
      );
      // Continue with default preferences (allow all)
    }

    // Check if user has opted into this notification type
    if (!isNotificationAllowed(type, preferences)) {
      return new Response(
        JSON.stringify({ success: false, reason: 'User opted out' }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        }
      );
    }

    // Send notifications to all user's devices
    const results = await sendBatch(
      tokens as PushToken[],
      type,
      title,
      body,
      data || {},
      deepLink,
      collapseKey,
      threadId
    );

    // Persist one row per device/send result for precise delivery tracking
    const rows: NotificationQueueRow[] = results.map((res, i) => ({
      user_id: userId,
      message_id: res.messageId,
      type,
      payload_summary: {
        platform: res.platform,
        keys: Object.keys(data || {}),
        has_deeplink: Boolean(deepLink),
      },
      provider_message_name: res.providerMessageName || null,
      status: res.success ? 'sent' : 'failed',
      device_token: tokens[i]?.token || '',
      platform: res.platform,
      error_message: res.error || null,
    }));

    // Insert rows into push_notification_queue
    const { error: insertError } = await supabase
      .from('push_notification_queue')
      .insert(rows);

    if (insertError) {
      console.error('Failed to insert notification queue rows:', insertError);
      // Don't fail the request, just log the error
    }

    // Sanitize results returned to the HTTP caller
    const safeResults = results.map((r) => ({
      success: r.success,
      messageId: r.messageId,
      platform: r.platform,
      providerMessageName: r.providerMessageName || null,
      status: r.success ? 'sent' : 'failed',
      error: r.error ? String(r.error) : null,
    }));

    return new Response(
      JSON.stringify({ success: true, results: safeResults }),
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
