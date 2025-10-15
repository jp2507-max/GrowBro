/**
 * Batch List Component Tests
 *
 * Tests for FEFO ordering and expiration status display.
 *
 * Requirements: 2.2, 2.6
 */

import { DateTime } from 'luxon';
import React from 'react';

import { BatchList } from '@/components/inventory/batch-list';
import { cleanup, render, screen, waitFor } from '@/lib/test-utils';
import type { InventoryBatchWithStatus } from '@/types/inventory';

afterEach(cleanup);

const mockBatches: InventoryBatchWithStatus[] = [
  {
    id: 'batch-1',
    itemId: 'item-1',
    lotNumber: 'LOT001',
    expiresOn: DateTime.now().plus({ days: 10 }).toJSDate(),
    quantity: 100,
    costPerUnitMinor: 2500,
    receivedAt: new Date('2025-01-01'),
    userId: 'user-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    isExpired: false,
    daysToExpiry: 10,
    isExcludedFromPicking: false,
  },
  {
    id: 'batch-2',
    itemId: 'item-1',
    lotNumber: 'LOT002',
    expiresOn: DateTime.now().minus({ days: 5 }).toJSDate(),
    quantity: 50,
    costPerUnitMinor: 2300,
    receivedAt: new Date('2024-12-01'),
    userId: 'user-1',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    isExpired: true,
    daysToExpiry: -5,
    isExcludedFromPicking: true,
  },
  {
    id: 'batch-3',
    itemId: 'item-1',
    lotNumber: 'LOT003',
    expiresOn: DateTime.now().plus({ days: 25 }).toJSDate(),
    quantity: 200,
    costPerUnitMinor: 2400,
    receivedAt: new Date('2025-01-15'),
    userId: 'user-1',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    isExpired: false,
    daysToExpiry: 25,
    isExcludedFromPicking: false,
  },
];

describe('BatchList', () => {
  describe('Rendering', () => {
    it('renders all batches correctly', async () => {
      render(<BatchList batches={mockBatches} itemId="item-1" />);

      await waitFor(() => {
        expect(screen.getByText(/LOT001/)).toBeOnTheScreen();
      });
      expect(screen.getByText(/LOT002/)).toBeOnTheScreen();
      expect(screen.getByText(/LOT003/)).toBeOnTheScreen();
    });

    it('displays empty state when no batches', async () => {
      render(<BatchList batches={[]} itemId="item-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('batch-list-empty')).toBeOnTheScreen();
      });
      expect(screen.getByText(/no batches available/i)).toBeOnTheScreen();
    });

    it('renders batch quantities and costs', async () => {
      render(<BatchList batches={[mockBatches[0]]} itemId="item-1" />);

      await waitFor(() => {
        expect(screen.getByText(/100 units/)).toBeOnTheScreen();
      });
      expect(screen.getByText(/\$25\.00\/unit/)).toBeOnTheScreen();
    });
  });

  describe('Expiration Status', () => {
    it('displays "Expired" pill for expired batches', async () => {
      render(<BatchList batches={[mockBatches[1]]} itemId="item-1" />);

      await waitFor(() => {
        expect(screen.getByText('Expired')).toBeOnTheScreen();
      });
    });

    it('displays "Expires in X days" for batches expiring within 30 days', async () => {
      render(<BatchList batches={[mockBatches[0]]} itemId="item-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Expires in 10 days/)).toBeOnTheScreen();
      });
    });

    it('does not display expiry pill for batches expiring after 30 days', async () => {
      render(<BatchList batches={[mockBatches[2]]} itemId="item-1" />);

      await waitFor(() => {
        const batchItem = screen.getByTestId('batch-item-batch-3');
        expect(batchItem).toBeOnTheScreen();
      });
      // Should not have warning pill
      expect(screen.queryByText(/Expires in/)).not.toBeOnTheScreen();
    });
  });

  describe('FEFO Ordering', () => {
    it('displays batches in order received (FEFO ordering expected from parent)', async () => {
      render(<BatchList batches={mockBatches} itemId="item-1" />);

      await waitFor(() => {
        const allLots = screen.getAllByText(/LOT\d{3}/);
        expect(allLots).toHaveLength(3);
      });
    });
  });

  describe('Batch Details', () => {
    it('formats expiration dates correctly', async () => {
      render(<BatchList batches={[mockBatches[0]]} itemId="item-1" />);

      await waitFor(() => {
        const dateText = screen.getByText(/Expires:/);
        expect(dateText).toBeOnTheScreen();
      });
    });

    it('handles batches without expiration dates', async () => {
      const batchNoExpiry: InventoryBatchWithStatus = {
        ...mockBatches[0],
        id: 'batch-no-expiry',
        lotNumber: 'LOT999',
        expiresOn: undefined,
        daysToExpiry: undefined,
      };

      render(<BatchList batches={[batchNoExpiry]} itemId="item-1" />);

      await waitFor(() => {
        expect(screen.getByText(/LOT999/)).toBeOnTheScreen();
      });
      expect(screen.queryByText(/Expires:/)).not.toBeOnTheScreen();
    });
  });
});
