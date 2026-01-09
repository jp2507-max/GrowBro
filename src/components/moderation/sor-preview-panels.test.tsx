import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';

import { SoRPreviewPanels } from './sor-preview-panels';
afterEach(cleanup);

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Return the key for testing purposes
      const translations: Record<string, string> = {
        'moderation.sor_preview.fields.decision_ground': 'Decision Ground',
        'moderation.sor_preview.fields.legal_reference': 'Legal Reference',
        'moderation.sor_preview.fields.content_type': 'Content Type',
        'moderation.sor_preview.fields.automated_detection':
          'Automated Detection',
        'moderation.sor_preview.fields.automated_decision':
          'Automated Decision',
        'moderation.sor_preview.fields.territorial_scope': 'Territorial Scope',
        'moderation.sor_preview.fields.redress_options': 'Redress Options',
        'moderation.sor_preview.fields.pseudonymized_reporter':
          'Pseudonymized Reporter',
        'moderation.sor_preview.fields.pseudonymized_moderator':
          'Pseudonymized Moderator',
        'moderation.sor_preview.fields.aggregated_report_count':
          'Aggregated Report Count',
        'moderation.sor_preview.fields.aggregated_report_count_suppressed':
          'Suppressed (k-anonymity)',
        'moderation.sor_preview.fields.evidence_type': 'Evidence Type',
        'moderation.sor_preview.fields.content_age': 'Content Age',
        'moderation.sor_preview.fields.scrubbed_at': 'Scrubbed At',
        'moderation.sor_preview.fields.scrubbing_version': 'Scrubbing Version',
        'moderation.sor_preview.fields.facts_and_circumstances':
          'Facts & Circumstances',
        'moderation.sor_preview.fields.created_at': 'Created At',
        'moderation.sor_preview.fields.yes': 'Yes',
        'moderation.sor_preview.fields.no': 'No',
        'moderation.sor_preview.fields.legal_reference_n_a': 'N/A',
        'moderation.sor_preview.fields.territorial_scope_global': 'Global',
        'moderation.sor_preview.user_facing_title': 'User-Facing SoR',
        'moderation.sor_preview.redacted_title': 'Redacted SoR (EC Submission)',
        'moderation.sor_preview.validation.no_pii_detected':
          '✓ No PII Detected',
        'moderation.transformed': '(transformed)',
      };
      return translations[key] || key;
    },
  }),
}));

const mockUserFacing = {
  id: 'sor-1',
  decision_id: 'dec-1',
  decision_ground: 'Violation of community guidelines' as any,
  legal_reference: 'Community Guidelines §3.1',
  content_type: 'Text Post' as any,
  facts_and_circumstances: 'User posted inappropriate content',
  automated_detection: true,
  automated_decision: false,
  territorial_scope: ['US', 'EU'],
  redress: ['Appeal', 'Contact Support'] as any,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
};

const mockRedacted = {
  decision_id: 'dec-1',
  decision_ground: 'Violation of community guidelines' as any,
  legal_reference: 'Community Guidelines §3.1',
  content_type: 'Text Post' as any,
  automated_detection: true,
  automated_decision: false,
  territorial_scope: ['US', 'EU'],
  redress: ['Appeal', 'Contact Support'] as any,
  pseudonymized_reporter_id: 'user_123',
  pseudonymized_moderator_id: 'mod_456',
  pseudonymized_decision_id: 'pdec_789',
  created_at: new Date('2024-01-01T00:00:00Z'),
  aggregated_data: {
    report_count: 5,
    evidence_type: 'Screenshot' as any,
    content_age: '2 days' as any,
    jurisdiction_count: 2,
    has_trusted_flagger: false,
  },
  scrubbing_metadata: {
    scrubbed_at: new Date('2024-01-01T01:00:00Z'),
    scrubbing_version: '1.0.0',
    redacted_fields: ['user_id'],
    environment_salt_version: 'v1',
    aggregation_suppression: {
      report_count: false,
      jurisdiction_count: false,
      k: 5,
    },
  },
};

const mockRedactedSuppressed = {
  ...mockRedacted,
  aggregated_data: {
    ...mockRedacted.aggregated_data,
    report_count: 'suppressed' as const,
  },
  scrubbing_metadata: {
    ...mockRedacted.scrubbing_metadata,
    aggregation_suppression: {
      report_count: true,
      jurisdiction_count: false,
      k: 5,
    },
  },
};

describe('SoRPreviewPanels', () => {
  beforeAll(() => {
    // Global setup
  });

  beforeEach(() => {
    // Reset mocks and state
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(
        <SoRPreviewPanels userFacing={mockUserFacing} redacted={mockRedacted} />
      );
      expect(await screen.findByTestId('sor-preview')).toBeOnTheScreen();
    });

    test('renders user-facing and redacted panels', async () => {
      setup(
        <SoRPreviewPanels userFacing={mockUserFacing} redacted={mockRedacted} />
      );

      // Check that both panels are rendered
      expect(await screen.findByText('User-Facing SoR')).toBeOnTheScreen();
      expect(
        await screen.findByText('Redacted SoR (EC Submission)')
      ).toBeOnTheScreen();
    });

    test('renders translated field labels', async () => {
      setup(
        <SoRPreviewPanels userFacing={mockUserFacing} redacted={mockRedacted} />
      );

      // Check that the component renders translated content (basic smoke test)
      expect(await screen.findByTestId('sor-preview')).toBeOnTheScreen();
      expect(await screen.findByText('User-Facing SoR')).toBeOnTheScreen();
      expect(
        await screen.findByText('Redacted SoR (EC Submission)')
      ).toBeOnTheScreen();
    });

    test('displays suppressed count with i18n', async () => {
      setup(
        <SoRPreviewPanels
          userFacing={mockUserFacing}
          redacted={mockRedactedSuppressed}
        />
      );

      // Check that suppressed count is translated
      expect(
        await screen.findByText('Suppressed (k-anonymity)')
      ).toBeOnTheScreen();
    });
  });

  describe('Props and Effects', () => {
    test('displays validation status when provided', async () => {
      const validationStatus = {
        no_pii_detected: true,
        errors: [],
        warnings: [],
      };

      setup(
        <SoRPreviewPanels
          userFacing={mockUserFacing}
          redacted={mockRedacted}
          validationStatus={validationStatus}
        />
      );

      expect(await screen.findByText('✓ No PII Detected')).toBeOnTheScreen();
    });

    test('displays custom testID', async () => {
      setup(
        <SoRPreviewPanels
          userFacing={mockUserFacing}
          redacted={mockRedacted}
          testID="custom-test-id"
        />
      );

      expect(await screen.findByTestId('custom-test-id')).toBeOnTheScreen();
    });
  });
});
