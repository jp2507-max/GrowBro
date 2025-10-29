/**
 * Supabase Edge Function: Revoke All Sessions Except Current
 *
 * Revokes all user sessions except the current one by marking them as revoked.
 * This forces all other devices to sign out on next app start.
 *
 * Requirements:
 * - 6.4: Revoke all refresh tokens except current via GoTrue Admin API
 * - 6.5: Force affected devices to sign out on next app start
 *
 * Note: This function requires service role key to access user_sessions table.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RevokeAllSessionsExceptRequest {
  currentSessionKey: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get authorization header to verify authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body: RevokeAllSessionsExceptRequest = await req.json();
    const { currentSessionKey } = body;

    // Validate required fields
    if (!currentSessionKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: currentSessionKey' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userToken = authHeader.replace('Bearer ', '');

    // Create client with user token to verify authentication
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user is authenticated and get user ID
    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(userToken);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create service role client for admin operations
    const adminSupabase = createClient(supabaseUrl, supabaseKey);

    // Get all sessions for this user
    const { data: allSessions, error: sessionsError } = await adminSupabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('revoked_at', null);

    if (sessionsError) {
      console.error(
        '[revoke-all-sessions-except] Error fetching sessions:',
        sessionsError
      );
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!allSessions || allSessions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active sessions to revoke',
          revoked_count: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Filter sessions to revoke (all except current)
    const sessionsToRevoke = allSessions.filter(
      (session) => session.session_key !== currentSessionKey
    );

    if (sessionsToRevoke.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No other sessions to revoke',
          revoked_count: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get session IDs to revoke
    const sessionIdsToRevoke = sessionsToRevoke.map((session) => session.id);

    // Revoke all other sessions by updating revoked_at timestamp
    const { error: updateError } = await adminSupabase
      .from('user_sessions')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .in('id', sessionIdsToRevoke);

    if (updateError) {
      console.error(
        '[revoke-all-sessions-except] Error revoking sessions:',
        updateError
      );
      return new Response(
        JSON.stringify({ error: 'Failed to revoke sessions' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Log revocation to audit log
    try {
      const ipAddress = extractIpAddress(req);
      const truncatedIp = truncateIpAddress(ipAddress);
      const userAgent = req.headers.get('user-agent') || 'Unknown';

      await adminSupabase.rpc('log_auth_event', {
        p_user_id: user.id,
        p_event_type: 'session_revoked',
        p_ip_address: truncatedIp,
        p_user_agent: userAgent,
        p_metadata: {
          revoked_count: sessionsToRevoke.length,
          revoked_by: 'user',
          action: 'revoke_all_except_current',
          devices_affected: sessionsToRevoke.map((s) => ({
            device_name: s.device_name,
            device_os: s.os,
            last_active: s.last_active_at,
          })),
        },
      });
    } catch (auditError) {
      console.error(
        '[revoke-all-sessions-except] Error logging audit event:',
        auditError
      );
      // Don't block on audit log failure
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Revoked ${sessionsToRevoke.length} session(s) successfully`,
        revoked_count: sessionsToRevoke.length,
        revoked_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[revoke-all-sessions-except] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Extract IP address from request headers
 */
function extractIpAddress(req: Request): string {
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'x-client-ip',
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      return value.split(',')[0].trim();
    }
  }

  return 'unknown';
}

/**
 * Truncate IP address for privacy (mask last octet)
 */
function truncateIpAddress(ip: string): string {
  if (ip === 'unknown') return ip;

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::';
    }
  }

  return ip;
}
