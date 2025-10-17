/**
 * Inventory Valuation Summary Component Tests
 */

import React from 'react';

import { useInventoryValuation } from '@/lib/inventory/use-inventory-valuation';
import { cleanup, render, screen, waitFor } from '@/lib/test-utils';

import { InventoryValuationSummary } from '../inventory-valuation-summary';

// Mock the hook
jest.mock('@/lib/inventory/use-inventory-valuation', () => ({
  useInventoryValuation: jest.fn(),
}));

const mockUseInventoryValuation = useInventoryValuation as jest.MockedFunction<
  typeof useInventoryValuation
>;

afterEach(cleanup);

describe('InventoryValuationSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator', () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: null,
        isLoading: true,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary />);

      expect(
        screen.getByTestId('inventory-valuation-summary-loading')
      ).toBeOnTheScreen();
    });
  });

  describe('Error State', () => {
    it('should display error message', () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: null,
        isLoading: false,
        error: new Error('Failed to load valuation'),
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary />);

      expect(
        screen.getByTestId('inventory-valuation-summary-error')
      ).toBeOnTheScreen();
      expect(screen.getByText('Failed to load valuation')).toBeOnTheScreen();
    });
  });

  describe('Empty State', () => {
    it('should show default empty message when no items', () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 0,
          itemCount: 0,
          batchCount: 0,
          categories: [],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary />);

      expect(
        screen.getByTestId('inventory-valuation-summary-empty')
      ).toBeOnTheScreen();
      expect(screen.getByText('No inventory items')).toBeOnTheScreen();
    });

    it('should show custom empty message', () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: null,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary emptyMessage="Inventory is empty!" />);

      expect(screen.getByText('Inventory is empty!')).toBeOnTheScreen();
    });
  });

  describe('Data Display', () => {
    it('should display total valuation', async () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 25000, // $250.00
          itemCount: 5,
          batchCount: 10,
          categories: [],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary />);

      await waitFor(() => {
        expect(screen.getByText('Total Inventory Value')).toBeOnTheScreen();
      });

      expect(screen.getByText('$250.00')).toBeOnTheScreen();
      expect(screen.getByText('5 items • 10 batches')).toBeOnTheScreen();
    });

    it('should display with custom currency', async () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 15000,
          itemCount: 3,
          batchCount: 5,
          categories: [],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary currency="€" />);

      await waitFor(() => {
        expect(
          screen.getByTestId('inventory-valuation-summary-total-value')
        ).toBeOnTheScreen();
      });

      expect(screen.getByText('€150.00')).toBeOnTheScreen();
    });

    it('should display category breakdown when showCategories is true', async () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 30000,
          itemCount: 6,
          batchCount: 12,
          categories: [
            {
              category: 'Nutrients',
              totalValueMinor: 20000,
              totalQuantity: 1000,
              itemCount: 3,
              batchCount: 6,
            },
            {
              category: 'Seeds',
              totalValueMinor: 10000,
              totalQuantity: 50,
              itemCount: 3,
              batchCount: 6,
            },
          ],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary showCategories />);

      await waitFor(() => {
        expect(screen.getByText('By Category')).toBeOnTheScreen();
      });

      // Nutrients category
      const nutrientsCard = screen.getByTestId(
        'inventory-valuation-summary-category-Nutrients'
      );
      expect(nutrientsCard).toBeOnTheScreen();
      expect(
        screen.getByTestId(
          'inventory-valuation-summary-category-Nutrients-value'
        )
      ).toHaveTextContent('$200.00');

      // Seeds category
      const seedsCard = screen.getByTestId(
        'inventory-valuation-summary-category-Seeds'
      );
      expect(seedsCard).toBeOnTheScreen();
      expect(
        screen.getByTestId('inventory-valuation-summary-category-Seeds-value')
      ).toHaveTextContent('$100.00');
    });

    it('should not display category breakdown when showCategories is false', () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 10000,
          itemCount: 2,
          batchCount: 4,
          categories: [
            {
              category: 'Nutrients',
              totalValueMinor: 10000,
              totalQuantity: 500,
              itemCount: 2,
              batchCount: 4,
            },
          ],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary showCategories={false} />);

      expect(screen.queryByText('By Category')).not.toBeOnTheScreen();
      expect(screen.queryByText('Nutrients')).not.toBeOnTheScreen();
    });

    it('should handle zero-value inventory', async () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 0,
          itemCount: 3,
          batchCount: 3,
          categories: [
            {
              category: 'Free Samples',
              totalValueMinor: 0,
              totalQuantity: 100,
              itemCount: 3,
              batchCount: 3,
            },
          ],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(<InventoryValuationSummary showCategories />);

      await waitFor(() => {
        expect(
          screen.getByTestId('inventory-valuation-summary-total-value')
        ).toBeOnTheScreen();
      });

      expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
      expect(screen.getByText('Free Samples')).toBeOnTheScreen();
    });
  });

  describe('Accessibility', () => {
    it('should have proper test IDs', () => {
      mockUseInventoryValuation.mockReturnValue({
        valuation: {
          totalValueMinor: 10000,
          itemCount: 2,
          batchCount: 4,
          categories: [
            {
              category: 'Nutrients',
              totalValueMinor: 10000,
              totalQuantity: 500,
              itemCount: 2,
              batchCount: 4,
            },
          ],
          calculatedAt: new Date(),
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      render(
        <InventoryValuationSummary showCategories testID="custom-test-id" />
      );

      expect(screen.getByTestId('custom-test-id')).toBeOnTheScreen();
      expect(
        screen.getByTestId('custom-test-id-total-value')
      ).toBeOnTheScreen();
      expect(screen.getByTestId('custom-test-id-categories')).toBeOnTheScreen();
      expect(
        screen.getByTestId('custom-test-id-category-Nutrients')
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId('custom-test-id-category-Nutrients-value')
      ).toBeOnTheScreen();
    });
  });
});
