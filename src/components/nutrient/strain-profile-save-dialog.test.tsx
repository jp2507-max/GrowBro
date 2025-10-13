import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { StrainProfileSaveDialog } from './strain-profile-save-dialog';

afterEach(cleanup);

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

describe('StrainProfileSaveDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    test('shows localized validation error for empty strain name', async () => {
      const { user } = setup(
        <StrainProfileSaveDialog
          visible={true}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Find the save button and press it without entering a name
      const saveButton = screen.getByTestId('strain-profile-dialog-save');
      await user.press(saveButton);

      // Should show the validation error message (checking for the i18n key since test env may not translate)
      await waitFor(() => {
        expect(
          screen.getByTestId('strain-profile-dialog-name-error')
        ).toBeOnTheScreen();
      });

      const errorElement = screen.getByTestId(
        'strain-profile-dialog-name-error'
      );
      // The error should contain either the translated text or the i18n key
      expect(errorElement.children[0]).toMatch(
        /Strain name is required|validation\.strainNameRequired/
      );
    });
  });
});
