/**
 * Filter Presets Storage
 *
 * Uses the shared MMKV storage instance with namespaced keys
 * to avoid storage fragmentation.
 */
import type { StrainFilters } from '@/api/strains/types';

import { storage, STORAGE_KEYS } from '../storage';

const MAX_PRESETS = 5;

export interface FilterPreset {
  id: string;
  name: string;
  filters: StrainFilters;
  timestamp: number;
}

/**
 * Get all saved filter presets
 */
export function getFilterPresets(): FilterPreset[] {
  try {
    const json = storage.getString(STORAGE_KEYS.STRAINS_FILTER_PRESETS);
    if (!json) return [];
    return JSON.parse(json) as FilterPreset[];
  } catch (error) {
    console.error('[FilterPresets] Failed to load presets:', error);
    return [];
  }
}

/**
 * Save a new filter preset
 */
export function saveFilterPreset(name: string, filters: StrainFilters): void {
  try {
    const presets = getFilterPresets();
    const id = `preset_${Date.now()}`;

    const newPreset: FilterPreset = {
      id,
      name: name.trim(),
      filters,
      timestamp: Date.now(),
    };

    const updated = [newPreset, ...presets].slice(0, MAX_PRESETS);
    storage.set(STORAGE_KEYS.STRAINS_FILTER_PRESETS, JSON.stringify(updated));
  } catch (error) {
    console.error('[FilterPresets] Failed to save preset:', error);
  }
}

/**
 * Remove a filter preset by ID
 */
export function removeFilterPreset(id: string): void {
  try {
    const presets = getFilterPresets();
    const filtered = presets.filter((preset) => preset.id !== id);
    storage.set(STORAGE_KEYS.STRAINS_FILTER_PRESETS, JSON.stringify(filtered));
  } catch (error) {
    console.error('[FilterPresets] Failed to remove preset:', error);
  }
}

/**
 * Clear all filter presets
 */
export function clearFilterPresets(): void {
  try {
    storage.delete(STORAGE_KEYS.STRAINS_FILTER_PRESETS);
  } catch (error) {
    console.error('[FilterPresets] Failed to clear presets:', error);
  }
}
