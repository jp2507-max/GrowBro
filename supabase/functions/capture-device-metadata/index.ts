/**
 * Supabase Edge Function: Capture Device Metadata
 *
 * Captures device metadata on user sign-in and persists to user_sessions table.
 * Extracts IP address, user agent, device info, and app version from request headers.
 *
 * Requirements:
 * - 6.1: Record device information on sign in
 * - 6.7: Extract IP, user agent, and app version from request headers
 *
 * Note: This function should be called AFTER successful authentication.
 * Errors are logged but don't block sign-in flow (graceful degradation).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface CaptureDeviceMetadataRequest {
  userId: string;
  sessionKey: string;
  userAgent?: string;
  appVersion?: string;
}

interface DeviceInfo {
  deviceName: string;
  os: string;
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
    const body: CaptureDeviceMetadataRequest = await req.json();
    const { userId, sessionKey, userAgent, appVersion } = body;

    // Validate required fields
    if (!userId || !sessionKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: userId, sessionKey',
        }),
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

    // Extract IP address from request headers
    const ipAddress = extractIpAddress(req);
    const truncatedIp = truncateIpAddress(ipAddress);
    const sanitizedIp = isValidInet(truncatedIp) ? truncatedIp : null;

    // Extract user agent from headers or body
    const finalUserAgent =
      userAgent || req.headers.get('user-agent') || 'Unknown';

    // Parse device info from user agent
    const deviceInfo = parseUserAgent(finalUserAgent);

    // Insert or update session record
    const { data: existingSession, error: checkError } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('session_key', sessionKey)
      .maybeSingle();

    if (checkError) {
      console.error(
        '[capture-device-metadata] Error checking existing session:',
        checkError
      );
      // Continue anyway (graceful degradation)
    }

    if (existingSession) {
      // Update existing session
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({
          last_active_at: new Date().toISOString(),
        })
        .eq('id', existingSession.id);

      if (updateError) {
        console.error(
          '[capture-device-metadata] Error updating session:',
          updateError
        );
        // Don't throw - graceful degradation
      }
    } else {
      // Insert new session record
      const { error: insertError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_key: sessionKey,
          device_name: deviceInfo.deviceName,
          os: deviceInfo.os,
          app_version: appVersion || 'Unknown',
          ip_address: sanitizedIp,
          created_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(
          '[capture-device-metadata] Error inserting session:',
          insertError
        );
        // Don't throw - graceful degradation
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to record session',
            message: insertError.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Log to audit log
      try {
        const ipParam = sanitizedIp;
        await supabase.rpc('log_auth_event', {
          p_user_id: userId,
          p_event_type: 'sign_in',
          p_ip_address: ipParam,
          p_user_agent: finalUserAgent,
          p_metadata: {
            device_name: deviceInfo.deviceName,
            os: deviceInfo.os,
            app_version: appVersion || 'Unknown',
          },
        });
      } catch (auditError) {
        console.error(
          '[capture-device-metadata] Error logging audit event:',
          auditError
        );
        // Don't block on audit log failure
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Device metadata captured successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[capture-device-metadata] Unexpected error:', error);

    // Graceful degradation - don't block sign in
    return new Response(
      JSON.stringify({
        success: false,
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
 * Checks common proxy headers first, falls back to connection info
 */
function extractIpAddress(req: Request): string {
  // Check common proxy headers in order of preference
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for can be comma-separated list, take first
      return value.split(',')[0].trim();
    }
  }

  // Fallback to connection info if available
  return 'unknown';
}

/**
 * Truncate IP address for privacy (mask last octet for IPv4, last 64 bits for IPv6)
 * Example: 192.168.1.100 -> 192.168.1.0
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
    // Keep first 64 bits (4 groups), mask rest
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::';
    }
  }

  return ip;
}

/**
 * Parse user agent string to extract device and OS info
 * Simplified parser - expand as needed
 */
function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  let os = 'Unknown';
  let deviceName = 'Unknown Device';

  // Detect OS
  if (ua.includes('android')) {
    os = 'Android';
    deviceName = extractAndroidDevice(userAgent);
  } else if (ua.includes('iphone')) {
    os = 'iOS';
    deviceName = 'iPhone';
  } else if (ua.includes('ipad')) {
    os = 'iOS';
    deviceName = 'iPad';
  } else if (ua.includes('mac os x') || ua.includes('macos')) {
    os = 'macOS';
    deviceName = 'Mac';
  } else if (ua.includes('windows')) {
    os = 'Windows';
    deviceName = 'Windows PC';
  } else if (ua.includes('linux')) {
    os = 'Linux';
    deviceName = 'Linux PC';
  }

  return { deviceName, os };
}

/**
 * Extract Android device name from user agent
 * Example: "Mozilla/5.0 (Linux; Android 13; SM-G991B)" -> "Samsung SM-G991B"
 */
function extractAndroidDevice(userAgent: string): string {
  const match = userAgent.match(/Android [^;]+;\s*([^)]+)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return 'Android Device';
}

/**
 * Check if a string is a valid INET (IPv4 or IPv6)
 */
function isValidInet(ip: string): boolean {
  if (ip === 'unknown') return false;

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(ip)) {
    return ip.split('.').every((octet) => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 validation (simplified)
  const ipv6Regex =
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}
