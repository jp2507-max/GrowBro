import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { ShareTemplateModal } from './share-template-modal';

afterEach(cleanup);

const mockPlaybook = {
  id: 'test-playbook',
  name: 'Test Playbook',
  setup: 'auto_indoor' as const,
  locale: 'en',
  phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
  steps: [],
  metadata: {
    author: 'Test Author',
    version: '1.0',
    difficulty: 'beginner',
    estimatedDuration: 8,
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockOnSuccess = jest.fn();
const mockOnCancel = jest.fn();

describe('ShareTemplateModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders correctly with default props', async () => {
      setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(await screen.findByText('Share Playbook')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Share your customized playbook with the community. All personal information will be automatically removed.'
        )
      ).toBeOnTheScreen();
    });

    test('renders all form fields', async () => {
      setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(await screen.findByText('Author Handle *')).toBeOnTheScreen();
      expect(screen.getByText('Description (Optional)')).toBeOnTheScreen();
      expect(screen.getByText('License')).toBeOnTheScreen();
      expect(screen.getByText('Cancel')).toBeOnTheScreen();
      expect(screen.getByText('Share')).toBeOnTheScreen();
    });
  });

  describe('Form Interactions', () => {
    test('allows typing in author handle field', async () => {
      const { user } = setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByTestId('share-template-handle-input');
      await user.type(input, 'test_handle');
      expect(input.props.value).toBe('test_handle');
    });

    test('allows typing in description field', async () => {
      const { user } = setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByTestId('share-template-description-input');
      await user.type(input, 'Test description');
      expect(input.props.value).toBe('Test description');
    });

    test('displays license information', async () => {
      setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(
        await screen.findByText(
          'CC-BY-SA - Creative Commons Attribution-ShareAlike'
        )
      ).toBeOnTheScreen();
    });
  });

  describe('Form Validation', () => {
    test('share button is disabled when form is invalid', async () => {
      setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const shareButton = screen.getByText('Share');
      expect(shareButton).toBeDisabled();
    });

    test('share button is enabled when form is valid', async () => {
      const { user } = setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const handleInput = screen.getByTestId('share-template-handle-input');
      await user.type(handleInput, 'valid_handle');

      await waitFor(() => {
        const shareButton = screen.getByText('Share');
        expect(shareButton).not.toBeDisabled();
      });
    });
  });

  describe('Button Interactions', () => {
    test('calls onCancel when cancel button is pressed', async () => {
      const { user } = setup(
        <ShareTemplateModal
          playbook={mockPlaybook}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.press(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});
