import { MMKV } from 'react-native-mmkv';

import type { StrainFilters } from '@/api/strains/types';

const FILTER_PRESETS_KEY = 'strains_filter_presets';
const MAX_PRESETS = 5;

const storage = new MMKV({
  id: 'strains-filter-storage',
});

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
    const json = storage.getString(FILTER_PRESETS_KEY);
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
    storage.set(FILTER_PRESETS_KEY, JSON.stringify(updated));
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
    storage.set(FILTER_PRESETS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[FilterPresets] Failed to remove preset:', error);
  }
}

/**
 * Clear all filter presets
 */
export function clearFilterPresets(): void {
  try {
    storage.delete(FILTER_PRESETS_KEY);
  } catch (error) {
    console.error('[FilterPresets] Failed to clear presets:', error);
  }
}
