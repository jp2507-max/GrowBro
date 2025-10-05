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

    test('returns displayNameMap fallback when translation key does not exist', async () => {
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

    test('returns displayNameMap fallback when field exists in map but not in translations', async () => {
      // Assuming 'custom_field' exists in displayNameMap but not in FIELD_TRANSLATION_KEYS
      setup(
        <ConflictFieldCard
          field="notes"
          localValue="Test Notes"
          remoteValue="Server Notes"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Notes')).toBeOnTheScreen();
      });
    });
  });
});
