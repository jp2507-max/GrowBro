// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Send Security Email Service
 *
 * Internal-only Edge Function for sending security notification emails
 * when users change passwords or revoke sessions.
 *
 * Features:
 * - Debouncing: Enforces 10-minute minimum between emails
 * - Template-based emails for password changes and session revocations
 * - Requires service role authentication
 *
 * This function should be called internally from other Edge Functions
 * or database triggers, not directly from client code.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SecurityEmailRequest {
  userId: string;
  emailType: 'password_change' | 'session_revoke' | 'all_sessions_revoke';
  metadata?: {
    deviceInfo?: string;
    location?: string;
    timestamp?: string;
  };
}

interface SecurityEmailResponse {
  success: boolean;
  message: string;
  debounced?: boolean;
}

/**
 * Check if enough time has passed since last email
 * Enforces 10-minute debounce window
 */
async function checkDebounce(
  supabaseAdmin: any,
  userId: string,
  emailType: string
): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('security_email_log')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('email_type', emailType)
    .gte('sent_at', tenMinutesAgo)
    .limit(1);

  if (error) {
    console.error('[security-email] Debounce check error:', error);
    return false; // Allow sending if check fails
  }

  return data && data.length > 0; // True if recent email exists (should debounce)
}

/**
 * Log sent email for debouncing
 */
async function logEmailSent(
  supabaseAdmin: any,
  userId: string,
  emailType: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('security_email_log').insert({
    user_id: userId,
    email_type: emailType,
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[security-email] Failed to log email:', error);
  }
}

/**
 * Get user email from profile
 */
async function getUserEmail(
  supabaseAdmin: any,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !data?.user?.email) {
    console.error('[security-email] Failed to get user email:', error);
    return null;
  }

  return data.user.email;
}

/**
 * Send email (placeholder - integrate with actual email service)
 * In production, use Resend, SendGrid, or similar
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // TODO: Integrate with actual email service
  // For now, just log the email
  console.log('[security-email] Email to send:');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);

  // Placeholder: Return success
  // In production, call email service API here
  return true;
}

/**
 * Generate email content based on type
 */
function generateEmailContent(
  emailType: string,
  metadata?: any
): { subject: string; body: string } {
  const timestamp = metadata?.timestamp || new Date().toISOString();
  const deviceInfo = metadata?.deviceInfo || 'Unknown device';
  const location = metadata?.location || 'Unknown location';

  switch (emailType) {
    case 'password_change':
      return {
        subject: 'GrowBro: Password Changed',
        body: `
Hello,

Your GrowBro account password was changed on ${timestamp}.

Device: ${deviceInfo}
Location: ${location}

If you did not make this change, please contact support immediately at support@growbro.app.

Best regards,
The GrowBro Team
        `.trim(),
      };

    case 'session_revoke':
      return {
        subject: 'GrowBro: Session Logged Out',
        body: `
Hello,

A session on your GrowBro account was logged out on ${timestamp}.

Device: ${deviceInfo}
Location: ${location}

If you did not perform this action, please secure your account immediately.

Best regards,
The GrowBro Team
        `.trim(),
      };

    case 'all_sessions_revoke':
      return {
        subject: 'GrowBro: All Sessions Logged Out',
        body: `
Hello,

All sessions on your GrowBro account were logged out on ${timestamp}.

This was likely done as a security measure from:
Device: ${deviceInfo}
Location: ${location}

If you did not perform this action, please secure your account immediately and contact support at support@growbro.app.

Best regards,
The GrowBro Team
        `.trim(),
      };

    default:
      return {
        subject: 'GrowBro: Security Notification',
        body: `
Hello,

A security action was performed on your GrowBro account on ${timestamp}.

If you did not perform this action, please contact support at support@growbro.app.

Best regards,
The GrowBro Team
        `.trim(),
      };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify service role authorization
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!authHeader || !authHeader.includes(serviceRoleKey ?? '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Service role required.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const body: SecurityEmailRequest = await req.json();

    // Validate request
    if (!body.userId || !body.emailType) {
      return new Response(
        JSON.stringify({ error: 'userId and emailType are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const validTypes = [
      'password_change',
      'session_revoke',
      'all_sessions_revoke',
    ];
    if (!validTypes.includes(body.emailType)) {
      return new Response(
        JSON.stringify({
          error: `Invalid emailType. Must be one of: ${validTypes.join(', ')}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check debounce
    const shouldDebounce = await checkDebounce(
      supabaseAdmin,
      body.userId,
      body.emailType
    );

    if (shouldDebounce) {
      console.log(
        `[security-email] Debouncing email for user ${body.userId.slice(0, 8)}... (type: ${body.emailType})`
      );

      const response: SecurityEmailResponse = {
        success: true,
        message:
          'Email debounced. Please wait 10 minutes before sending another.',
        debounced: true,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user email
    const userEmail = await getUserEmail(supabaseAdmin, body.userId);

    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate email content
    const { subject, body: emailBody } = generateEmailContent(
      body.emailType,
      body.metadata
    );

    // Send email
    const sent = await sendEmail(userEmail, subject, emailBody);

    if (!sent) {
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log email sent
    await logEmailSent(supabaseAdmin, body.userId, body.emailType);

    console.log(
      `[security-email] Email sent to user ${body.userId.slice(0, 8)}... (type: ${body.emailType})`
    );

    const response: SecurityEmailResponse = {
      success: true,
      message: 'Security email sent successfully',
      debounced: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[security-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
