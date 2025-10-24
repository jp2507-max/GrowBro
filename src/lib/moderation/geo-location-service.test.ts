/**
 * Geo-Location Service Tests
 * Tests for privacy-first geographic content filtering
 * Part of Task 10: Geo-Location Service (Requirements 9.1-9.7)
 */

import { supabase } from '@/lib/supabase';
import type { IPLocationRequest, LocationData } from '@/types/geo-location';

import { GeoLocationService } from './geo-location-service';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('GeoLocationService', () => {
  let service: GeoLocationService;

  beforeEach(() => {
    service = new GeoLocationService();
    jest.clearAllMocks();
  });

  describe('detectUserLocationIP', () => {
    test('should detect location using IP address', async () => {
      // Requirement 9.1: Default to IP-based geolocation
      const mockResponse = {
        country: 'DE',
        region: 'Bavaria',
        city: 'Munich',
        timezone: 'Europe/Berlin',
        confidence: 0.95,
        vpnDetected: false,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const request: IPLocationRequest = {};
      const result = await service.detectUserLocationIP(request);

      expect(result).toMatchObject({
        location: {
          country: 'DE',
          region: 'Bavaria',
          city: 'Munich',
          timezone: 'Europe/Berlin',
        },
        method: 'ip',
        vpnDetected: false,
        confidenceScore: 0.95,
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('ip-geolocation', {
        body: {
          ipAddress: undefined,
          includeVpnCheck: false,
        },
      });
    });

    test('should include VPN check when requested', async () => {
      const mockResponse = {
        country: 'US',
        vpnDetected: true,
        confidence: 0.7,
      };

      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const request: IPLocationRequest = { includeVpnCheck: true };
      const result = await service.detectUserLocationIP(request);

      expect(result.vpnDetected).toBe(true);
    });

    test('should throw error on IP lookup failure', async () => {
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'IP lookup failed' },
      });

      const request: IPLocationRequest = {};

      await expect(service.detectUserLocationIP(request)).rejects.toThrow(
        'IP geolocation failed'
      );
    });
  });

  describe('requestGPSLocation', () => {
    test('should reject GPS request without consent', async () => {
      // Requirement 9.1: GPS only with explicit consent
      await expect(
        service.requestGPSLocation('user-123', 'Show nearby growers', false)
      ).rejects.toThrow('GPS location requires explicit user consent');
    });

    test('should log GPS request with consent', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      await expect(
        service.requestGPSLocation('user-123', 'Show nearby growers', true)
      ).rejects.toThrow(
        'GPS location must be requested from React Native client'
      );

      expect(supabase.from).toHaveBeenCalledWith('audit_events');
    });
  });

  describe('checkContentAvailability', () => {
    test('should return available for unrestricted content', async () => {
      // Requirement 9.3: Maintain content availability in permitted regions
      const mockResult = { available: true };

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      });

      const location: LocationData = { country: 'US' };
      const result = await service.checkContentAvailability(
        'content-123',
        location
      );

      expect(result.available).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'check_content_geo_availability',
        {
          p_content_id: 'content-123',
          p_user_location: location,
        }
      );
    });

    test('should return unavailable with explainer for restricted content', async () => {
      // Requirement 9.3: Provide "why can't I see this?" explainer
      const mockResult = {
        available: false,
        reason: 'illegal_content',
        lawful_basis: 'French Public Health Code Article L3421-1',
        affected_regions: ['FR'],
      };

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      });

      const location: LocationData = { country: 'FR' };
      const result = await service.checkContentAvailability(
        'content-123',
        location
      );

      expect(result).toMatchObject({
        available: false,
        reason: 'illegal_content',
        lawfulBasis: 'French Public Health Code Article L3421-1',
        affectedRegions: ['FR'],
      });
      expect(result.explainerText).toContain('FR');
      expect(result.explainerText).toContain('legal restrictions');
    });
  });

  describe('applyGeoRestriction', () => {
    test('should apply geo-restriction to content', async () => {
      // Requirement 9.7: Notify authors about regional visibility limitations
      const mockRestriction = { id: 'restriction-123' };
      const mockContent = { user_id: 'author-123' };

      const fromMock = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockRestriction, error: null }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockContent, error: null }),
          }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(fromMock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockContent, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await service.applyGeoRestriction('content-123', ['FR', 'DE'], true);

      expect(supabase.from).toHaveBeenCalledWith('geo_restrictions');
    });

    test('should expand EU region code to member states', async () => {
      const mockRestriction = { id: 'restriction-123' };
      const mockContent = { user_id: 'author-123' };

      const fromMock = {
        insert: jest.fn((_data) => ({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockRestriction, error: null }),
          }),
        })),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockContent, error: null }),
          }),
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(fromMock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockContent, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await service.applyGeoRestriction('content-123', ['EU'], false);

      // Should expand EU to all member states
      const insertCall = fromMock.insert.mock.calls[0][0];
      expect(insertCall.restricted_regions).toContain('FR');
      expect(insertCall.restricted_regions).toContain('DE');
      expect(insertCall.restricted_regions.length).toBeGreaterThan(20);
    });
  });

  describe('notifyGeoRestriction', () => {
    test('should send notification to author', async () => {
      // Requirement 9.7: Provide author notifications indicating affected regions
      const mockRestriction = {
        id: 'restriction-123',
        lawful_basis: 'Local law',
      };

      const selectMock = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest
                  .fn()
                  .mockResolvedValue({ data: mockRestriction, error: null }),
              }),
            }),
          }),
        }),
      };

      const insertMock = {
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(selectMock)
        .mockReturnValueOnce(insertMock);

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      await service.notifyGeoRestriction('author-123', 'content-123', [
        'FR',
        'DE',
      ]);

      expect(supabase.from).toHaveBeenCalledWith(
        'geo_restriction_notifications'
      );
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'send-notification',
        {
          body: expect.objectContaining({
            userId: 'author-123',
            title: expect.stringContaining('Content Restricted'),
            body: expect.stringContaining('FR, DE'),
          }),
        }
      );
    });
  });

  describe('setVpnBlocking', () => {
    test('should update VPN blocking configuration', async () => {
      // Requirement 9.5: Config-driven VPN/proxy detection
      const upsertMock = jest.fn().mockResolvedValue({ data: {}, error: null });

      (supabase.from as jest.Mock).mockReturnValue({
        upsert: upsertMock,
      });

      await service.setVpnBlocking(true);

      expect(supabase.from).toHaveBeenCalledWith('app_config');
      expect(upsertMock).toHaveBeenCalledWith({
        key: 'geo_vpn_blocking_enabled',
        value: true,
        updated_at: expect.any(String),
      });
    });
  });

  describe('getDecisionTtlMs', () => {
    test('should return cache TTL in milliseconds', () => {
      const ttl = service.getDecisionTtlMs();
      expect(ttl).toBe(3600000); // 1 hour
    });
  });

  describe('resolveSignalMismatch', () => {
    test('should apply most restrictive setting on mismatch', () => {
      // Requirement 9.2: Apply most restrictive setting on signal mismatch
      const ipLocation: LocationData = { country: 'US' };
      const deviceLocation: LocationData = { country: 'CA' };

      const result = service.resolveSignalMismatch(ipLocation, deviceLocation);

      // Should prefer IP location as it's harder to spoof
      expect(result.country).toBe('US');
    });
  });
});
