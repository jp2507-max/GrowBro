/**
 * Inventory Category Management
 *
 * Predefined categories with facet support for organizing and filtering
 * inventory items. Provides taxonomy and metadata for each category.
 *
 * Requirements:
 * - 8.1: Predefined categories with editable taxonomy and facets
 */

import type { CategoryFacet, InventoryCategory } from '@/types/inventory';

/**
 * Category metadata with description and supported facets
 */
export type CategoryMetadata = {
  name: InventoryCategory;
  description: string;
  supportedFacets: (keyof CategoryFacet)[];
  commonUnits: string[];
  icon?: string;
};

/**
 * Predefined inventory categories with metadata
 * Requirement 8.1
 */
export const PREDEFINED_CATEGORIES: readonly CategoryMetadata[] = [
  {
    name: 'Nutrients',
    description: 'Liquid and powder fertilizers, supplements, and additives',
    supportedFacets: ['brand', 'npkRatio', 'form'],
    commonUnits: ['ml', 'L', 'g', 'kg'],
    icon: 'nutrition',
  },
  {
    name: 'Seeds',
    description: 'Seeds, clones, and propagation materials',
    supportedFacets: ['brand'],
    commonUnits: ['ea', 'pack'],
    icon: 'seed',
  },
  {
    name: 'Growing Media',
    description: 'Soil, coco coir, perlite, rockwool, and other media',
    supportedFacets: ['brand', 'form'],
    commonUnits: ['L', 'kg', 'cu ft', 'bag'],
    icon: 'plant',
  },
  {
    name: 'Tools',
    description: 'pH meters, EC meters, scissors, and cultivation tools',
    supportedFacets: ['brand'],
    commonUnits: ['ea'],
    icon: 'tool',
  },
  {
    name: 'Containers',
    description: 'Pots, grow bags, jars, and storage containers',
    supportedFacets: ['form'],
    commonUnits: ['ea', 'pack'],
    icon: 'container',
  },
  {
    name: 'Amendments',
    description: 'pH adjusters, buffers, and soil amendments',
    supportedFacets: ['brand', 'form', 'hazardFlags'],
    commonUnits: ['ml', 'L', 'g', 'kg'],
    icon: 'chemistry',
  },
] as const;

/**
 * Get category metadata by name
 */
export function getCategoryMetadata(
  category: InventoryCategory
): CategoryMetadata | undefined {
  return PREDEFINED_CATEGORIES.find((cat) => cat.name === category);
}

/**
 * Get all category names
 */
export function getAllCategories(): readonly InventoryCategory[] {
  return PREDEFINED_CATEGORIES.map((cat) => cat.name);
}

/**
 * Get common units for a category
 */
export function getCommonUnits(category: InventoryCategory): string[] {
  const metadata = getCategoryMetadata(category);
  return metadata?.commonUnits ?? [];
}

/**
 * Check if category supports a specific facet
 */
export function categorySupportsFacet(
  category: InventoryCategory,
  facet: keyof CategoryFacet
): boolean {
  const metadata = getCategoryMetadata(category);
  return metadata?.supportedFacets.includes(facet) ?? false;
}

/**
 * Validate category name
 */
export function isValidCategory(
  category: string
): category is InventoryCategory {
  return PREDEFINED_CATEGORIES.some((cat) => cat.name === category);
}
