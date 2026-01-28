/**
 * Supabase Edge Function: Send Moderation Email
 *
 * Sends email notifications for moderation decisions with Statement of Reasons
 * Implements DSA Art. 17 requirement for SoR delivery
 *
 * Requirements:
 * - 3.5: Deliver Statement of Reasons within 15 minutes
 * - Include appeal instructions and deadlines
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ModerationEmailRequest {
  userId: string;
  decisionId: string;
  statementId: string;
  action: string;
  appealDeadline: string;
}

function isServiceRoleRequest(req: Request, expected: string): boolean {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return Boolean(expected) && match[1] === expected;
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

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!isServiceRoleRequest(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: ModerationEmailRequest = await req.json();
    const { userId, decisionId, statementId, action, appealDeadline } = body;

    // Validate required fields
    if (!userId || !decisionId || !statementId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('email, preferred_language')
      .eq('id', userId)
      .single();

    if (userError || !user?.email) {
      console.error('Failed to get user email:', userError);
      return new Response(JSON.stringify({ error: 'User email not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get Statement of Reasons
    const { data: statement, error: statementError } = await supabase
      .from('statements_of_reasons')
      .select('*')
      .eq('id', statementId)
      .single();

    if (statementError || !statement) {
      console.error('Failed to get statement:', statementError);
      return new Response(JSON.stringify({ error: 'Statement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format email content
    const emailContent = formatModerationEmail(
      user.preferred_language || 'en',
      action,
      statement,
      appealDeadline
    );

    // Send email via email service (e.g., SendGrid, Resend, etc.)
    // This is a placeholder - integrate with your email provider
    const emailSent = await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailSent) {
      throw new Error('Failed to send email');
    }

    // Log email delivery
    await supabase.from('notification_delivery_log').insert({
      user_id: userId,
      notification_type: 'sor_delivered',
      decision_id: decisionId,
      statement_id: statementId,
      delivered_at: new Date().toISOString(),
      status: 'delivered',
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending moderation email:', error);

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
 * Format moderation email content
 */
function formatModerationEmail(
  language: string,
  action: string,
  statement: any,
  appealDeadline: string
): { subject: string; html: string; text: string } {
  const translations = getTranslations(language);

  const subject = translations.subject;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; margin-bottom: 10px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${translations.title}</h2>
        </div>
        
        <div class="content">
          <div class="section">
            <div class="section-title">${translations.actionTaken}</div>
            <p>${getActionText(action, language)}</p>
          </div>

          <div class="section">
            <div class="section-title">${translations.reasonTitle}</div>
            <p>${statement.facts_and_circumstances}</p>
          </div>

          <div class="section">
            <div class="section-title">${translations.legalBasis}</div>
            <p>${statement.decision_ground === 'illegal' ? translations.illegalContent : translations.termsViolation}</p>
            ${statement.legal_reference ? `<p><strong>${translations.reference}:</strong> ${statement.legal_reference}</p>` : ''}
          </div>

          <div class="section">
            <div class="section-title">${translations.automationTitle}</div>
            <p>${translations.automatedDetection}: ${statement.automated_detection ? translations.yes : translations.no}</p>
            <p>${translations.automatedDecision}: ${statement.automated_decision ? translations.yes : translations.no}</p>
          </div>

          <div class="section">
            <div class="section-title">${translations.appealTitle}</div>
            <p>${translations.appealText}</p>
            <p><strong>${translations.deadline}:</strong> ${new Date(appealDeadline).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}</p>
            <a href="${Deno.env.get('APP_URL')}/appeals/new?decision=${statement.decision_id}" class="button">${translations.submitAppeal}</a>
          </div>

          <div class="section">
            <div class="section-title">${translations.furtherOptions}</div>
            <ul>
              <li>${translations.internalAppeal}</li>
              <li>${translations.odsOption}</li>
              <li>${translations.courtOption}</li>
            </ul>
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

${translations.actionTaken}
${getActionText(action, language)}

${translations.reasonTitle}
${statement.facts_and_circumstances}

${translations.legalBasis}
${statement.decision_ground === 'illegal' ? translations.illegalContent : translations.termsViolation}
${statement.legal_reference ? `${translations.reference}: ${statement.legal_reference}` : ''}

${translations.automationTitle}
${translations.automatedDetection}: ${statement.automated_detection ? translations.yes : translations.no}
${translations.automatedDecision}: ${statement.automated_decision ? translations.yes : translations.no}

${translations.appealTitle}
${translations.appealText}
${translations.deadline}: ${new Date(appealDeadline).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}

${translations.furtherOptions}
- ${translations.internalAppeal}
- ${translations.odsOption}
- ${translations.courtOption}

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
      subject: 'Moderation Decision - Statement of Reasons',
      title: 'Moderation Decision',
      actionTaken: 'Action Taken',
      reasonTitle: 'Reason for Decision',
      legalBasis: 'Legal Basis',
      illegalContent: 'Illegal content',
      termsViolation: 'Terms of Service violation',
      reference: 'Legal reference',
      automationTitle: 'Use of Automated Systems',
      automatedDetection: 'Automated detection',
      automatedDecision: 'Automated decision',
      yes: 'Yes',
      no: 'No',
      appealTitle: 'Right to Appeal',
      appealText:
        'You have the right to appeal this decision. Please submit your appeal before the deadline.',
      deadline: 'Appeal deadline',
      submitAppeal: 'Submit Appeal',
      furtherOptions: 'Further Options',
      internalAppeal: 'Internal complaint handling (free of charge)',
      odsOption: 'Out-of-court dispute settlement',
      courtOption: 'Judicial redress',
      footer:
        'This is an automated message. For questions, please contact our support team.',
    },
    de: {
      subject: 'Moderationsentscheidung - Begründung',
      title: 'Moderationsentscheidung',
      actionTaken: 'Ergriffene Maßnahme',
      reasonTitle: 'Begründung der Entscheidung',
      legalBasis: 'Rechtsgrundlage',
      illegalContent: 'Illegaler Inhalt',
      termsViolation: 'Verstoß gegen Nutzungsbedingungen',
      reference: 'Gesetzliche Grundlage',
      automationTitle: 'Einsatz automatisierter Systeme',
      automatedDetection: 'Automatische Erkennung',
      automatedDecision: 'Automatische Entscheidung',
      yes: 'Ja',
      no: 'Nein',
      appealTitle: 'Beschwerderecht',
      appealText:
        'Sie haben das Recht, gegen diese Entscheidung Beschwerde einzulegen. Bitte reichen Sie Ihre Beschwerde vor Ablauf der Frist ein.',
      deadline: 'Beschwerde-Frist',
      submitAppeal: 'Beschwerde einreichen',
      furtherOptions: 'Weitere Optionen',
      internalAppeal: 'Internes Beschwerdeverfahren (kostenlos)',
      odsOption: 'Außergerichtliche Streitbeilegung',
      courtOption: 'Gerichtlicher Rechtsschutz',
      footer:
        'Dies ist eine automatische Nachricht. Bei Fragen wenden Sie sich bitte an unser Support-Team.',
    },
  };

  return translations[language] || translations.en;
}

/**
 * Get action text in specified language
 */
function getActionText(action: string, language: string): string {
  const actionTexts: Record<string, Record<string, string>> = {
    en: {
      no_action: 'No action taken - content reviewed',
      quarantine: 'Content quarantined - limited visibility',
      geo_block: 'Content geo-blocked in specific regions',
      remove: 'Content removed',
      suspend_user: 'Account suspended',
      rate_limit: 'Account rate-limited',
      shadow_ban: 'Account shadow-banned',
    },
    de: {
      no_action: 'Keine Maßnahme - Inhalt überprüft',
      quarantine: 'Inhalt unter Quarantäne - eingeschränkte Sichtbarkeit',
      geo_block: 'Inhalt in bestimmten Regionen gesperrt',
      remove: 'Inhalt entfernt',
      suspend_user: 'Konto gesperrt',
      rate_limit: 'Konto ratenbegrenzt',
      shadow_ban: 'Konto shadow-gebannt',
    },
  };

  const texts = actionTexts[language] || actionTexts.en;
  return texts[action] || action;
}

/**
 * Send email via email service
 * Placeholder - integrate with your email provider (SendGrid, Resend, etc.)
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  // TODO: Integrate with email service provider
  // Example with Resend:
  // const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
  // const { data, error } = await resend.emails.send({
  //   from: 'moderation@growbro.app',
  //   to: params.to,
  //   subject: params.subject,
  //   html: params.html,
  //   text: params.text,
  // });
  // return !error;

  console.log('Email would be sent to:', params.to);
  console.log('Subject:', params.subject);

  // For now, return true to simulate successful send
  return true;
}
