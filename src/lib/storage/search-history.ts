/**
 * Search History Storage
 *
 * Uses the shared MMKV storage instance with namespaced keys
 * to avoid storage fragmentation.
 */
import { storage, STORAGE_KEYS } from '../storage';

const MAX_HISTORY_ITEMS = 10;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

/**
 * Get search history for strains
 */
export function getSearchHistory(): SearchHistoryItem[] {
  try {
    const json = storage.getString(STORAGE_KEYS.STRAINS_SEARCH_HISTORY);
    if (!json) return [];
    return JSON.parse(json) as SearchHistoryItem[];
  } catch (error) {
    console.error('[SearchHistory] Failed to load history:', error);
    return [];
  }
}

/**
 * Add a search query to history
 * Deduplicates and maintains max items limit
 */
export function addToSearchHistory(query: string): void {
  if (!query.trim()) return;

  try {
    const history = getSearchHistory();

    // Remove existing entry if present
    const filtered = history.filter(
      (item) => item.query.toLowerCase() !== query.toLowerCase()
    );

    // Add new entry at the beginning
    const updated = [
      { query: query.trim(), timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_HISTORY_ITEMS);

    storage.set(STORAGE_KEYS.STRAINS_SEARCH_HISTORY, JSON.stringify(updated));
  } catch (error) {
    console.error('[SearchHistory] Failed to save history:', error);
  }
}

/**
 * Remove a specific item from search history
 */
export function removeFromSearchHistory(query: string): void {
  try {
    const history = getSearchHistory();
    const filtered = history.filter((item) => item.query !== query);
    storage.set(STORAGE_KEYS.STRAINS_SEARCH_HISTORY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[SearchHistory] Failed to remove item:', error);
  }
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
  try {
    storage.delete(STORAGE_KEYS.STRAINS_SEARCH_HISTORY);
  } catch (error) {
    console.error('[SearchHistory] Failed to clear history:', error);
  }
}
