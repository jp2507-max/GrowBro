import React from 'react';

import { cleanup, screen, setup } from '@/lib/test-utils';
import type { ModerationDecision } from '@/types/moderation';

import { OriginalDecisionContext } from './original-decision-context';

afterEach(cleanup);

const mockOriginalDecision: ModerationDecision = {
  id: 'decision-123',
  report_id: 'report-123',
  moderator_id: 'mod-123',
  supervisor_id: 'supervisor-123',
  action: 'remove',
  policy_violations: ['pol_123', 'pol_456'],
  reasoning: 'Test reasoning',
  evidence: ['evidence1', 'evidence2'],
  statement_of_reasons_id: 'sor-123',
  status: 'approved',
  requires_supervisor_approval: false,
  executed_at: new Date('2024-01-01'),
  reversed_at: undefined,
  reversal_reason: undefined,
  user_id: 'user-123',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: undefined,
};

describe('OriginalDecisionContext', () => {
  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(
        <OriginalDecisionContext originalDecision={mockOriginalDecision} />
      );
      expect(
        await screen.findByTestId('original-decision-container')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('original-decision-title')).toBeOnTheScreen();
      expect(
        screen.getByTestId('original-decision-action-value')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('original-decision-reasoning-value')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('original-decision-policy-violations-value')
      ).toBeOnTheScreen();
    });

    test('displays the action correctly', async () => {
      setup(
        <OriginalDecisionContext originalDecision={mockOriginalDecision} />
      );
      expect(
        await screen.findByTestId('original-decision-action-value')
      ).toHaveTextContent('remove');
    });

    test('displays the reasoning correctly', async () => {
      setup(
        <OriginalDecisionContext originalDecision={mockOriginalDecision} />
      );
      expect(
        await screen.findByTestId('original-decision-reasoning-value')
      ).toHaveTextContent('Test reasoning');
    });

    test('displays policy violations with fallback IDs when no translations exist', async () => {
      setup(
        <OriginalDecisionContext originalDecision={mockOriginalDecision} />
      );
      const policyViolationsValue = await screen.findByTestId(
        'original-decision-policy-violations-value'
      );
      expect(policyViolationsValue).toHaveTextContent('pol_123, pol_456');
    });

    test('displays fallback message when policy violations array is empty', async () => {
      const emptyViolationsDecision = {
        ...mockOriginalDecision,
        policy_violations: [],
      };
      setup(
        <OriginalDecisionContext originalDecision={emptyViolationsDecision} />
      );
      const policyViolationsValue = await screen.findByTestId(
        'original-decision-policy-violations-value'
      );
      expect(policyViolationsValue).toHaveTextContent(
        'appeals.label.noPolicyViolations'
      );
    });
  });

  describe('Accessibility', () => {
    test('has proper testID for screen readers', async () => {
      setup(
        <OriginalDecisionContext originalDecision={mockOriginalDecision} />
      );
      expect(
        await screen.findByTestId('original-decision-container')
      ).toBeOnTheScreen();
    });
  });
});
