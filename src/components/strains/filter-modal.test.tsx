/**
 * Unit tests for FilterModal component
 */

import { renderHook } from '@testing-library/react-native';
import React from 'react';

import type { StrainFilters } from '@/api/strains/types';
import { cleanup, render, screen, setup, waitFor } from '@/lib/test-utils';

import { FilterModal, useStrainFilters } from './filter-modal';

// Mock bottom sheet
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: ({ children }: any) => <>{children}</>,
}));

afterEach(cleanup);

describe('FilterModal', () => {
  const mockOnApply = jest.fn();
  const mockOnClear = jest.fn();
  const defaultFilters: StrainFilters = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders filter sections', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      // Check for section labels (translations will be mocked)
      expect(screen.getByTestId('filter-apply-button')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-clear-button')).toBeOnTheScreen();
    });

    test('renders race filter options', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByTestId('filter-race-indica')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-race-sativa')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-race-hybrid')).toBeOnTheScreen();
    });

    test('renders difficulty filter options', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      expect(
        screen.getByTestId('filter-difficulty-beginner')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('filter-difficulty-intermediate')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('filter-difficulty-advanced')
      ).toBeOnTheScreen();
    });

    test('renders effect checkboxes', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByTestId('filter-effect-happy')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-effect-relaxed')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-effect-euphoric')).toBeOnTheScreen();
    });

    test('renders flavor checkboxes', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      expect(screen.getByTestId('filter-flavor-earthy')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-flavor-sweet')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-flavor-citrus')).toBeOnTheScreen();
    });
  });

  describe('Race filter interactions', () => {
    test('selects race filter', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const indicaButton = screen.getByTestId('filter-race-indica');
      await user.press(indicaButton);

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          race: 'indica',
        })
      );
    });

    test('deselects race filter when pressed again', async () => {
      const { user } = setup(
        <FilterModal
          filters={{ race: 'indica' }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const indicaButton = screen.getByTestId('filter-race-indica');
      await user.press(indicaButton);

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          race: undefined,
        })
      );
    });

    test('switches between race options', async () => {
      const { user } = setup(
        <FilterModal
          filters={{ race: 'indica' }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const sativaButton = screen.getByTestId('filter-race-sativa');
      await user.press(sativaButton);

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          race: 'sativa',
        })
      );
    });
  });

  describe('Difficulty filter interactions', () => {
    test('selects difficulty filter', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const beginnerButton = screen.getByTestId('filter-difficulty-beginner');
      await user.press(beginnerButton);

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: 'beginner',
        })
      );
    });
  });

  describe('Effect filter interactions', () => {
    test('selects single effect', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const happyCheckbox = screen.getByTestId('filter-effect-happy');
      await user.press(happyCheckbox);

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          effects: ['happy'],
        })
      );
    });

    test('selects multiple effects', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await user.press(screen.getByTestId('filter-effect-happy'));
      await user.press(screen.getByTestId('filter-effect-relaxed'));

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          effects: expect.arrayContaining(['happy', 'relaxed']),
        })
      );
    });

    test('deselects effect', async () => {
      const { user } = setup(
        <FilterModal
          filters={{ effects: ['happy', 'relaxed'] }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await user.press(screen.getByTestId('filter-effect-happy'));

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          effects: ['relaxed'],
        })
      );
    });
  });

  describe('Flavor filter interactions', () => {
    test('selects single flavor', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await user.press(screen.getByTestId('filter-flavor-earthy'));

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          flavors: ['earthy'],
        })
      );
    });

    test('selects multiple flavors', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await user.press(screen.getByTestId('filter-flavor-earthy'));
      await user.press(screen.getByTestId('filter-flavor-sweet'));

      const applyButton = screen.getByTestId('filter-apply-button');
      await user.press(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          flavors: expect.arrayContaining(['earthy', 'sweet']),
        })
      );
    });
  });

  describe('Clear functionality', () => {
    test('clears all filters', async () => {
      const { user } = setup(
        <FilterModal
          filters={{
            race: 'indica',
            difficulty: 'beginner',
            effects: ['happy'],
            flavors: ['earthy'],
          }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.getByTestId('filter-clear-button');
      await user.press(clearButton);

      expect(mockOnClear).toHaveBeenCalled();
    });

    test('disables clear button when no filters active', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.getByTestId('filter-clear-button');
      expect(clearButton.props.disabled).toBe(true);
    });

    test('enables clear button when filters are active', () => {
      render(
        <FilterModal
          filters={{ race: 'indica' }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const clearButton = screen.getByTestId('filter-clear-button');
      expect(clearButton.props.disabled).toBe(false);
    });
  });

  describe('Apply functionality', () => {
    test('applies filters on button press', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await user.press(screen.getByTestId('filter-race-indica'));
      await user.press(screen.getByTestId('filter-apply-button'));

      expect(mockOnApply).toHaveBeenCalledTimes(1);
    });

    test('applies combined filters', async () => {
      const { user } = setup(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await user.press(screen.getByTestId('filter-race-indica'));
      await user.press(screen.getByTestId('filter-difficulty-beginner'));
      await user.press(screen.getByTestId('filter-effect-happy'));
      await user.press(screen.getByTestId('filter-flavor-earthy'));

      await user.press(screen.getByTestId('filter-apply-button'));

      expect(mockOnApply).toHaveBeenCalledWith({
        race: 'indica',
        difficulty: 'beginner',
        effects: ['happy'],
        flavors: ['earthy'],
      });
    });
  });

  describe('Filter persistence', () => {
    test('initializes with provided filters', () => {
      const filters: StrainFilters = {
        race: 'indica',
        effects: ['happy', 'relaxed'],
      };

      render(
        <FilterModal
          filters={filters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      // Filters should be reflected in the UI
      expect(screen.getByTestId('filter-race-indica')).toBeOnTheScreen();
    });

    test('updates when filters prop changes', async () => {
      const { rerender } = render(
        <FilterModal
          filters={{ race: 'indica' }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      rerender(
        <FilterModal
          filters={{ race: 'sativa' }}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('filter-race-sativa')).toBeOnTheScreen();
      });
    });
  });

  describe('Accessibility', () => {
    test('checkboxes have accessibility labels', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const happyCheckbox = screen.getByTestId('filter-effect-happy');
      expect(happyCheckbox.props.accessibilityLabel).toBeDefined();
    });

    test('checkboxes have accessibility hints', () => {
      render(
        <FilterModal
          filters={defaultFilters}
          onApply={mockOnApply}
          onClear={mockOnClear}
        />
      );

      const happyCheckbox = screen.getByTestId('filter-effect-happy');
      expect(happyCheckbox.props.accessibilityHint).toBeDefined();
    });
  });
});

describe('useStrainFilters', () => {
  test('provides filter modal controls', () => {
    const { result } = renderHook(() => useStrainFilters());

    expect(result.current.ref).toBeDefined();
    expect(typeof result.current.openFilters).toBe('function');
    expect(typeof result.current.closeFilters).toBe('function');
  });
});
