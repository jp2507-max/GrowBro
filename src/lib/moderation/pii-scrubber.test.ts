import { cleanup } from '@/lib/test-utils';

import { PIIScrubberClass } from './pii-scrubber';

afterEach(cleanup);

describe('PIIScrubber', () => {
  let scrubber: PIIScrubberClass;

  beforeEach(() => {
    scrubber = new PIIScrubberClass();
  });

  describe('validateRedaction', () => {
    test('returns valid for properly redacted SoR', () => {
      const validRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a', // 16 chars
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1', // 16 chars
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2', // 16 chars
        scrubbing_metadata: {
          scrubbed_at: new Date(),
          scrubbing_version: '1.0.0',
          redacted_fields: [
            'facts_and_circumstances',
            'explanation',
            'reasoning',
            'counter_arguments',
            'description',
            'metadata',
            'reporter_contact',
            'personal_identifiers',
            'contact_info',
            'reporter_id',
            'moderator_id',
            'user_id',
            'content_locator',
            'evidence_urls',
            'evidence',
            'supporting_evidence',
            'ip_address',
            'location_data',
          ],
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: false,
            jurisdiction_count: false,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(validRedactedSoR as any);

      expect(result.is_valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('detects presence of redacted fields', () => {
      const invalidRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        // Redacted fields that should not be present
        facts_and_circumstances: 'This should be redacted',
        reporter_id: 'user-123',
        evidence: ['evidence1', 'evidence2'],
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a',
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1',
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2',
        scrubbing_metadata: {
          scrubbed_at: new Date(),
          scrubbing_version: '1.0.0',
          redacted_fields: [
            'facts_and_circumstances',
            'explanation',
            'reasoning',
            'counter_arguments',
            'description',
            'metadata',
            'reporter_contact',
            'personal_identifiers',
            'contact_info',
            'reporter_id',
            'moderator_id',
            'user_id',
            'content_locator',
            'evidence_urls',
            'evidence',
            'supporting_evidence',
            'ip_address',
            'location_data',
          ],
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: false,
            jurisdiction_count: false,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(invalidRedactedSoR as any);

      expect(result.is_valid).toBe(false);
      expect(result.violations).toContain(
        'Redacted field "facts_and_circumstances" is still present'
      );
      expect(result.violations).toContain(
        'Redacted field "reporter_id" is still present'
      );
      expect(result.violations).toContain(
        'Redacted field "evidence" is still present'
      );
    });

    test('detects insufficiently hashed pseudonymized IDs', () => {
      const invalidRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        // Insufficiently hashed IDs (less than 16 chars)
        pseudonymized_reporter_id: 'short', // Too short
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1', // OK
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2', // OK
        scrubbing_metadata: {
          scrubbed_at: new Date(),
          scrubbing_version: '1.0.0',
          redacted_fields: [],
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: false,
            jurisdiction_count: false,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(invalidRedactedSoR as any);

      expect(result.is_valid).toBe(false);
      expect(result.violations).toContain(
        'Pseudonymized IDs appear to be insufficiently hashed'
      );
    });

    test('detects missing scrubbing metadata', () => {
      const invalidRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a',
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1',
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2',
        // Missing scrubbing_metadata
      };

      const result = scrubber.validateRedaction(invalidRedactedSoR as any);

      expect(result.is_valid).toBe(false);
      expect(result.violations).toContain('Scrubbing metadata is missing');
    });

    test('detects missing scrubbing timestamp', () => {
      const invalidRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a',
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1',
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2',
        scrubbing_metadata: {
          // Missing scrubbed_at
          scrubbing_version: '1.0.0',
          redacted_fields: ['field1'],
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: false,
            jurisdiction_count: false,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(invalidRedactedSoR as any);

      expect(result.is_valid).toBe(false);
      expect(result.violations).toContain('Scrubbing timestamp is missing');
    });

    test('detects missing scrubbing version', () => {
      const invalidRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a',
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1',
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2',
        scrubbing_metadata: {
          scrubbed_at: new Date(),
          // Missing scrubbing_version
          redacted_fields: ['field1'],
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: false,
            jurisdiction_count: false,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(invalidRedactedSoR as any);

      expect(result.is_valid).toBe(false);
      expect(result.violations).toContain('Scrubbing version is missing');
    });

    test('detects missing or empty redacted fields list', () => {
      const invalidRedactedSoR = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 10,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 5,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a',
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1',
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2',
        scrubbing_metadata: {
          scrubbed_at: new Date(),
          scrubbing_version: '1.0.0',
          // Missing redacted_fields
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: false,
            jurisdiction_count: false,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(invalidRedactedSoR as any);

      expect(result.is_valid).toBe(false);
      expect(result.violations).toContain(
        'Redacted fields list is missing or empty'
      );
    });

    test('handles aggregation suppression validation', () => {
      const redactedSoRWithSuppression = {
        decision_id: 'test-decision-id',
        decision_ground: 'illegal',
        legal_reference: 'Article 14 DSA',
        content_type: 'post',
        automated_detection: false,
        automated_decision: false,
        territorial_scope: 'EU',
        redress: 'appeal',
        transparency_db_id: 'transparency-id',
        created_at: new Date().toISOString(),
        aggregated_data: {
          report_count: 'suppressed' as const,
          evidence_type: 'text' as const,
          content_age: 'new' as const,
          jurisdiction_count: 'suppressed' as const,
          has_trusted_flagger: true,
        },
        pseudonymized_reporter_id: 'a1b2c3d4e5f6789a',
        pseudonymized_moderator_id: 'b2c3d4e5f6789ab1',
        pseudonymized_decision_id: 'c3d4e5f6789ab2c2',
        scrubbing_metadata: {
          scrubbed_at: new Date(),
          scrubbing_version: '1.0.0',
          redacted_fields: ['facts_and_circumstances'],
          environment_salt_version: '1',
          aggregation_suppression: {
            report_count: true,
            jurisdiction_count: true,
            k: 5,
          },
        },
      };

      const result = scrubber.validateRedaction(
        redactedSoRWithSuppression as any
      );

      expect(result.is_valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
