import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { ConflictFieldCard } from './enhanced-conflict-resolution-modal';

afterEach(cleanup);

describe('ConflictFieldCard', () => {
  describe('getFieldDisplayName', () => {
    test('returns translated field name when translation exists', async () => {
      setup(
        <ConflictFieldCard
          field="name"
          localValue="Test Name"
          remoteValue="Server Name"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeOnTheScreen();
      });
    });

    test('returns raw field name fallback when translation key does not exist', async () => {
      setup(
        <ConflictFieldCard
          field="unknown_field"
          localValue="Test Value"
          remoteValue="Server Value"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('unknown_field')).toBeOnTheScreen();
      });
    });

    test('returns field name as fallback when field is not in translations', async () => {
      // Using a field that's not in FIELD_TRANSLATION_KEYS
      setup(
        <ConflictFieldCard
          field="nonexistent_field"
          localValue="Test Value"
          remoteValue="Server Value"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('nonexistent_field')).toBeOnTheScreen();
      });
    });
  });
});
