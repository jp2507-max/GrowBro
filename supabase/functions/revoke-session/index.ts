/**
 * Supabase Edge Function: Revoke Session
 *
 * Marks a specific user session as revoked in the database by setting the revoked_at timestamp.
 * Due to GoTrue API limitations, there is no direct way to revoke a specific refresh token;
 * the refresh token remains valid until it naturally expires. The app should validate sessions
 * against the revoked_at timestamp on startup to enforce revocation.
 *
 * Requirements:
 * - 6.3: Revoke specific refresh token via GoTrue Admin API (not implemented due to API limitations)
 * - 6.5: Force affected device to sign out on next app start
 *
 * Note: This function requires service role key for database operations.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RevokeSessionRequest {
  sessionKey: string;
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
    const body: RevokeSessionRequest = await req.json();
    const { sessionKey } = body;

    // Validate required fields
    if (!sessionKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: sessionKey' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with user's token
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

    // Get session record from user_sessions table
    const { data: session, error: sessionError } = await adminSupabase
      .from('user_sessions')
      .select('*')
      .eq('session_key', sessionKey)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error('[revoke-session] Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch session' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if session is already revoked
    if (session.revoked_at) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Session already revoked',
          revoked_at: session.revoked_at,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // CRITICAL SECURITY ISSUE: GoTrue doesn't have a direct "revoke refresh token by hash" endpoint
    // This creates a security vulnerability where revoked sessions can still be used until token expiry.
    // The refresh token remains valid and can continue accessing protected resources until it naturally expires.
    //
    // IMPACT: "Revoke session" in the UI does NOT truly terminate active sessions.
    // Affected devices can refresh tokens and maintain access for hours/days.
    //
    // WORKAROUNDS IMPLEMENTED:
    // - Mark session as revoked in database with revoked_at timestamp
    // - App validates sessions against revoked_at on startup (requirement 6.5)
    // - Force affected device to sign out on next app start
    //
    // REQUIRED FIXES (Priority: HIGH):
    // 1. Implement true token revocation via Supabase Admin API when available
    // 2. Set shorter JWT expiry times (5 minutes minimum) in Auth settings
    // 3. Add immediate token invalidation via global logout for critical revocations
    // 4. Implement real-time session validation in app middleware
    // 5. Document this limitation for security audits and compliance
    //
    // Note: Same pattern exists in "revoke all sessions except current" - fix both endpoints

    // TODO: Replace with actual token revocation once GoTrue Admin API supports it
    // Update session record to mark as revoked (current workaround)
    const { error: updateError } = await adminSupabase
      .from('user_sessions')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('[revoke-session] Error updating session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to revoke session' }),
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
          session_key: sessionKey,
          device_name: session.device_name,
          device_os: session.os,
          revoked_by: 'user',
        },
      });
    } catch (auditError) {
      console.error('[revoke-session] Error logging audit event:', auditError);
      // Don't block on audit log failure
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Session revoked successfully',
        revoked_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[revoke-session] Unexpected error:', error);

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
