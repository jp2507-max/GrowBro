// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

/**
 * Generates HMAC-SHA256 signature for audit event payload
 *
 * This function runs server-side to keep the signature secret secure
 * and avoid Node.js crypto compatibility issues in React Native.
 */

interface AuditPayload {
  event_type: string;
  actor_id: string;
  actor_type: string;
  target_id: string;
  target_type: string;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const payload: AuditPayload = await req.json();

    // Validate required fields
    const requiredFields = [
      'event_type',
      'actor_id',
      'actor_type',
      'target_id',
      'target_type',
      'action',
      'timestamp',
    ];

    for (const field of requiredFields) {
      if (!(field in payload)) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Get signature secret from environment
    const secret = Deno.env.get('AUDIT_SIGNATURE_SECRET');
    if (!secret) {
      console.error('AUDIT_SIGNATURE_SECRET environment variable not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create deterministic string representation by sorting keys
    const canonicalPayload = {
      event_type: payload.event_type,
      actor_id: payload.actor_id,
      actor_type: payload.actor_type,
      target_id: payload.target_id,
      target_type: payload.target_type,
      action: payload.action,
      metadata: payload.metadata || {},
      timestamp: payload.timestamp,
    };

    // Sort object keys recursively for deterministic serialization
    const sortedPayload = sortObjectKeys(canonicalPayload);
    const payloadString = JSON.stringify(sortedPayload);

    // Generate HMAC-SHA256 signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadString)
    );

    // Convert to hex string
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return new Response(JSON.stringify({ signature: signatureHex }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating audit signature:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Recursively sorts object keys for deterministic JSON serialization
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, any> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObjectKeys(obj[key]);
    });

  return sorted;
}
