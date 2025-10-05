import * as React from 'react';

import type { StrainFilters } from '@/api/strains/types';
import { cleanup, screen, setup } from '@/lib/test-utils';

import { FilterChips } from './filter-chips';

afterEach(cleanup);

const onClearAllMock = jest.fn();
const onRemoveFilterMock = jest.fn();

const defaultFilters: StrainFilters = {
  race: undefined,
  difficulty: undefined,
  effects: [],
  flavors: [],
};

const activeFilters: StrainFilters = {
  race: 'sativa',
  difficulty: 'intermediate',
  effects: ['relaxed', 'happy'],
  flavors: ['citrus', 'sweet'],
};

describe('FilterChips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders nothing when no filters are active', () => {
      setup(
        <FilterChips
          filters={defaultFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      expect(screen.queryByTestId('filter-chips')).not.toBeOnTheScreen();
    });

    test('renders with active filters', async () => {
      setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      expect(await screen.findByTestId('filter-chips')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-chips-race')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-chips-difficulty')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-chips-effects')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-chips-flavors')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-chips-clear-all')).toBeOnTheScreen();
    });

    test('renders race filter chip', async () => {
      const filters: StrainFilters = { ...defaultFilters, race: 'indica' };
      setup(
        <FilterChips
          filters={filters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      expect(await screen.findByTestId('filter-chips-race')).toBeOnTheScreen();
    });

    test('renders difficulty filter chip', async () => {
      const filters: StrainFilters = {
        ...defaultFilters,
        difficulty: 'beginner',
      };
      setup(
        <FilterChips
          filters={filters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      expect(
        await screen.findByTestId('filter-chips-difficulty')
      ).toBeOnTheScreen();
    });

    test('renders effects filter chip when effects array is not empty', async () => {
      const filters: StrainFilters = {
        ...defaultFilters,
        effects: ['relaxed'],
      };
      setup(
        <FilterChips
          filters={filters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      expect(
        await screen.findByTestId('filter-chips-effects')
      ).toBeOnTheScreen();
    });

    test('renders flavors filter chip when flavors array is not empty', async () => {
      const filters: StrainFilters = { ...defaultFilters, flavors: ['citrus'] };
      setup(
        <FilterChips
          filters={filters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      expect(
        await screen.findByTestId('filter-chips-flavors')
      ).toBeOnTheScreen();
    });
  });

  describe('Interactions', () => {
    test('calls onRemoveFilter with correct key when race chip is pressed', async () => {
      const { user } = setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const raceChip = screen.getByTestId('filter-chips-race');
      await user.press(raceChip);
      expect(onRemoveFilterMock).toHaveBeenCalledWith('race');
    });

    test('calls onRemoveFilter with correct key when difficulty chip is pressed', async () => {
      const { user } = setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const difficultyChip = screen.getByTestId('filter-chips-difficulty');
      await user.press(difficultyChip);
      expect(onRemoveFilterMock).toHaveBeenCalledWith('difficulty');
    });

    test('calls onRemoveFilter with correct key when effects chip is pressed', async () => {
      const { user } = setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const effectsChip = screen.getByTestId('filter-chips-effects');
      await user.press(effectsChip);
      expect(onRemoveFilterMock).toHaveBeenCalledWith('effects');
    });

    test('calls onRemoveFilter with correct key when flavors chip is pressed', async () => {
      const { user } = setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const flavorsChip = screen.getByTestId('filter-chips-flavors');
      await user.press(flavorsChip);
      expect(onRemoveFilterMock).toHaveBeenCalledWith('flavors');
    });

    test('calls onClearAll when clear all button is pressed', async () => {
      const { user } = setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const clearAllButton = screen.getByTestId('filter-chips-clear-all');
      await user.press(clearAllButton);
      expect(onClearAllMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('filter chips have correct accessibility attributes', async () => {
      setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const raceChip = await screen.findByTestId('filter-chips-race');
      expect(raceChip).toHaveProp('accessibilityRole', 'button');
      expect(raceChip).toHaveProp('accessibilityLabel');
      expect(raceChip).toHaveProp('accessibilityHint');
    });

    test('clear all button has correct accessibility attributes', async () => {
      setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
        />
      );
      const clearAllButton = await screen.findByTestId(
        'filter-chips-clear-all'
      );
      expect(clearAllButton).toHaveProp('accessibilityRole', 'button');
      expect(clearAllButton).toHaveProp('accessibilityLabel');
      expect(clearAllButton).toHaveProp('accessibilityHint');
    });
  });

  describe('Custom testID', () => {
    test('uses custom testID prefix', async () => {
      setup(
        <FilterChips
          filters={activeFilters}
          onClearAll={onClearAllMock}
          onRemoveFilter={onRemoveFilterMock}
          testID="custom-filters"
        />
      );
      expect(await screen.findByTestId('custom-filters')).toBeOnTheScreen();
      expect(screen.getByTestId('custom-filters-race')).toBeOnTheScreen();
      expect(screen.getByTestId('custom-filters-clear-all')).toBeOnTheScreen();
    });
  });
});
