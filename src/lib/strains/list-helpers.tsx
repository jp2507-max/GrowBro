/**
 * Helper functions for strain list rendering and configuration
 */

import type { ListRenderItemInfo } from '@shopify/flash-list';
import React from 'react';

import type { Strain } from '@/api';
import { StrainCard } from '@/components/strains/strain-card';

export const DEFAULT_ITEM_HEIGHT = 320;

/**
 * Determines the type of strain item based on content characteristics
 * This helps FlashList optimize recycling
 */
export function getStrainItemType(item: Strain): string {
  const hasDescription = item.description?.[0]?.length > 0;
  const hasTHC = !!item.thc_display;
  return `strain-${hasDescription ? 'desc' : 'nodesc'}-${hasTHC ? 'thc' : 'nothc'}`;
}

/**
 * Renders a strain card item
 */
export function renderStrainItem({ item }: ListRenderItemInfo<Strain>) {
  return <StrainCard strain={item} testID={`strain-card-${item.id}`} />;
}

/**
 * Extracts key from strain item
 */
export function extractStrainKey(item: Strain): string {
  return item.id;
}
