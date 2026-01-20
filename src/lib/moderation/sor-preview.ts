import { client } from '@/api/common';
import { supabase } from '@/lib/supabase';
import type {
  RedactedSoR,
  RedactionDiff,
  SoRPreview,
  StatementOfReasons,
} from '@/types/moderation';

/**
 * Generate SoR preview with both user-facing and redacted versions
 * TODO: Integrate with actual SoR generation and PII scrubbing pipeline from Task 5
 */
export async function generateSoRPreview(
  decisionId: string
): Promise<SoRPreview> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Authentication required to fetch SoR preview');
  }

  const response = await client.get<SoRPreview>(
    `/moderation/decisions/${decisionId}/sor-preview`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Calculate diff between user-facing and redacted SoR
 */
export function calculateSoRDiff(
  userFacing: StatementOfReasons,
  redacted: RedactedSoR
): RedactionDiff {
  const userFacingFields = Object.keys(userFacing);
  const redactedFields: string[] = [];
  const preservedFields: string[] = [];
  const aggregatedFields: string[] = [];
  const pseudonymizedFields: string[] = [];

  // Check which fields were removed
  userFacingFields.forEach((field) => {
    if (!(field in redacted)) {
      redactedFields.push(field);
    } else if (field.startsWith('pseudonymized_')) {
      pseudonymizedFields.push(field);
    } else {
      preservedFields.push(field);
    }
  });

  // Aggregated fields are in redacted.aggregated_data
  if (redacted.aggregated_data) {
    aggregatedFields.push(...Object.keys(redacted.aggregated_data));
  }

  return {
    user_facing_fields: userFacingFields,
    redacted_fields: redactedFields,
    preserved_fields: preservedFields,
    aggregated_fields: aggregatedFields,
    pseudonymized_fields: pseudonymizedFields,
  };
}

/**
 * Validate that redacted SoR contains no PII
 * TODO: Implement comprehensive PII detection
 */
export function validateNoPII(redacted: RedactedSoR): {
  no_pii_detected: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for common PII patterns
  const piiPatterns = [
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      type: 'email',
    },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'SSN' },
  ];

  const redactedStr = JSON.stringify(redacted);

  piiPatterns.forEach(({ pattern, type }) => {
    if (pattern.test(redactedStr)) {
      errors.push(`Potential ${type} detected in redacted SoR`);
    }
  });

  // Check for pseudonymized fields
  const hex16Regex = /^[a-f0-9]{16}$/i;
  if (
    redacted.pseudonymized_reporter_id &&
    !hex16Regex.test(redacted.pseudonymized_reporter_id)
  ) {
    warnings.push('Reporter ID should be pseudonymized (16-char hex string)');
  }
  if (
    redacted.pseudonymized_moderator_id &&
    !hex16Regex.test(redacted.pseudonymized_moderator_id)
  ) {
    warnings.push('Moderator ID should be pseudonymized (16-char hex string)');
  }

  return {
    no_pii_detected: errors.length === 0,
    errors,
    warnings,
  };
}
