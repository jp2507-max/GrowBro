/**
 * Inventory Layout
 *
 * Navigation structure for inventory management screens.
 * Supports deep linking to item details and batch creation.
 *
 * Requirements: 1.1, 4.2
 */

import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function InventoryLayout(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t('inventory.title'),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t('inventory.item_detail'),
        }}
      />
      <Stack.Screen
        name="[id]/batches/new"
        options={{
          title: t('inventory.add_batch'),
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: t('inventory.add_item'),
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="low-stock"
        options={{
          title: t('inventory.low_stock'),
        }}
      />
    </Stack>
  );
}
