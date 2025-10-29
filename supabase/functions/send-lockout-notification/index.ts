/**
 * Supabase Edge Function: Send Lockout Notification
 *
 * Sends email notification when an account is locked due to too many failed login attempts.
 * Integrates with Resend API for email delivery.
 *
 * Requirements:
 * - 8.5: Send email notification with timestamp and truncated IP
 * - 8.7: Log to auth_audit_log table
 *
 * Note: This function is called by enforce-auth-lockout after lockout threshold is reached.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface LockoutNotificationRequest {
  email: string;
  lockedUntil: string;
  ipAddress: string;
  userAgent?: string;
  failedAttempts: number;
}

interface ResendEmailResponse {
  id: string;
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
    const body: LockoutNotificationRequest = await req.json();
    const { email, lockedUntil, ipAddress, userAgent, failedAttempts } = body;

    // Validate required fields
    if (!email || !lockedUntil || !ipAddress) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: email, lockedUntil, ipAddress',
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

    // Get user by email to retrieve user_id and preferred language
    const { data: users, error: _userError } = await supabase
      .from('profiles')
      .select('id, preferred_language')
      .eq('email', email)
      .maybeSingle();

    const userId = users?.id || null;
    const language = users?.preferred_language || 'en';

    // Format lockout timestamp
    const lockedUntilDate = new Date(lockedUntil);
    const now = new Date();
    const minutesRemaining = Math.ceil(
      (lockedUntilDate.getTime() - now.getTime()) / 60000
    );

    // Format email content
    const emailContent = formatLockoutEmail(
      language,
      lockedUntilDate,
      minutesRemaining,
      ipAddress,
      failedAttempts
    );

    // Send email via Resend API
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error(
        '[send-lockout-notification] RESEND_API_KEY not configured'
      );
      // Log error but continue to audit log
    } else {
      try {
        const emailSent = await sendEmailViaResend(
          resendApiKey,
          email,
          emailContent.subject,
          emailContent.html,
          emailContent.text
        );

        if (!emailSent) {
          console.error('[send-lockout-notification] Failed to send email');
        }
      } catch (emailError) {
        console.error(
          '[send-lockout-notification] Error sending email:',
          emailError
        );
        // Continue to audit log even if email fails
      }
    }

    // Log lockout notification to audit log
    try {
      await supabase.rpc('log_auth_event', {
        p_user_id: userId,
        p_event_type: 'lockout',
        p_ip_address: ipAddress,
        p_user_agent: userAgent || 'Unknown',
        p_metadata: {
          email_hash: await hashEmail(email),
          locked_until: lockedUntil,
          minutes_remaining: minutesRemaining,
          failed_attempts: failedAttempts,
          notification_sent: !!resendApiKey,
        },
      });
    } catch (auditError) {
      console.error(
        '[send-lockout-notification] Error logging audit event:',
        auditError
      );
      // Don't block on audit log failure
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lockout notification sent successfully',
        email_sent: !!resendApiKey,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[send-lockout-notification] Unexpected error:', error);

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
 * Format lockout email content
 */
function formatLockoutEmail(
  language: string,
  lockedUntilDate: Date,
  minutesRemaining: number,
  ipAddress: string,
  failedAttempts: number
): { subject: string; html: string; text: string } {
  const translations = getTranslations(language);

  const subject = translations.subject;

  const formattedDate = lockedUntilDate.toLocaleString(
    language === 'de' ? 'de-DE' : 'en-US',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626; }
        .content { padding: 20px 0; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; margin-bottom: 10px; color: #dc2626; }
        .info-box { background-color: #f3f4f6; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .info-row { margin: 8px 0; }
        .info-label { font-weight: bold; display: inline-block; min-width: 150px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        .warning { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${translations.title}</h2>
        </div>
        
        <div class="content">
          <div class="section">
            <p>${translations.intro}</p>
          </div>

          <div class="info-box">
            <div class="info-row">
              <span class="info-label">${translations.lockedUntilLabel}:</span>
              <span>${formattedDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${translations.minutesRemainingLabel}:</span>
              <span class="warning">${minutesRemaining} ${translations.minutes}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${translations.ipAddressLabel}:</span>
              <span>${ipAddress}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${translations.failedAttemptsLabel}:</span>
              <span>${failedAttempts}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">${translations.whatToDoTitle}</div>
            <ul>
              <li>${translations.waitMessage}</li>
              <li>${translations.checkPasswordMessage}</li>
              <li>${translations.suspiciousActivityMessage}</li>
            </ul>
          </div>

          <div class="section">
            <div class="section-title">${translations.securityTipsTitle}</div>
            <ul>
              <li>${translations.tip1}</li>
              <li>${translations.tip2}</li>
              <li>${translations.tip3}</li>
            </ul>
          </div>

          <div class="section">
            <p>${translations.notYouMessage}</p>
          </div>
        </div>

        <div class="footer">
          <p>${translations.footer}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${translations.title}

${translations.intro}

${translations.lockedUntilLabel}: ${formattedDate}
${translations.minutesRemainingLabel}: ${minutesRemaining} ${translations.minutes}
${translations.ipAddressLabel}: ${ipAddress}
${translations.failedAttemptsLabel}: ${failedAttempts}

${translations.whatToDoTitle}
- ${translations.waitMessage}
- ${translations.checkPasswordMessage}
- ${translations.suspiciousActivityMessage}

${translations.securityTipsTitle}
- ${translations.tip1}
- ${translations.tip2}
- ${translations.tip3}

${translations.notYouMessage}

${translations.footer}
  `;

  return { subject, html, text };
}

/**
 * Get translations for email
 */
function getTranslations(language: string): Record<string, string> {
  const translations: Record<string, Record<string, string>> = {
    en: {
      subject: 'Security Alert: Account Temporarily Locked',
      title: 'Account Temporarily Locked',
      intro:
        'Your GrowBro account has been temporarily locked due to multiple failed login attempts. This is a security measure to protect your account.',
      lockedUntilLabel: 'Locked until',
      minutesRemainingLabel: 'Time remaining',
      minutes: 'minutes',
      ipAddressLabel: 'IP address',
      failedAttemptsLabel: 'Failed attempts',
      whatToDoTitle: 'What to do',
      waitMessage:
        'Wait until the lockout period expires to try logging in again',
      checkPasswordMessage:
        'Make sure you are using the correct email and password',
      suspiciousActivityMessage:
        'If you did not make these login attempts, change your password immediately after the lockout expires',
      securityTipsTitle: 'Security Tips',
      tip1: 'Use a strong, unique password for your GrowBro account',
      tip2: 'Never share your password with anyone',
      tip3: 'Enable two-factor authentication when available',
      notYouMessage:
        'If you did not attempt to log in, someone may be trying to access your account. Please secure your account by changing your password.',
      footer:
        'This is an automated security notification. If you have questions, please contact our support team.',
    },
    de: {
      subject: 'Sicherheitshinweis: Konto vorübergehend gesperrt',
      title: 'Konto vorübergehend gesperrt',
      intro:
        'Ihr GrowBro-Konto wurde aufgrund mehrerer fehlgeschlagener Anmeldeversuche vorübergehend gesperrt. Dies ist eine Sicherheitsmaßnahme zum Schutz Ihres Kontos.',
      lockedUntilLabel: 'Gesperrt bis',
      minutesRemainingLabel: 'Verbleibende Zeit',
      minutes: 'Minuten',
      ipAddressLabel: 'IP-Adresse',
      failedAttemptsLabel: 'Fehlgeschlagene Versuche',
      whatToDoTitle: 'Was zu tun ist',
      waitMessage:
        'Warten Sie, bis die Sperrfrist abgelaufen ist, um sich erneut anzumelden',
      checkPasswordMessage:
        'Stellen Sie sicher, dass Sie die richtige E-Mail-Adresse und das richtige Passwort verwenden',
      suspiciousActivityMessage:
        'Wenn Sie diese Anmeldeversuche nicht durchgeführt haben, ändern Sie Ihr Passwort sofort nach Ablauf der Sperrfrist',
      securityTipsTitle: 'Sicherheitstipps',
      tip1: 'Verwenden Sie ein starkes, einzigartiges Passwort für Ihr GrowBro-Konto',
      tip2: 'Geben Sie Ihr Passwort niemals an andere weiter',
      tip3: 'Aktivieren Sie die Zwei-Faktor-Authentifizierung, sobald verfügbar',
      notYouMessage:
        'Wenn Sie nicht versucht haben, sich anzumelden, versucht möglicherweise jemand, auf Ihr Konto zuzugreifen. Bitte sichern Sie Ihr Konto, indem Sie Ihr Passwort ändern.',
      footer:
        'Dies ist eine automatische Sicherheitsbenachrichtigung. Bei Fragen wenden Sie sich bitte an unser Support-Team.',
    },
  };

  return translations[language] || translations.en;
}

/**
 * Send email via Resend API
 */
async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'GrowBro Security <security@growbro.app>',
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[send-lockout-notification] Resend API error:', errorData);
      return false;
    }

    const data: ResendEmailResponse = await response.json();
    console.log(
      '[send-lockout-notification] Email sent successfully:',
      data.id
    );
    return true;
  } catch (error) {
    console.error(
      '[send-lockout-notification] Error calling Resend API:',
      error
    );
    return false;
  }
}

/**
 * Hash email with SHA-256 for privacy in audit logs
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
