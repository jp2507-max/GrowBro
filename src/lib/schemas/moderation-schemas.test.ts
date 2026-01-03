/**
 * Unit tests for DSA-compliant moderation validation schemas
 *
 * Tests validation for:
 * - Content Reports (DSA Art. 16)
 * - Statements of Reasons (DSA Art. 17 & 24(5))
 * - Trusted Flaggers (DSA Art. 22)
 * - Repeat Offenders (DSA Art. 23)
 * - Appeals (DSA Art. 20)
 *
 * Requirements: 1.3, 1.4, 11.2, 12.1
 */

import {
  appealInputSchema,
  auditEventInputSchema,
  contactInfoSchema,
  contentReportInputSchema,
  qualityMetricsSchema,
  redactedSoRSchema,
  repeatOffenderRecordInputSchema,
  reporterContactSchema,
  statementOfReasonsInputSchema,
  suspensionRecordSchema,
  trustedFlaggerInputSchema,
  validateAppeal,
  validateAuditEvent,
  validateContentReport,
  validateRepeatOffender,
  validateStatementOfReasons,
  validateTrustedFlagger,
} from './moderation-schemas';

// ============================================================================
// Content Reports (DSA Art. 16)
// ============================================================================

describe('contentReportInputSchema', () => {
  const validPolicyReport = {
    content_id: 'post-123',
    content_type: 'post' as const,
    content_locator: 'https://growbro.app/posts/123',
    report_type: 'policy_violation' as const,
    explanation:
      'This post violates community guidelines by promoting harmful cultivation practices that could endanger users.',
    reporter_contact: {
      name: 'John Doe',
      email: 'john@example.com',
    },
    good_faith_declaration: true,
  };

  const validIllegalReport = {
    ...validPolicyReport,
    report_type: 'illegal' as const,
    jurisdiction: 'DE',
    legal_reference: 'DE StGB §130',
    explanation:
      'This content appears to violate German law §130 regarding public incitement.',
  };

  describe('valid inputs', () => {
    it('should accept valid policy violation report', () => {
      const result = contentReportInputSchema.safeParse(validPolicyReport);
      expect(result.success).toBe(true);
    });

    it('should accept valid illegal content report with jurisdiction', () => {
      const result = contentReportInputSchema.safeParse(validIllegalReport);
      expect(result.success).toBe(true);
    });

    it('should accept pseudonymous reporter contact', () => {
      const report = {
        ...validPolicyReport,
        reporter_contact: { pseudonym: 'anonymous_user_123' },
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it('should accept optional evidence URLs', () => {
      const report = {
        ...validPolicyReport,
        evidence_urls: [
          'https://example.com/evidence1.jpg',
          'https://example.com/evidence2.png',
        ],
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(true);
    });
  });

  describe('validation failures', () => {
    it('should reject illegal report without jurisdiction', () => {
      const report = {
        ...validIllegalReport,
        jurisdiction: undefined,
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('jurisdiction');
        expect(result.error.issues[0].message).toContain(
          'Jurisdiction is required for illegal content reports'
        );
      }
    });

    it('should reject explanation shorter than 50 characters', () => {
      const report = {
        ...validPolicyReport,
        explanation: 'Too short',
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'minimum 50 characters'
        );
      }
    });

    it('should reject invalid content locator URL', () => {
      const report = {
        ...validPolicyReport,
        content_locator: 'not-a-url',
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid URL');
      }
    });

    it('should reject good_faith_declaration = false', () => {
      const report = {
        ...validPolicyReport,
        good_faith_declaration: false,
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Good faith declaration must be accepted'
        );
      }
    });

    it('should reject reporter_contact without name+email or pseudonym', () => {
      const report = {
        ...validPolicyReport,
        reporter_contact: {},
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'at least email, pseudonym, or name'
        );
      }
    });

    it('should reject invalid email format', () => {
      const report = {
        ...validPolicyReport,
        reporter_contact: {
          name: 'John Doe',
          email: 'not-an-email',
        },
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
    });

    it('should reject more than 10 evidence URLs', () => {
      const report = {
        ...validPolicyReport,
        evidence_urls: Array(11).fill('https://example.com/evidence.jpg'),
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Maximum 10');
      }
    });

    it('should reject invalid report_type', () => {
      const report = {
        ...validPolicyReport,
        report_type: 'invalid_type' as unknown as 'policy_violation',
      };
      const result = contentReportInputSchema.safeParse(report);
      expect(result.success).toBe(false);
    });
  });

  describe('validateContentReport function', () => {
    it('should return valid result for correct input', () => {
      const result = validateContentReport(validPolicyReport);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    it('should return actionable error messages for invalid input', () => {
      const invalidReport = {
        ...validPolicyReport,
        explanation: 'Too short',
      };
      const result = validateContentReport(invalidReport);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('explanation');
      expect(result.errors[0]).toContain('minimum 50 characters');
    });
  });
});

describe('reporterContactSchema', () => {
  it('should accept name and email', () => {
    const contact = { name: 'John Doe', email: 'john@example.com' };
    const result = reporterContactSchema.safeParse(contact);
    expect(result.success).toBe(true);
  });

  it('should accept pseudonym only', () => {
    const contact = { pseudonym: 'anonymous_123' };
    const result = reporterContactSchema.safeParse(contact);
    expect(result.success).toBe(true);
  });

  it('should reject empty pseudonym', () => {
    const contact = { pseudonym: '' };
    const result = reporterContactSchema.safeParse(contact);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Statements of Reasons (DSA Art. 17 & 24(5))
// ============================================================================

describe('statementOfReasonsInputSchema', () => {
  const validSoRTerms = {
    decision_id: '123e4567-e89b-12d3-a456-426614174000',
    decision_ground: 'terms' as const,
    content_type: 'post' as const,
    facts_and_circumstances:
      'The reported content contains promotional material for unapproved cultivation products, violating our community guidelines section 3.2 on product endorsements. Multiple users flagged this content.',
    automated_detection: false,
    automated_decision: false,
    redress: ['internal_appeal' as const, 'court' as const],
  };

  const validSoRIllegal = {
    ...validSoRTerms,
    decision_ground: 'illegal' as const,
    legal_reference: 'DE StGB §130',
    territorial_scope: ['DE', 'AT'],
  };

  describe('valid inputs', () => {
    it('should accept valid terms violation SoR', () => {
      const result = statementOfReasonsInputSchema.safeParse(validSoRTerms);
      expect(result.success).toBe(true);
    });

    it('should accept valid illegal content SoR with legal reference', () => {
      const result = statementOfReasonsInputSchema.safeParse(validSoRIllegal);
      expect(result.success).toBe(true);
    });

    it('should accept territorial scope array', () => {
      const sor = {
        ...validSoRTerms,
        territorial_scope: ['DE', 'FR', 'IT'],
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(true);
    });

    it('should accept all redress options', () => {
      const sor = {
        ...validSoRTerms,
        redress: ['internal_appeal' as const, 'ods' as const, 'court' as const],
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(true);
    });
  });

  describe('validation failures', () => {
    it('should reject illegal SoR without legal_reference', () => {
      const sor = {
        ...validSoRIllegal,
        legal_reference: undefined,
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Legal reference is required for illegal content decisions'
        );
      }
    });

    it('should reject facts_and_circumstances shorter than 100 characters', () => {
      const sor = {
        ...validSoRTerms,
        facts_and_circumstances: 'Too short',
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('min 100 characters');
      }
    });

    it('should reject invalid decision_id UUID', () => {
      const sor = {
        ...validSoRTerms,
        decision_id: 'not-a-uuid',
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(false);
    });

    it('should reject empty redress array', () => {
      const sor = {
        ...validSoRTerms,
        redress: [],
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'At least one redress option'
        );
      }
    });

    it('should reject invalid territorial scope format', () => {
      const sor = {
        ...validSoRTerms,
        territorial_scope: ['DEU'], // 3 letters instead of 2
      };
      const result = statementOfReasonsInputSchema.safeParse(sor);
      expect(result.success).toBe(false);
    });
  });

  describe('validateStatementOfReasons function', () => {
    it('should return valid result for correct input', () => {
      const result = validateStatementOfReasons(validSoRTerms);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    it('should return actionable error messages for invalid input', () => {
      const invalidSoR = {
        ...validSoRIllegal,
        legal_reference: undefined,
      };
      const result = validateStatementOfReasons(invalidSoR);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Legal reference is required');
    });
  });
});

describe('redactedSoRSchema', () => {
  const validRedactedSoR = {
    decision_id: '123e4567-e89b-12d3-a456-426614174000',
    decision_ground: 'terms' as const,
    content_type: 'post' as const,
    automated_detection: false,
    automated_decision: false,
    redress: ['internal_appeal' as const],
    created_at: new Date(),
    aggregated_data: {
      report_count: 5,
      evidence_type: 'mixed' as const,
      content_age: 'recent' as const,
      jurisdiction_count: 2,
      has_trusted_flagger: true,
    },
    pseudonymized_reporter_id: '1234567890abcdef',
    pseudonymized_moderator_id: 'abcdef1234567890',
    pseudonymized_decision_id: 'fedcba0987654321',
    scrubbing_metadata: {
      scrubbed_at: new Date(),
      scrubbing_version: '1.0.0',
      redacted_fields: ['reporter_contact', 'explanation', 'reasoning'],
      environment_salt_version: 'prod-v1',
      aggregation_suppression: {
        report_count: false,
        jurisdiction_count: false,
        k: 5,
      },
    },
  };

  it('should accept valid redacted SoR', () => {
    const result = redactedSoRSchema.safeParse(validRedactedSoR);
    expect(result.success).toBe(true);
  });

  it('should accept suppressed aggregated counts', () => {
    const sor = {
      ...validRedactedSoR,
      aggregated_data: {
        ...validRedactedSoR.aggregated_data,
        report_count: 'suppressed' as const,
        jurisdiction_count: 'suppressed' as const,
      },
    };
    const result = redactedSoRSchema.safeParse(sor);
    expect(result.success).toBe(true);
  });

  it('should reject invalid pseudonymized ID length', () => {
    const sor = {
      ...validRedactedSoR,
      pseudonymized_reporter_id: 'tooshort',
    };
    const result = redactedSoRSchema.safeParse(sor);
    expect(result.success).toBe(false);
  });

  it('should reject invalid scrubbing_version format', () => {
    const sor = {
      ...validRedactedSoR,
      scrubbing_metadata: {
        ...validRedactedSoR.scrubbing_metadata,
        scrubbing_version: '1.0', // Invalid semver
      },
    };
    const result = redactedSoRSchema.safeParse(sor);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Trusted Flaggers (DSA Art. 22)
// ============================================================================

describe('trustedFlaggerInputSchema', () => {
  const validTrustedFlagger = {
    organization_name: 'Internet Watch Foundation',
    contact_info: {
      email: 'contact@iwf.org',
      phone: '+44 20 1234 5678',
    },
    specialization: ['csam', 'terrorism'],
    status: 'active' as const,
    quality_metrics: {
      accuracy_rate: 95.5,
      average_handling_time_hours: 2.3,
      total_reports: 1000,
      upheld_decisions: 950,
    },
    certification_date: new Date('2024-01-01'),
    review_date: new Date('2025-01-01'),
  };

  describe('valid inputs', () => {
    it('should accept valid trusted flagger', () => {
      const result = trustedFlaggerInputSchema.safeParse(validTrustedFlagger);
      expect(result.success).toBe(true);
    });

    it('should accept multiple specialization areas', () => {
      const flagger = {
        ...validTrustedFlagger,
        specialization: ['hate_speech', 'misinformation', 'violence'],
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(true);
    });

    it('should accept optional quality metrics fields', () => {
      const flagger = {
        ...validTrustedFlagger,
        quality_metrics: {
          total_reports: 100,
          upheld_decisions: 85,
        },
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(true);
    });
  });

  describe('validation failures', () => {
    it('should reject accuracy_rate above 100', () => {
      const flagger = {
        ...validTrustedFlagger,
        quality_metrics: {
          ...validTrustedFlagger.quality_metrics,
          accuracy_rate: 101,
        },
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(false);
    });

    it('should reject negative accuracy_rate', () => {
      const flagger = {
        ...validTrustedFlagger,
        quality_metrics: {
          ...validTrustedFlagger.quality_metrics,
          accuracy_rate: -5,
        },
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(false);
    });

    it('should reject empty specialization array', () => {
      const flagger = {
        ...validTrustedFlagger,
        specialization: [],
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'At least one specialization area is required'
        );
      }
    });

    it('should reject invalid email format', () => {
      const flagger = {
        ...validTrustedFlagger,
        contact_info: {
          email: 'not-an-email',
        },
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(false);
    });

    it('should reject too many specialization areas', () => {
      const flagger = {
        ...validTrustedFlagger,
        specialization: Array(21).fill('area'),
      };
      const result = trustedFlaggerInputSchema.safeParse(flagger);
      expect(result.success).toBe(false);
    });
  });

  describe('validateTrustedFlagger function', () => {
    it('should return valid result for correct input', () => {
      const result = validateTrustedFlagger(validTrustedFlagger);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    it('should return actionable error messages for invalid input', () => {
      const invalidFlagger = {
        ...validTrustedFlagger,
        specialization: [],
      };
      const result = validateTrustedFlagger(invalidFlagger);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('specialization');
    });
  });
});

describe('qualityMetricsSchema', () => {
  it('should accept valid quality metrics', () => {
    const metrics = {
      accuracy_rate: 95.5,
      average_handling_time_hours: 2.5,
      total_reports: 1000,
      upheld_decisions: 950,
    };
    const result = qualityMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });

  it('should accept metrics with optional fields omitted', () => {
    const metrics = {
      total_reports: 50,
      upheld_decisions: 45,
    };
    const result = qualityMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(true);
  });

  it('should reject negative total_reports', () => {
    const metrics = {
      total_reports: -1,
      upheld_decisions: 0,
    };
    const result = qualityMetricsSchema.safeParse(metrics);
    expect(result.success).toBe(false);
  });
});

describe('contactInfoSchema', () => {
  it('should accept valid contact info', () => {
    const contact = {
      email: 'contact@example.com',
      phone: '+1 234 567 8900',
      address: '123 Main St, City, Country',
    };
    const result = contactInfoSchema.safeParse(contact);
    expect(result.success).toBe(true);
  });

  it('should accept email only', () => {
    const contact = { email: 'contact@example.com' };
    const result = contactInfoSchema.safeParse(contact);
    expect(result.success).toBe(true);
  });

  it('should reject missing email', () => {
    const contact = { phone: '+1 234 567 8900' };
    const result = contactInfoSchema.safeParse(contact);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Repeat Offenders (DSA Art. 23)
// ============================================================================

describe('repeatOffenderRecordInputSchema', () => {
  const validRepeatOffender = {
    user_id: 'user-123',
    violation_type: 'spam',
    violation_count: 3,
    escalation_level: 'warning' as const,
    last_violation_date: new Date(),
    suspension_history: [
      {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-08'),
        reason: 'First suspension for spam',
        duration_days: 7,
      },
    ],
    manifestly_unfounded_reports: 0,
    status: 'active' as const,
  };

  describe('valid inputs', () => {
    it('should accept valid repeat offender record', () => {
      const result =
        repeatOffenderRecordInputSchema.safeParse(validRepeatOffender);
      expect(result.success).toBe(true);
    });

    it('should accept all escalation levels', () => {
      const levels = [
        'warning' as const,
        'temporary_suspension' as const,
        'permanent_ban' as const,
      ];
      levels.forEach((level) => {
        const offender = {
          ...validRepeatOffender,
          escalation_level: level,
        };
        const result = repeatOffenderRecordInputSchema.safeParse(offender);
        expect(result.success).toBe(true);
      });
    });

    it('should accept empty suspension history with defaults', () => {
      const offender = {
        ...validRepeatOffender,
        suspension_history: undefined,
        manifestly_unfounded_reports: undefined,
      };
      const result = repeatOffenderRecordInputSchema.safeParse(offender);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.suspension_history).toEqual([]);
        expect(result.data.manifestly_unfounded_reports).toBe(0);
      }
    });
  });

  describe('validation failures', () => {
    it('should reject violation_count less than 1', () => {
      const offender = {
        ...validRepeatOffender,
        violation_count: 0,
      };
      const result = repeatOffenderRecordInputSchema.safeParse(offender);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 1');
      }
    });

    it('should reject negative manifestly_unfounded_reports', () => {
      const offender = {
        ...validRepeatOffender,
        manifestly_unfounded_reports: -1,
      };
      const result = repeatOffenderRecordInputSchema.safeParse(offender);
      expect(result.success).toBe(false);
    });

    it('should reject too large suspension history', () => {
      const offender = {
        ...validRepeatOffender,
        suspension_history: Array(101).fill({
          start: new Date(),
          reason: 'Test',
        }),
      };
      const result = repeatOffenderRecordInputSchema.safeParse(offender);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const offender = {
        ...validRepeatOffender,
        status: 'invalid' as unknown as 'active',
      };
      const result = repeatOffenderRecordInputSchema.safeParse(offender);
      expect(result.success).toBe(false);
    });
  });

  describe('validateRepeatOffender function', () => {
    it('should return valid result for correct input', () => {
      const result = validateRepeatOffender(validRepeatOffender);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    it('should return actionable error messages for invalid input', () => {
      const invalidOffender = {
        ...validRepeatOffender,
        violation_count: 0,
      };
      const result = validateRepeatOffender(invalidOffender);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('violation_count');
    });
  });
});

describe('suspensionRecordSchema', () => {
  it('should accept valid suspension record', () => {
    const suspension = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-08'),
      reason: 'Violation of community guidelines',
      duration_days: 7,
    };
    const result = suspensionRecordSchema.safeParse(suspension);
    expect(result.success).toBe(true);
  });

  it('should accept suspension without end date (ongoing)', () => {
    const suspension = {
      start: new Date('2024-01-01'),
      reason: 'Permanent ban',
    };
    const result = suspensionRecordSchema.safeParse(suspension);
    expect(result.success).toBe(true);
  });

  it('should reject duration_days less than 1', () => {
    const suspension = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-02'),
      reason: 'Test',
      duration_days: 0,
    };
    const result = suspensionRecordSchema.safeParse(suspension);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Appeals (DSA Art. 20)
// ============================================================================

describe('appealInputSchema', () => {
  const validAppeal = {
    original_decision_id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: 'user-123',
    appeal_type: 'content_removal' as const,
    counter_arguments:
      'I believe the moderation decision was incorrect because my post was educational and complied with all community guidelines. The content discussed legal cultivation practices in jurisdictions where it is permitted.',
    supporting_evidence: [
      'https://example.com/evidence1.pdf',
      'https://example.com/evidence2.jpg',
    ],
  };

  describe('valid inputs', () => {
    it('should accept valid appeal', () => {
      const result = appealInputSchema.safeParse(validAppeal);
      expect(result.success).toBe(true);
    });

    it('should accept all appeal types', () => {
      const types = [
        'content_removal' as const,
        'account_action' as const,
        'geo_restriction' as const,
      ];
      types.forEach((type) => {
        const appeal = {
          ...validAppeal,
          appeal_type: type,
        };
        const result = appealInputSchema.safeParse(appeal);
        expect(result.success).toBe(true);
      });
    });

    it('should accept appeal without supporting evidence', () => {
      const appeal = {
        ...validAppeal,
        supporting_evidence: undefined,
      };
      const result = appealInputSchema.safeParse(appeal);
      expect(result.success).toBe(true);
    });
  });

  describe('validation failures', () => {
    it('should reject counter_arguments shorter than 50 characters', () => {
      const appeal = {
        ...validAppeal,
        counter_arguments: 'Too short',
      };
      const result = appealInputSchema.safeParse(appeal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('min 50 characters');
      }
    });

    it('should reject invalid decision_id UUID', () => {
      const appeal = {
        ...validAppeal,
        original_decision_id: 'not-a-uuid',
      };
      const result = appealInputSchema.safeParse(appeal);
      expect(result.success).toBe(false);
    });

    it('should reject invalid evidence URL', () => {
      const appeal = {
        ...validAppeal,
        supporting_evidence: ['not-a-url'],
      };
      const result = appealInputSchema.safeParse(appeal);
      expect(result.success).toBe(false);
    });

    it('should reject more than 10 evidence URLs', () => {
      const appeal = {
        ...validAppeal,
        supporting_evidence: Array(11).fill('https://example.com/evidence.jpg'),
      };
      const result = appealInputSchema.safeParse(appeal);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAppeal function', () => {
    it('should return valid result for correct input', () => {
      const result = validateAppeal(validAppeal);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    it('should return actionable error messages for invalid input', () => {
      const invalidAppeal = {
        ...validAppeal,
        counter_arguments: 'Short',
      };
      const result = validateAppeal(invalidAppeal);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('counter_arguments');
    });
  });
});

// ============================================================================
// Audit Events
// ============================================================================

describe('auditEventInputSchema', () => {
  const validAuditEvent = {
    event_type: 'report_submitted' as const,
    actor_id: 'user-123',
    actor_type: 'user' as const,
    target_id: 'post-456',
    target_type: 'post',
    action: 'submit_content_report',
    metadata: {
      report_id: 'report-789',
      report_type: 'policy_violation',
    },
    pii_tagged: false,
  };

  describe('valid inputs', () => {
    it('should accept valid audit event', () => {
      const result = auditEventInputSchema.safeParse(validAuditEvent);
      expect(result.success).toBe(true);
    });

    it('should accept all event types', () => {
      const types = [
        'report_submitted',
        'decision_made',
        'appeal_filed',
        'sor_submitted',
        'partition_sealed',
        'signature_verified',
        'audit_integrity_check',
        'legal_hold_applied',
        'court_order_received',
      ] as const;

      types.forEach((type) => {
        const event = {
          ...validAuditEvent,
          event_type: type,
        };
        const result = auditEventInputSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });

    it('should accept event without metadata', () => {
      const event = {
        ...validAuditEvent,
        metadata: undefined,
      };
      const result = auditEventInputSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should default pii_tagged to false', () => {
      const event = {
        ...validAuditEvent,
        pii_tagged: undefined,
      };
      const result = auditEventInputSchema.safeParse(event);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pii_tagged).toBe(false);
      }
    });
  });

  describe('validation failures', () => {
    it('should reject invalid actor_type', () => {
      const event = {
        ...validAuditEvent,
        actor_type: 'invalid' as unknown as 'moderator',
      };
      const result = auditEventInputSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    it('should reject action longer than 200 characters', () => {
      const event = {
        ...validAuditEvent,
        action: 'a'.repeat(201),
      };
      const result = auditEventInputSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAuditEvent function', () => {
    it('should return valid result for correct input', () => {
      const result = validateAuditEvent(validAuditEvent);
      expect(result.is_valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toBeDefined();
    });

    it('should return actionable error messages for invalid input', () => {
      const invalidEvent = {
        ...validAuditEvent,
        actor_type: 'invalid',
      };
      const result = validateAuditEvent(invalidEvent);
      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
