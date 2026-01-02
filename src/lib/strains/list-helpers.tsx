/**
 * Helper functions for strain list rendering and configuration
 */

import type { ListRenderItemInfo } from '@shopify/flash-list';
import React from 'react';

import type { Strain } from '@/api';
import { StrainCard } from '@/components/strains/strain-card';

// Pre-calculated item heights for overrideItemLayout
// Image: 208px (h-52) + Content padding: ~80px base + description ~40px + mb-5 (20px)
export const ITEM_HEIGHTS = {
  'strain-desc-thc': 340, // Full card with description and THC badge
  'strain-desc-nothc': 330, // Description, no THC
  'strain-nodesc-thc': 300, // No description, has THC
  'strain-nodesc-nothc': 290, // Minimal card
} as const;

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
 * Pre-calculate exact item heights based on content type
 */
export function overrideStrainItemLayout(
  layout: { size?: number; span?: number },
  item: Strain
): void {
  const itemType = getStrainItemType(item);
  layout.size =
    ITEM_HEIGHTS[itemType as keyof typeof ITEM_HEIGHTS] ?? DEFAULT_ITEM_HEIGHT;
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
