import React from 'react';

import { translate } from '@/lib/i18n';
import { cleanup, render, screen, setup } from '@/lib/test-utils';
import type { HarvestPhotoObject, HarvestStage } from '@/types/harvest';
import { HarvestStages } from '@/types/harvest';

import {
  type HarvestHistoryFilter,
  HarvestHistoryList,
  type HarvestHistoryListProps,
} from './harvest-history-list';

const BASE_HARVEST = {
  id: 'default-harvest-id',
  stage: HarvestStages.HARVEST,
  plant_id: 'plant-1',
  user_id: 'user-1',
  wet_weight_g: 1200,
  dry_weight_g: 600,
  trimmings_weight_g: null,
  notes: 'Initial notes',
  stage_started_at: new Date('2024-01-01T00:00:00.000Z'),
  stage_completed_at: null,
  photos: [] as HarvestPhotoObject[],
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  updated_at: new Date('2024-01-01T00:00:00.000Z'),
  deleted_at: null,
  conflict_seen: false,
  server_revision: 1,
  server_updated_at_ms: Date.now(),
};

const makeHarvest = (
  overrides: Partial<HarvestHistoryListProps['harvests'][number]> & {
    readonly id: string;
    readonly stage: HarvestStage;
  }
): HarvestHistoryListProps['harvests'][number] => ({
  ...BASE_HARVEST,
  ...overrides,
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('HarvestHistoryList', () => {
  const harvests = [
    makeHarvest({
      id: 'harvest-1',
      stage: HarvestStages.HARVEST,
      updated_at: new Date(Date.now() - 5 * 60 * 1000),
      notes: 'Harvest started',
    }),
    makeHarvest({
      id: 'harvest-2',
      stage: HarvestStages.CURING,
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      notes: 'Curing in progress',
      plant_id: 'plant-2',
      dry_weight_g: 450,
    }),
    makeHarvest({
      id: 'harvest-3',
      stage: HarvestStages.INVENTORY,
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      notes: 'Inventory created',
      conflict_seen: true,
    }),
  ];

  it('renders harvest items with updated timestamps', () => {
    render(<HarvestHistoryList harvests={harvests} />);

    expect(
      screen.getByTestId('harvest-history-list-item-harvest-1')
    ).toBeOnTheScreen();
    expect(screen.getByText(/Just now|minutes ago/i)).toBeTruthy();
  });

  it('shows filtered empty state when filters remove all items', () => {
    render(
      <HarvestHistoryList
        harvests={harvests}
        filters={{ plantId: 'plant-x' }}
      />
    );

    expect(screen.getByTestId('harvest-history-list-empty')).toBeOnTheScreen();
    expect(
      screen.getByText(translate('harvest.history.empty.filtered.title'))
    ).toBeTruthy();
  });

  it('invokes onSelect callback when item pressed', async () => {
    const onSelect = jest.fn();
    const { user } = setup(
      <HarvestHistoryList harvests={harvests} onSelect={onSelect} />
    );

    await user.press(screen.getByTestId('harvest-history-list-item-harvest-2'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'harvest-2', stage: HarvestStages.CURING })
    );
  });

  it('supports status filtering', () => {
    const filters: HarvestHistoryFilter = { status: 'completed' };

    render(<HarvestHistoryList harvests={harvests} filters={filters} />);

    expect(
      screen.queryByTestId('harvest-history-list-item-harvest-1')
    ).toBeNull();
    expect(
      screen.queryByTestId('harvest-history-list-item-harvest-2')
    ).toBeNull();
    expect(
      screen.getByTestId('harvest-history-list-item-harvest-3')
    ).toBeOnTheScreen();
  });

  it('renders offline empty state when no data and offline', () => {
    render(<HarvestHistoryList harvests={[]} isOffline />);

    expect(
      screen.getByText(translate('harvest.history.empty.offline.title'))
    ).toBeTruthy();
  });

  it('shows skeleton when loading and no data yet', () => {
    render(<HarvestHistoryList harvests={[]} isLoading />);

    expect(screen.getByTestId('list-skeleton')).toBeOnTheScreen();
  });
});
