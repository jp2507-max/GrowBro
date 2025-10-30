/**
 * Supabase Edge Function: Enforce Auth Lockout
 *
 * Wrapper for email/password authentication with brute-force protection.
 * Checks lockout status before allowing sign-in attempts and manages lockout counters.
 *
 * Requirements:
 * - 8.1: Lock account after 5 failed attempts within 15 minutes
 * - 8.2: Display localized lockout message
 * - 8.3: Automatically unlock after lockout period
 * - 8.4: Reset counter on successful authentication
 *
 * Flow:
 * 1. Check if account is locked via RPC
 * 2. If locked, return error with remaining time
 * 3. If not locked, attempt sign in with Supabase Auth
 * 4. On success: reset counter and capture device metadata
 * 5. On failure: increment counter via RPC
 * 6. Log all events to audit log
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface SignInRequest {
  email: string;
  password: string;
  appVersion?: string;
}

interface LockoutStatus {
  is_locked: boolean;
  locked_until: string | null;
  attempts_remaining: number;
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

    // Parse request body
    const body: SignInRequest = await req.json();
    const { email, password, appVersion } = body;

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract request metadata
    const ipAddress = extractIpAddress(req);
    const truncatedIp = truncateIpAddress(ipAddress);
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Check lockout status BEFORE attempting sign in
    const emailHash = await hashEmailForLookup(email);
    const { data: lockoutData, error: lockoutError } = await supabase.rpc(
      'check_and_increment_lockout',
      { p_email_hash: emailHash }
    );

    if (lockoutError) {
      console.error(
        '[enforce-auth-lockout] Error checking lockout:',
        lockoutError
      );
      // Fail closed: return generic error
      return new Response(
        JSON.stringify({
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const lockoutStatus = lockoutData as LockoutStatus;

    // If account is locked, return error with remaining time
    if (lockoutStatus.is_locked) {
      const lockedUntil = new Date(lockoutStatus.locked_until!);
      const now = new Date();
      const minutesRemaining = Math.max(
        0,
        Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)
      );

      // Send lockout notification email (fire-and-forget with timeout)
      const notificationController = new AbortController();
      const notificationTimeoutId = setTimeout(
        () => notificationController.abort(),
        500
      );
      fetch(`${supabaseUrl}/functions/v1/send-lockout-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          email,
          lockedUntil: lockoutStatus.locked_until,
          ipAddress: truncatedIp,
          userAgent,
          failedAttempts: 5,
        }),
        signal: notificationController.signal,
      })
        .catch((error) => {
          if (error.name === 'AbortError') {
            console.log(
              '[enforce-auth-lockout] Lockout notification fetch aborted due to timeout'
            );
          } else {
            console.error(
              '[enforce-auth-lockout] Error sending lockout notification:',
              error
            );
          }
        })
        .finally(() => clearTimeout(notificationTimeoutId));

      // Return generic error (don't reveal lockout state to prevent timing attacks)
      return new Response(
        JSON.stringify({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          // Include lockout info in metadata for client to parse
          metadata: {
            lockout: true,
            minutes_remaining: minutesRemaining,
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Attempt sign in with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    // Sign in failed - credentials are invalid
    if (authError || !authData.session || !authData.user) {
      console.log('[enforce-auth-lockout] Sign in failed:', authError?.message);

      // Lockout counter already incremented above via check_and_increment_lockout
      // Log failed attempt to audit log
      try {
        await supabase.rpc('log_auth_event', {
          p_user_id: null,
          p_event_type: 'sign_in',
          p_ip_address: truncatedIp,
          p_user_agent: userAgent,
          p_metadata: {
            email_hash: await hashEmail(email),
            success: false,
            error: authError?.message || 'Invalid credentials',
            attempts_remaining: Math.max(
              0,
              lockoutStatus.attempts_remaining - 1
            ),
          },
        });
      } catch (auditError) {
        console.error(
          '[enforce-auth-lockout] Error logging failed attempt audit:',
          auditError
        );
      }

      // Return generic error (don't reveal whether email exists)
      return new Response(
        JSON.stringify({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          metadata: {
            attempts_remaining: Math.max(
              0,
              lockoutStatus.attempts_remaining - 1
            ),
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Sign in successful - reset lockout counter
    try {
      await supabase.rpc('reset_lockout_counter', { p_email_hash: emailHash });
    } catch (resetError) {
      console.error(
        '[enforce-auth-lockout] Error resetting lockout counter:',
        resetError
      );
      // Don't block sign in on reset failure
    }

    // Log successful sign in to audit log
    try {
      await supabase.rpc('log_auth_event', {
        p_user_id: authData.user.id,
        p_event_type: 'sign_in',
        p_ip_address: truncatedIp,
        p_user_agent: userAgent,
        p_metadata: {
          success: true,
          app_version: appVersion || 'Unknown',
        },
      });
    } catch (auditError) {
      console.error(
        '[enforce-auth-lockout] Error logging sign in audit:',
        auditError
      );
    }

    // Capture device metadata (fire-and-forget with timeout)
    const captureController = new AbortController();
    const captureTimeoutId = setTimeout(() => captureController.abort(), 500);
    fetch(`${supabaseUrl}/functions/v1/capture-device-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        userId: authData.user.id,
        sessionKey: await deriveSessionKey(authData.session.refresh_token),
        userAgent,
        appVersion,
      }),
      signal: captureController.signal,
    })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log(
            '[enforce-auth-lockout] Device metadata capture fetch aborted due to timeout'
          );
        } else {
          console.error(
            '[enforce-auth-lockout] Error capturing device metadata:',
            error
          );
        }
      })
      .finally(() => clearTimeout(captureTimeoutId));

    // Return successful sign in with session
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          expires_in: authData.session.expires_in,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed_at: authData.user.email_confirmed_at,
          created_at: authData.user.created_at,
          user_metadata: authData.user.user_metadata,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[enforce-auth-lockout] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
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
 * Derive stable session key from refresh token using SHA-256 hash
 */
async function deriveSessionKey(refreshToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(refreshToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

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

/**
 * Hash email with SHA-256 and salt for privacy in database lookups
 * Matches the database hash_email function for consistency
 */
async function hashEmailForLookup(email: string): Promise<string> {
  const salt = 'growbro_auth_lockout_salt_v1';
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash email with SHA-256 for privacy in audit logs (no salt)
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
