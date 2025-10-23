/**
 * Geo-Location Hooks Tests
 * Tests for React Native geo-location integration
 * Part of Task 10: Geo-Location Service (Requirements 9.1-9.7)
 */

import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import { cleanup, renderHook, waitFor } from '@/lib/test-utils';

import { geoLocationService } from './geo-location-service';
import {
  useContentAvailability,
  useGeoLocation,
  useGeoRestrictionExplainer,
  useGpsPermission,
  useSubmitGeoAppeal,
} from './use-geo-location';

// Mock dependencies
jest.mock('expo-location');
jest.mock('../geo-location-service');
jest.mock('@/lib/supabase');

afterEach(cleanup);

describe('useGeoLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch IP-based location by default', async () => {
    // Requirement 9.1: Default to IP-based geolocation
    const mockLocation = {
      location: {
        country: 'DE',
        region: 'Bavaria',
        city: 'Munich',
      },
      method: 'ip',
      confidenceScore: 0.9,
      timestamp: new Date(),
    };

    (geoLocationService.detectUserLocationIP as jest.Mock).mockResolvedValue(
      mockLocation
    );
    (geoLocationService.getDecisionTtlMs as jest.Mock).mockReturnValue(3600000);

    const { result } = renderHook(() => useGeoLocation());

    await waitFor(() => {
      expect(result.current.location).toEqual(mockLocation);
    });

    expect(geoLocationService.detectUserLocationIP).toHaveBeenCalledWith({});
  });

  test('should request GPS location with consent', async () => {
    // Requirement 9.1: GPS only with explicit consent
    const mockGpsLocation = {
      location: {
        country: 'DE',
        region: 'Bavaria',
        coords: {
          latitude: 48.1351,
          longitude: 11.582,
        },
      },
      method: 'gps',
      confidenceScore: 1.0,
      timestamp: new Date(),
    };

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: 'granted',
      }
    );

    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 48.1351,
        longitude: 11.582,
        accuracy: 10,
      },
      timestamp: Date.now(),
    });

    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
      {
        isoCountryCode: 'DE',
        region: 'Bavaria',
        city: 'Munich',
        timezone: 'Europe/Berlin',
      },
    ]);

    (geoLocationService.requestGPSLocation as jest.Mock).mockResolvedValue(
      undefined
    );
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    (geoLocationService.detectUserLocationIP as jest.Mock).mockResolvedValue(
      mockGpsLocation
    );
    (geoLocationService.getDecisionTtlMs as jest.Mock).mockReturnValue(3600000);

    const { result } = renderHook(() => useGeoLocation());

    await waitFor(() => {
      expect(result.current.location).toBeDefined();
    });

    const gpsResult = await result.current.requestGpsLocation(
      'Show nearby growers'
    );

    expect(gpsResult).toMatchObject({
      method: 'gps',
      location: {
        country: 'DE',
        coords: expect.any(Object),
      },
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  test('should reject GPS request without permission', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: 'denied',
      }
    );
    (geoLocationService.detectUserLocationIP as jest.Mock).mockResolvedValue(
      {}
    );
    (geoLocationService.getDecisionTtlMs as jest.Mock).mockReturnValue(3600000);

    const { result } = renderHook(() => useGeoLocation());

    await waitFor(() => {
      expect(result.current.location).toBeDefined();
    });

    const gpsResult = await result.current.requestGpsLocation(
      'Show nearby growers'
    );

    expect(gpsResult).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('GPS permission denied');
  });
});

describe('useContentAvailability', () => {
  test('should check content availability in user location', async () => {
    // Requirement 9.3: Provide "why can't I see this?" explainer
    const mockLocation = {
      location: { country: 'DE' },
      method: 'ip',
      confidenceScore: 0.9,
      timestamp: new Date(),
    };

    const mockAvailability = {
      available: true,
    };

    (geoLocationService.detectUserLocationIP as jest.Mock).mockResolvedValue(
      mockLocation
    );
    (
      geoLocationService.checkContentAvailability as jest.Mock
    ).mockResolvedValue(mockAvailability);
    (geoLocationService.getDecisionTtlMs as jest.Mock).mockReturnValue(3600000);

    const { result } = renderHook(() => useContentAvailability('content-123'));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockAvailability);
    });

    expect(geoLocationService.checkContentAvailability).toHaveBeenCalledWith(
      'content-123',
      mockLocation.location
    );
  });

  test('should return unavailable with explainer for restricted content', async () => {
    const mockLocation = {
      location: { country: 'FR' },
      method: 'ip',
      confidenceScore: 0.9,
      timestamp: new Date(),
    };

    const mockAvailability = {
      available: false,
      reason: 'illegal_content' as const,
      lawfulBasis: 'French Public Health Code Article L3421-1',
      affectedRegions: ['FR'],
      explainerText:
        'This content is not available in FR due to legal restrictions.',
    };

    (geoLocationService.detectUserLocationIP as jest.Mock).mockResolvedValue(
      mockLocation
    );
    (
      geoLocationService.checkContentAvailability as jest.Mock
    ).mockResolvedValue(mockAvailability);
    (geoLocationService.getDecisionTtlMs as jest.Mock).mockReturnValue(3600000);

    const { result } = renderHook(() => useContentAvailability('content-123'));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockAvailability);
    });
    expect(result.current.data?.explainerText).toContain('FR');
  });
});

describe('useGeoRestrictionExplainer', () => {
  test('should return explainer for restricted content', async () => {
    const mockLocation = {
      location: { country: 'FR' },
      method: 'ip',
      confidenceScore: 0.9,
      timestamp: new Date(),
    };

    const mockAvailability = {
      available: false,
      reason: 'illegal_content' as const,
      lawfulBasis: 'French law',
      affectedRegions: ['FR'],
      explainerText: 'Not available in your region',
    };

    (geoLocationService.detectUserLocationIP as jest.Mock).mockResolvedValue(
      mockLocation
    );
    (
      geoLocationService.checkContentAvailability as jest.Mock
    ).mockResolvedValue(mockAvailability);
    (geoLocationService.getDecisionTtlMs as jest.Mock).mockReturnValue(3600000);

    const { result } = renderHook(() =>
      useGeoRestrictionExplainer('content-123')
    );

    await waitFor(() => {
      expect(result.current.isRestricted).toBe(true);
    });
    expect(result.current.explainerText).toBe('Not available in your region');
    expect(result.current.lawfulBasis).toBe('French law');
    expect(result.current.affectedRegions).toEqual(['FR']);
  });
});

describe('useSubmitGeoAppeal', () => {
  test('should submit geo-restriction appeal', async () => {
    // Requirement 9.6: Support appeal flow with audit trail entries
    const mockAppeal = {
      id: 'appeal-123',
      restriction_id: 'restriction-123',
      user_id: 'user-123',
      appeal_reason: 'False positive',
      status: 'pending',
    };

    const fromMock = {
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest
            .fn()
            .mockResolvedValue({ data: mockAppeal, error: null }),
        }),
      }),
    };

    (supabase.from as jest.Mock).mockReturnValue(fromMock);

    const { result } = renderHook(() => useSubmitGeoAppeal());

    await waitFor(() => {
      expect(result.current.mutate).toBeDefined();
    });

    result.current.mutate({
      restrictionId: 'restriction-123',
      userId: 'user-123',
      appealReason: 'False positive',
      supportingEvidence: {
        locationType: 'passport',
      },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fromMock.insert).toHaveBeenCalledWith({
      restriction_id: 'restriction-123',
      user_id: 'user-123',
      appeal_reason: 'False positive',
      supporting_evidence: { locationType: 'passport' },
      status: 'pending',
    });
  });
});

describe('useGpsPermission', () => {
  test('should check GPS permission status', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Location.PermissionStatus.GRANTED,
    });

    const { result } = renderHook(() => useGpsPermission());

    await waitFor(() => {
      expect(result.current.isGranted).toBe(true);
    });
  });

  test('should request GPS permission', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Location.PermissionStatus.UNDETERMINED,
    });

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: Location.PermissionStatus.GRANTED,
      }
    );

    const { result } = renderHook(() => useGpsPermission());

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe(
        Location.PermissionStatus.UNDETERMINED
      );
    });

    const granted = await result.current.requestPermission();

    expect(granted).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });
});
