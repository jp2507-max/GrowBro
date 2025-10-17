/**
 * Hook: useInventoryLowStockCount
 *
 * Reactive WatermelonDB query for counting inventory items below minimum stock.
 * Updates in real-time when stock levels or reorder points change.
 *
 * Requirements: 4.2
 */

import { Q } from '@nozbe/watermelondb';
import React from 'react';

import { database } from '@/lib/watermelon';

type LowStockCountResult = {
  count: number;
  isLoading: boolean;
};

export function useInventoryLowStockCount(): LowStockCountResult {
  const [count, setCount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isMounted = true;

    const query = database
      .get('inventory_items')
      .query(
        Q.where('deleted_at', null),
        Q.where('current_stock', Q.lte(Q.column('min_stock')))
      );

    const subscription = query.observeCount().subscribe({
      next: (nextCount: number) => {
        if (!isMounted) return;
        setCount(nextCount);
        setIsLoading(false);
      },
      error: (err: unknown) => {
        if (!isMounted) return;
        console.error('Failed to observe low stock count:', err);
        setCount(0);
        setIsLoading(false);
      },
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { count, isLoading };
}
