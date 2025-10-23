/**
 * Geo-Location React Native Hooks
 * Client-side integration for privacy-first geographic content filtering
 * Part of Task 10: Geo-Location Service (Requirements 9.1-9.7)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type {
  GeoRestrictionAppeal,
  LocationData,
  LocationResult,
  SubmitAppealInput,
} from '@/types/geo-location';

import { GPS_CONFIG } from './geo-config';
import { geoLocationService } from './geo-location-service';

/**
 * Hook to get current user location (IP-based by default)
 * Requirement 9.1: Default to IP-based geolocation
 */
export function useGeoLocation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { data: ipLocation, refetch: refetchIpLocation } = useQuery({
    queryKey: ['geo-location', 'ip'],
    queryFn: async () => {
      return geoLocationService.detectUserLocationIP({});
    },
    staleTime: geoLocationService.getDecisionTtlMs(),
    gcTime: geoLocationService.getDecisionTtlMs(),
  });

  /**
   * Request GPS location with explicit consent
   * Requirement 9.1: GPS only with explicit consent
   */
  const requestGpsLocation = useCallback(
    async (purpose: string): Promise<LocationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          throw new Error('GPS permission denied');
        }

        // Get GPS location
        const gpsData = await Location.getCurrentPositionAsync({
          accuracy: GPS_CONFIG.ENABLE_HIGH_ACCURACY
            ? Location.Accuracy.High
            : Location.Accuracy.Balanced,
          timeInterval: GPS_CONFIG.TIMEOUT_MS,
        });

        // Reverse geocode to get country/region
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: gpsData.coords.latitude,
          longitude: gpsData.coords.longitude,
        });

        const locationData: LocationData = {
          country: geocode.isoCountryCode || 'Unknown',
          region: geocode.region || undefined,
          city: geocode.city || undefined,
          coords: {
            latitude: gpsData.coords.latitude,
            longitude: gpsData.coords.longitude,
            accuracy: gpsData.coords.accuracy || undefined,
          },
          timezone: geocode.timezone || undefined,
        };

        const result: LocationResult = {
          location: locationData,
          method: 'gps',
          confidenceScore: 1.0,
          timestamp: new Date(gpsData.timestamp),
        };

        // Log consent and purpose (server-side validation)
        await geoLocationService.requestGPSLocation(
          (await supabase.auth.getUser()).data.user?.id || '',
          purpose,
          true
        );

        setIsLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  return {
    location: ipLocation,
    isLoading,
    error,
    refetch: refetchIpLocation,
    requestGpsLocation,
  };
}

/**
 * Hook to check content availability in user's location
 * Requirement 9.3: Provide "why can't I see this?" explainer
 */
export function useContentAvailability(contentId: string) {
  const { location } = useGeoLocation();

  return useQuery({
    queryKey: ['content-availability', contentId, location?.location.country],
    queryFn: async () => {
      if (!location) {
        return { available: true };
      }

      return geoLocationService.checkContentAvailability(
        contentId,
        location.location
      );
    },
    enabled: !!location,
    staleTime: geoLocationService.getDecisionTtlMs(),
  });
}

/**
 * Hook to get geo-restriction explainer for unavailable content
 * Requirement 9.3: Maintain content availability in permitted regions with explainer
 */
export function useGeoRestrictionExplainer(contentId: string) {
  const { data: availability } = useContentAvailability(contentId);

  return {
    isRestricted: !availability?.available,
    explainerText: availability?.explainerText,
    lawfulBasis: availability?.lawfulBasis,
    affectedRegions: availability?.affectedRegions,
  };
}

/**
 * Hook to submit geo-restriction appeal
 * Requirement 9.6: Support appeal flow with audit trail entries
 */
export function useSubmitGeoAppeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitAppealInput) => {
      const { data, error } = await supabase
        .from('geo_restriction_appeals')
        .insert({
          restriction_id: input.restrictionId,
          user_id: input.userId,
          appeal_reason: input.appealReason,
          supporting_evidence: input.supportingEvidence,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as GeoRestrictionAppeal;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['geo-appeals'] });
    },
  });
}

/**
 * Hook to get user's geo-restriction appeals
 */
export function useGeoAppeals(userId: string) {
  return useQuery({
    queryKey: ['geo-appeals', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geo_restriction_appeals')
        .select('*, geo_restrictions(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as (GeoRestrictionAppeal & {
        geo_restrictions: { content_id: string };
      })[];
    },
  });
}

/**
 * Hook to get GPS permission status
 */
export function useGpsPermission() {
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    return status === Location.PermissionStatus.GRANTED;
  }, []);

  return {
    permissionStatus,
    isGranted: permissionStatus === Location.PermissionStatus.GRANTED,
    requestPermission,
  };
}

/**
 * Hook to apply geo-restriction (moderator use)
 */
export function useApplyGeoRestriction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contentId,
      restrictedRegions,
      includeInSoR,
    }: {
      contentId: string;
      restrictedRegions: string[];
      includeInSoR: boolean;
    }) => {
      await geoLocationService.applyGeoRestriction(
        contentId,
        restrictedRegions,
        includeInSoR
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate content availability queries
      queryClient.invalidateQueries({
        queryKey: ['content-availability', variables.contentId],
      });
    },
  });
}

/**
 * Hook to get geo-restriction rules for a region
 */
export function useGeoRestrictionRules(regionCode?: string) {
  return useQuery({
    queryKey: ['geo-restriction-rules', regionCode],
    queryFn: async () => {
      let query = supabase
        .from('geo_restriction_rules')
        .select('*')
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('priority', { ascending: false });

      if (regionCode) {
        query = query.or(`region_code.eq.${regionCode},region_code.eq.EU`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data;
    },
    staleTime: 3600000, // 1 hour
  });
}

/**
 * Hook to notify about geo-restriction (moderator use)
 * Requirement 9.7: Notify authors about regional visibility limitations
 */
export function useNotifyGeoRestriction() {
  return useMutation({
    mutationFn: async ({
      userId,
      contentId,
      regions,
    }: {
      userId: string;
      contentId: string;
      regions: string[];
    }) => {
      await geoLocationService.notifyGeoRestriction(userId, contentId, regions);
    },
  });
}

/**
 * Hook to check VPN blocking status
 */
export function useVpnBlocking() {
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'geo_vpn_blocking_enabled')
        .single();

      setIsBlocking(data?.value === true);
    })();
  }, []);

  const setVpnBlocking = useCallback(async (enabled: boolean) => {
    await geoLocationService.setVpnBlocking(enabled);
    setIsBlocking(enabled);
  }, []);

  return {
    isBlocking,
    setVpnBlocking,
  };
}
