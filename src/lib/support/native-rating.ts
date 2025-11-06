import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

/**
 * Request native in-app review
 * iOS: SKStoreReviewController
 * Android: Play In-App Review API
 */
export async function requestNativeReview(): Promise<boolean> {
  try {
    // Check if review is available
    const isAvailable = await StoreReview.isAvailableAsync();

    if (!isAvailable) {
      console.warn('Store review not available');
      return false;
    }

    // Request review
    await StoreReview.requestReview();
    return true;
  } catch (error) {
    console.error('Failed to request review:', error);
    return false;
  }
}

/**
 * Check if native review is available
 */
export async function isNativeReviewAvailable(): Promise<boolean> {
  try {
    return await StoreReview.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Open store page (fallback if native review not available)
 */
export async function openStorePage(): Promise<void> {
  try {
    const storeUrl = await StoreReview.storeUrl();

    if (storeUrl) {
      // Use Linking to open URL
      const { Linking } = await import('react-native');
      await Linking.openURL(storeUrl);
    } else {
      console.warn('Store URL not available');
    }
  } catch (error) {
    console.error('Failed to open store page:', error);
  }
}

/**
 * Get platform-specific review info
 */
export function getReviewPlatformInfo(): {
  platform: 'ios' | 'android' | 'other';
  maxPromptsPerPeriod: number;
  periodDays: number;
} {
  if (Platform.OS === 'ios') {
    return {
      platform: 'ios',
      maxPromptsPerPeriod: 3,
      periodDays: 365,
    };
  } else if (Platform.OS === 'android') {
    return {
      platform: 'android',
      maxPromptsPerPeriod: Infinity, // No hard limit on Android
      periodDays: 0,
    };
  } else {
    return {
      platform: 'other',
      maxPromptsPerPeriod: 0,
      periodDays: 0,
    };
  }
}
