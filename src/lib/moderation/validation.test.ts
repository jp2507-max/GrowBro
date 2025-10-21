/**
 * Unit tests for DSA Art. 16 validation schemas
 *
 * Tests validation of content reports with actionable error messages
 */

import {
  validateContentLocator,
  validateContentReportInput,
  validateExplanationSubstantiation,
  validateGoodFaithDeclaration,
  validateReportTypeRequirements,
} from '@/lib/moderation/validation';
import type { ContentReportInput } from '@/types/moderation';

describe('validateContentReportInput', () => {
  const validReport: ContentReportInput = {
    content_id: '123',
    content_type: 'post',
    content_locator: 'https://example.com/posts/123',
    report_type: 'policy_violation',
    explanation:
      'This post contains spam and promotional content that violates community guidelines',
    reporter_contact: {
      email: 'reporter@example.com',
    },
    good_faith_declaration: true,
  };

  describe('Valid inputs', () => {
    test('accepts valid policy violation report', () => {
      const result = validateContentReportInput(validReport);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('accepts valid illegal content report with jurisdiction and legal reference', () => {
      const illegalReport: ContentReportInput = {
        ...validReport,
        report_type: 'illegal',
        jurisdiction: 'DE',
        legal_reference: 'DE StGB §130',
      };

      const result = validateContentReportInput(illegalReport);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('accepts report with pseudonymous contact', () => {
      const pseudonymousReport: ContentReportInput = {
        ...validReport,
        reporter_contact: {
          pseudonym: 'anonymous_reporter_123',
        },
      };

      const result = validateContentReportInput(pseudonymousReport);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('accepts report with evidence URLs', () => {
      const reportWithEvidence: ContentReportInput = {
        ...validReport,
        evidence_urls: [
          'https://example.com/evidence1.jpg',
          'https://example.com/evidence2.png',
        ],
      };

      const result = validateContentReportInput(reportWithEvidence);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Invalid inputs', () => {
    test('rejects report without content_id', () => {
      const invalidReport = { ...validReport, content_id: '' };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'content_id',
          message: 'Content ID is required',
        })
      );
    });

    test('rejects report with invalid content_type', () => {
      const invalidReport = { ...validReport, content_type: 'invalid' as any };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'content_type',
          message: 'Invalid content type',
        })
      );
    });

    test('rejects report with invalid content_locator URL', () => {
      const invalidReport = { ...validReport, content_locator: 'not-a-url' };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'content_locator',
          message: 'Content locator must be a valid URL',
        })
      );
    });

    test('rejects report with explanation too short (< 50 chars)', () => {
      const invalidReport = { ...validReport, explanation: 'Too short' };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'explanation',
          message: expect.stringContaining('minimum 50 characters'),
        })
      );
    });

    test('rejects report with explanation too long (> 5000 chars)', () => {
      const longExplanation = 'a'.repeat(5001);
      const invalidReport = { ...validReport, explanation: longExplanation };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'explanation',
          message: expect.stringContaining('maximum 5000 characters'),
        })
      );
    });

    test('rejects report without good_faith_declaration', () => {
      const invalidReport = {
        ...validReport,
        good_faith_declaration: false,
      };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'good_faith_declaration',
          message: 'Good faith declaration must be accepted',
        })
      );
    });

    test('rejects illegal report without jurisdiction', () => {
      const illegalReport: ContentReportInput = {
        ...validReport,
        report_type: 'illegal',
        legal_reference: 'DE StGB §130',
      };

      const result = validateContentReportInput(illegalReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'jurisdiction',
          message: 'Jurisdiction is required for illegal content reports',
        })
      );
    });

    test('rejects illegal report without legal_reference', () => {
      const illegalReport: ContentReportInput = {
        ...validReport,
        report_type: 'illegal',
        jurisdiction: 'DE',
      };

      const result = validateContentReportInput(illegalReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'legal_reference',
          message: expect.stringContaining('required for illegal content'),
        })
      );
    });

    test('rejects invalid jurisdiction format', () => {
      const illegalReport: ContentReportInput = {
        ...validReport,
        report_type: 'illegal',
        jurisdiction: 'DEU', // Should be 2-char ISO code
        legal_reference: 'DE StGB §130',
      };

      const result = validateContentReportInput(illegalReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'jurisdiction',
          message: expect.stringContaining('ISO 3166-1 alpha-2'),
        })
      );
    });

    test('rejects report with too many evidence URLs (> 10)', () => {
      const manyUrls = Array.from(
        { length: 11 },
        (_, i) => `https://example.com/evidence${i}.jpg`
      );
      const invalidReport = { ...validReport, evidence_urls: manyUrls };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'evidence_urls',
          message: 'Maximum 10 evidence URLs allowed',
        })
      );
    });

    test('rejects report with invalid evidence URL', () => {
      const invalidReport = {
        ...validReport,
        evidence_urls: ['not-a-url'],
      };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'evidence_urls.0',
          message: 'Evidence URL must be valid',
        })
      );
    });

    test('rejects report without any contact method', () => {
      const invalidReport = {
        ...validReport,
        reporter_contact: {},
      };

      const result = validateContentReportInput(invalidReport);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'reporter_contact',
          message: expect.stringContaining(
            'at least email, pseudonym, or name'
          ),
        })
      );
    });
  });
});

describe('validateReportTypeRequirements', () => {
  test('allows policy violation without jurisdiction', () => {
    expect(() => {
      validateReportTypeRequirements('policy_violation');
    }).not.toThrow();
  });

  test('throws for illegal report without jurisdiction', () => {
    expect(() => {
      validateReportTypeRequirements('illegal', undefined, 'DE StGB §130');
    }).toThrow('Jurisdiction is required');
  });

  test('throws for illegal report without legal reference', () => {
    expect(() => {
      validateReportTypeRequirements('illegal', 'DE');
    }).toThrow('Legal reference is required');
  });

  test('allows illegal report with both jurisdiction and legal reference', () => {
    expect(() => {
      validateReportTypeRequirements('illegal', 'DE', 'DE StGB §130');
    }).not.toThrow();
  });
});

describe('validateExplanationSubstantiation', () => {
  test('allows explanation with sufficient detail (>= 50 chars)', () => {
    const validExplanation =
      'This content violates community guidelines by promoting spam';

    expect(() => {
      validateExplanationSubstantiation(validExplanation);
    }).not.toThrow();
  });

  test('throws for empty explanation', () => {
    expect(() => {
      validateExplanationSubstantiation('');
    }).toThrow('Explanation is required');
  });

  test('throws for explanation too short', () => {
    expect(() => {
      validateExplanationSubstantiation('Too short');
    }).toThrow('minimum 50 characters');
  });

  test('throws for explanation too long', () => {
    const tooLong = 'a'.repeat(5001);

    expect(() => {
      validateExplanationSubstantiation(tooLong);
    }).toThrow('maximum 5000 characters');
  });
});

describe('validateContentLocator', () => {
  test('allows valid URL', () => {
    expect(() => {
      validateContentLocator('https://example.com/posts/123');
    }).not.toThrow();
  });

  test('throws for empty locator', () => {
    expect(() => {
      validateContentLocator('');
    }).toThrow('Content locator is required');
  });

  test('throws for invalid URL', () => {
    expect(() => {
      validateContentLocator('not-a-url');
    }).toThrow('must be a valid URL');
  });
});

describe('validateGoodFaithDeclaration', () => {
  test('allows true declaration', () => {
    expect(() => {
      validateGoodFaithDeclaration(true);
    }).not.toThrow();
  });

  test('throws for false declaration', () => {
    expect(() => {
      validateGoodFaithDeclaration(false);
    }).toThrow('must declare');
  });
});
