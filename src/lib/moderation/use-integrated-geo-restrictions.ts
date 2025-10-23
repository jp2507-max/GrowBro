/**
 * Integrated Geo-Restrictions Hook
 *
 * Integrates geo-restrictions with existing location-based features
 * Provides seamless content filtering based on user location
 *
 * Requirements: 9.4
 */

import { useEffect, useState } from 'react';

import { geoLocationService } from './geo-location-service';

export interface UseIntegratedGeoRestrictionsResult {
  userCountry: string | null;
  userRegion: string | null;
  isLoading: boolean;
  checkContentAvailability: (contentId: string) => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

/**
 * Hook to integrate geo-restrictions with location features
 *
 * Automatically detects user location using IP geolocation
 * Provides methods to check content availability
 */
export function useIntegratedGeoRestrictions(): UseIntegratedGeoRestrictionsResult {
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Detect user location on mount
  useEffect(() => {
    detectLocation();
  }, []);

  /**
   * Detect user location using IP geolocation
   */
  const detectLocation = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Get user IP address
      const ipAddress = await getUserIpAddress();

      // Detect location using IP
      const location = await geoLocationService.detectUserLocationIP({
        ipAddress,
      });

      setUserCountry(location.countryCode || 'UNKNOWN');
      setUserRegion(location.regionCode || null);
    } catch (error) {
      console.error('Error detecting location:', error);
      // Default to no restrictions on error
      setUserCountry('UNKNOWN');
      setUserRegion(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if content is available in user's location
   */
  const checkContentAvailability = async (
    contentId: string
  ): Promise<boolean> => {
    if (!userCountry) {
      // Location not detected yet - allow access
      return true;
    }

    try {
      const availability = await geoLocationService.checkContentAvailability(
        contentId,
        { country: userCountry, region: userRegion || undefined }
      );

      return availability.available;
    } catch (error) {
      console.error('Error checking content availability:', error);
      // Default to available on error
      return true;
    }
  };

  /**
   * Refresh user location
   * Useful when user changes location or VPN
   */
  const refreshLocation = async (): Promise<void> => {
    await detectLocation();
  };

  return {
    userCountry,
    userRegion,
    isLoading,
    checkContentAvailability,
    refreshLocation,
  };
}

/**
 * Get user IP address for geolocation
 */
async function getUserIpAddress(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP address:', error);
    return '';
  }
}
