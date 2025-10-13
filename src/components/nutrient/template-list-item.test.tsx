/**
 * Template List Item Tests
 *
 * Unit tests for TemplateListItem component
 */

import React from 'react';

import { GrowingMedium, PlantPhase } from '@/lib/nutrient-engine/types';
import { cleanup, render, screen, userEvent } from '@/lib/test-utils';

import { TemplateListItem } from './template-list-item';

afterEach(cleanup);

describe('TemplateListItem', () => {
  const mockOnPress = jest.fn();

  const mockTemplate = {
    id: '1',
    name: 'Test Template',
    medium: GrowingMedium.HYDRO,
    phases: [
      {
        phase: PlantPhase.VEGETATIVE,
        durationDays: 14,
        nutrients: [],
        phRange: [5.5, 6.5] as [number, number],
        ecRange25c: [1.2, 1.8] as [number, number],
      },
    ],
    isCustom: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders template name and details', async () => {
      render(
        <TemplateListItem template={mockTemplate} onPress={mockOnPress} />
      );

      expect(await screen.findByText('Test Template')).toBeOnTheScreen();
      expect(await screen.findByText(/1 phase/i)).toBeOnTheScreen();
    });

    test('displays custom badge for custom templates', async () => {
      const customTemplate = { ...mockTemplate, isCustom: true };
      render(
        <TemplateListItem template={customTemplate} onPress={mockOnPress} />
      );

      expect(await screen.findByText(/custom/i)).toBeOnTheScreen();
    });

    test('does not display custom badge for default templates', async () => {
      render(
        <TemplateListItem template={mockTemplate} onPress={mockOnPress} />
      );

      const customBadge = screen.queryByText(/custom/i);
      expect(customBadge).not.toBeOnTheScreen();
    });

    test('shows plural phases text correctly', async () => {
      const multiPhaseTemplate = {
        ...mockTemplate,
        phases: [
          ...mockTemplate.phases,
          {
            phase: PlantPhase.FLOWERING,
            durationDays: 21,
            nutrients: [],
            phRange: [5.8, 6.2] as [number, number],
            ecRange25c: [1.6, 2.2] as [number, number],
          },
        ],
      };

      render(
        <TemplateListItem template={multiPhaseTemplate} onPress={mockOnPress} />
      );

      expect(await screen.findByText(/2 phases/i)).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onPress when pressed', async () => {
      const user = userEvent.setup();
      render(
        <TemplateListItem template={mockTemplate} onPress={mockOnPress} />
      );

      const item = await screen.findByTestId(
        `template-list-item-${mockTemplate.id}`
      );
      await user.press(item);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
      expect(mockOnPress).toHaveBeenCalledWith(mockTemplate);
    });
  });
});
