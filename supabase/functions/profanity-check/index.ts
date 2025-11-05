// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withRateLimit } from './_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ProfanityCheckRequest {
  text: string;
  field?: 'display_name' | 'bio'; // Optional field context for logging
}

interface ProfanityCheckResponse {
  isClean: boolean;
  message?: string;
}

/**
 * Basic profanity word list (expandable)
 * In production, consider using a more comprehensive library or service
 */
const PROFANITY_PATTERNS = [
  // Common profanity (add more as needed)
  /\b(fuck|shit|ass|damn|hell|bitch|bastard|cunt|dick|cock|pussy|whore|slut)\b/gi,
  // Cannabis-related inappropriate terms that violate policy
  /\b(dealer|dealing|sell|selling|buy|buying|purchase|trade)\b/gi,
  // Hate speech and slurs (expand as needed)
  /\b(nigger|faggot|retard|tranny)\b/gi,
  // Variations with special characters
  /f[\W_]*u[\W_]*c[\W_]*k/gi,
  /s[\W_]*h[\W_]*i[\W_]*t/gi,
];

/**
 * Check if text contains profanity
 * Returns true if clean, false if profanity detected
 */
function checkProfanity(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return true; // Empty text is clean
  }

  // Normalize text for checking
  const normalizedText = text.toLowerCase().trim();

  // Check against profanity patterns
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return false; // Profanity detected
    }
  }

  return true; // Clean
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
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit: 50 profanity checks per hour
    const rateLimitResponse = await withRateLimit(
      supabaseClient,
      user.id,
      {
        endpoint: 'profanity-check',
        limit: 50,
        windowSeconds: 3600,
      },
      corsHeaders
    );

    if (rateLimitResponse) {
      console.log(
        `[profanity-check] Rate limit exceeded for user ${user.id.slice(0, 8)}...`
      );
      return rateLimitResponse;
    }

    // Parse request body
    const body: ProfanityCheckRequest = await req.json();

    // Validate text
    if (!body.text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.text.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum 5000 characters.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Perform profanity check
    const isClean = checkProfanity(body.text);

    // Log for moderation review (without exposing specific words)
    if (!isClean) {
      console.log(
        `[profanity-check] Profanity detected for user ${user.id.slice(0, 8)}... in field: ${body.field || 'unknown'}`
      );

      // Optionally log to moderation table for review
      try {
        await supabaseClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'profanity_detected',
          resource_type: 'text_content',
          metadata: {
            field: body.field,
            text_length: body.text.length,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error(
          '[profanity-check] Failed to log audit entry:',
          auditError
        );
        // Continue even if audit logging fails
      }
    }

    // Return result without revealing specific blocked terms
    const response: ProfanityCheckResponse = {
      isClean,
      message: isClean
        ? 'Content is appropriate'
        : 'Content contains inappropriate language. Please revise.',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[profanity-check] Unexpected error:', error);
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
