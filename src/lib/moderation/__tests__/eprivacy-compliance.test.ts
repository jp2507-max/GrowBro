// @ts-nocheck
/**
 * ePrivacy Directive Compliance Tests (Directive 2002/58/EC, Art. 5(3))
 * Tests GPS consent requirements and device fingerprinting restrictions
 *
 * Requirements:
 * - Requirement 9.1: IP geolocation as default (no consent required)
 * - Requirement 9.2: GPS location only with explicit consent
 * - Requirement 8.6: No device fingerprinting without consent
 * - ePrivacy Directive Art. 5(3): Terminal equipment access requires consent
 */

import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';

import { AgeVerificationService } from '../age-verification-service';
import { GeoLocationService } from '../geo-location-service';

describe('ePrivacy Compliance Tests', () => {
  let geoLocationService: GeoLocationService;
  let ageVerificationService: AgeVerificationService;

  beforeEach(() => {
    geoLocationService = new GeoLocationService(supabase);
    ageVerificationService = new AgeVerificationService(supabase);
    jest.clearAllMocks();
  });

  describe('GPS Location Consent (ePrivacy Art. 5(3))', () => {
    it('should use IP geolocation by default without consent', async () => {
      const userId = 'user-ip-default';

      const location = await geoLocationService.detectUserLocation(userId, {
        method: 'ip',
        requireConsent: false,
      });

      expect(location.method).toBe('ip');
      expect(location.consentRequired).toBe(false);
      expect(location.consentObtained).toBeUndefined();
    });

    it('should require explicit consent for GPS location', async () => {
      const userId = 'user-gps-consent-required';

      await expect(
        geoLocationService.detectUserLocation(userId, {
          method: 'gps',
          requireConsent: true,
          hasConsent: false,
        })
      ).rejects.toThrow(/GPS location requires explicit user consent/i);
    });

    it('should allow GPS location with explicit consent', async () => {
      const userId = 'user-gps-with-consent';

      const mockGPSLocation = {
        coords: {
          latitude: 52.52,
          longitude: 13.405,
          accuracy: 10,
        },
      };

      jest
        .spyOn(Location, 'getCurrentPositionAsync')
        .mockResolvedValue(mockGPSLocation as any);

      const location = await geoLocationService.detectUserLocation(userId, {
        method: 'gps',
        requireConsent: true,
        hasConsent: true,
        purpose: 'Geo-restriction enforcement for age-restricted content',
      });

      expect(location.method).toBe('gps');
      expect(location.consentObtained).toBe(true);
      expect(location.purpose).toBeDefined();
      expect(location.coords).toMatchObject({
        latitude: 52.52,
        longitude: 13.405,
      });
    });

    it('should record consent for GPS location access', async () => {
      const userId = 'user-gps-consent-record';

      jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({
        coords: { latitude: 52.52, longitude: 13.405, accuracy: 10 },
      } as any);

      await geoLocationService.detectUserLocation(userId, {
        method: 'gps',
        requireConsent: true,
        hasConsent: true,
        purpose: 'Content geo-restriction',
      });

      const { data: consentRecord } = await supabase
        .from('privacy_consents')
        .select('*')
        .eq('user_id', userId)
        .eq('consent_type', 'gps_location')
        .single();

      expect(consentRecord).toMatchObject({
        user_id: userId,
        consent_type: 'gps_location',
        granted: true,
        purpose: 'Content geo-restriction',
        granted_at: expect.any(String),
      });
    });

    it('should provide clear user benefit explanation for GPS request', async () => {
      const userId = 'user-gps-benefit';

      const consentRequest = await geoLocationService.requestGPSConsent(
        userId,
        {
          purpose: 'Accurate geo-restriction for legal compliance',
          benefit: 'Ensures you can access content available in your region',
        }
      );

      expect(consentRequest.purpose).toBeDefined();
      expect(consentRequest.benefit).toBeDefined();
      expect(consentRequest.consentText).toContain('benefit');
      expect(consentRequest.canDecline).toBe(true);
    });

    it('should fall back to IP geolocation when GPS consent denied', async () => {
      const userId = 'user-gps-denied-fallback';

      const location = await geoLocationService.detectUserLocation(userId, {
        method: 'gps',
        requireConsent: true,
        hasConsent: false,
        fallbackToIP: true,
      });

      expect(location.method).toBe('ip');
      expect(location.fallbackUsed).toBe(true);
      expect(location.originalMethodDenied).toBe('gps');
    });

    it('should allow users to revoke GPS consent', async () => {
      const userId = 'user-gps-revoke';

      // Grant consent
      await geoLocationService.grantGPSConsent(userId, {
        purpose: 'Geo-restriction',
      });

      // Revoke consent
      await geoLocationService.revokeGPSConsent(userId);

      const { data: consentRecord } = await supabase
        .from('privacy_consents')
        .select('*')
        .eq('user_id', userId)
        .eq('consent_type', 'gps_location')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(consentRecord?.granted).toBe(false);
      expect(consentRecord?.revoked_at).toBeDefined();
    });

    it('should not cache GPS location without consent', async () => {
      const userId = 'user-gps-no-cache';

      // Attempt GPS without consent
      await expect(
        geoLocationService.detectUserLocation(userId, {
          method: 'gps',
          requireConsent: true,
          hasConsent: false,
        })
      ).rejects.toThrow();

      // Verify no location cached
      const { data: cachedLocation } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', userId)
        .eq('method', 'gps')
        .single();

      expect(cachedLocation).toBeNull();
    });
  });

  describe('Device Fingerprinting Restrictions (ePrivacy Art. 5(3))', () => {
    it('should not perform device fingerprinting without consent', async () => {
      const userId = 'user-no-fingerprint';

      const result = await ageVerificationService.detectSuspiciousActivity(
        userId,
        {
          rapidVerificationAttempts: 5,
          multipleDevices: true,
        },
        false // No consent
      );

      expect(result.fingerprintingPerformed).toBe(false);
      expect(result.deviceFingerprintCollected).toBe(false);
    });

    it('should allow device fingerprinting with explicit consent', async () => {
      const userId = 'user-fingerprint-consent';

      const result = await ageVerificationService.detectSuspiciousActivity(
        userId,
        {
          rapidVerificationAttempts: 5,
          multipleDevices: true,
          deviceFingerprint: 'fp-123',
        },
        true // Has consent
      );

      expect(result.fingerprintingPerformed).toBe(true);
      expect(result.consentVerified).toBe(true);
    });

    it('should not store device fingerprints without consent', async () => {
      const userId = 'user-no-fingerprint-storage';

      await ageVerificationService.detectSuspiciousActivity(
        userId,
        {
          rapidVerificationAttempts: 3,
          deviceFingerprint: 'should-not-be-stored',
        },
        false // No consent
      );

      const { data: storedData } = await supabase
        .from('age_verification_audit')
        .select('*')
        .eq('user_id', userId);

      storedData?.forEach((record) => {
        expect(record.metadata?.deviceFingerprint).toBeUndefined();
        expect(record.metadata?.deviceId).toBeUndefined();
        expect(record.metadata?.hardwareId).toBeUndefined();
      });
    });

    it('should request consent before collecting device identifiers', async () => {
      const userId = 'user-device-id-consent';

      const consentRequest =
        await ageVerificationService.requestDeviceFingerprintConsent(userId, {
          purpose: 'Fraud prevention and age verification enforcement',
          dataCollected: [
            'Device model',
            'OS version',
            'Screen resolution',
            'Timezone',
          ],
        });

      expect(consentRequest.purpose).toBeDefined();
      expect(consentRequest.dataCollected).toHaveLength(4);
      expect(consentRequest.canDecline).toBe(true);
      expect(consentRequest.consentText).toContain('device');
    });

    it('should use alternative fraud detection without fingerprinting', async () => {
      const userId = 'user-alternative-fraud-detection';

      const result = await ageVerificationService.detectSuspiciousActivity(
        userId,
        {
          rapidVerificationAttempts: 10,
          suspiciousPatterns: true,
        },
        false // No consent for fingerprinting
      );

      expect(result.suspiciousActivityDetected).toBe(true);
      expect(result.detectionMethod).toBe('behavioral_analysis');
      expect(result.fingerprintingPerformed).toBe(false);
    });

    it('should not use VPN/proxy detection without consent', async () => {
      const userId = 'user-no-vpn-detection';

      const location = await geoLocationService.detectUserLocation(userId, {
        method: 'ip',
        detectVPN: true,
        hasVPNDetectionConsent: false,
      });

      expect(location.vpnDetectionPerformed).toBe(false);
      expect(location.isVPN).toBeUndefined();
    });

    it('should allow VPN/proxy detection with consent', async () => {
      const userId = 'user-vpn-detection-consent';

      const location = await geoLocationService.detectUserLocation(userId, {
        method: 'ip',
        detectVPN: true,
        hasVPNDetectionConsent: true,
      });

      expect(location.vpnDetectionPerformed).toBe(true);
      expect(location.isVPN).toBeDefined();
    });
  });

  describe('Consent Management', () => {
    it('should provide granular consent options', async () => {
      const userId = 'user-granular-consent';

      const consentOptions = await geoLocationService.getConsentOptions(userId);

      expect(consentOptions).toContainEqual(
        expect.objectContaining({
          type: 'gps_location',
          required: false,
          purpose: expect.any(String),
        })
      );

      expect(consentOptions).toContainEqual(
        expect.objectContaining({
          type: 'device_fingerprinting',
          required: false,
          purpose: expect.any(String),
        })
      );

      expect(consentOptions).toContainEqual(
        expect.objectContaining({
          type: 'vpn_detection',
          required: false,
          purpose: expect.any(String),
        })
      );
    });

    it('should allow users to grant consent selectively', async () => {
      const userId = 'user-selective-consent';

      // Grant GPS consent but deny fingerprinting
      await geoLocationService.updateConsent(userId, {
        gps_location: true,
        device_fingerprinting: false,
        vpn_detection: false,
      });

      const consents = await geoLocationService.getUserConsents(userId);

      expect(consents.gps_location).toBe(true);
      expect(consents.device_fingerprinting).toBe(false);
      expect(consents.vpn_detection).toBe(false);
    });

    it('should record consent timestamp and version', async () => {
      const userId = 'user-consent-timestamp';

      await geoLocationService.grantGPSConsent(userId, {
        purpose: 'Geo-restriction',
      });

      const { data: consentRecord } = await supabase
        .from('privacy_consents')
        .select('*')
        .eq('user_id', userId)
        .eq('consent_type', 'gps_location')
        .single();

      expect(consentRecord).toMatchObject({
        granted_at: expect.any(String),
        consent_version: expect.any(String),
        privacy_policy_version: expect.any(String),
      });
    });

    it('should allow users to withdraw consent at any time', async () => {
      const userId = 'user-withdraw-consent';

      // Grant consent
      await geoLocationService.grantGPSConsent(userId, {
        purpose: 'Geo-restriction',
      });

      // Withdraw consent
      await geoLocationService.withdrawConsent(userId, 'gps_location');

      const { data: consentRecord } = await supabase
        .from('privacy_consents')
        .select('*')
        .eq('user_id', userId)
        .eq('consent_type', 'gps_location')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(consentRecord?.granted).toBe(false);
      expect(consentRecord?.withdrawn_at).toBeDefined();
    });

    it('should stop data collection immediately after consent withdrawal', async () => {
      const userId = 'user-immediate-stop';

      // Grant consent
      await geoLocationService.grantGPSConsent(userId, {
        purpose: 'Geo-restriction',
      });

      // Use GPS
      jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({
        coords: { latitude: 52.52, longitude: 13.405, accuracy: 10 },
      } as any);

      await geoLocationService.detectUserLocation(userId, {
        method: 'gps',
        requireConsent: true,
        hasConsent: true,
      });

      // Withdraw consent
      await geoLocationService.withdrawConsent(userId, 'gps_location');

      // Attempt GPS again - should fail
      await expect(
        geoLocationService.detectUserLocation(userId, {
          method: 'gps',
          requireConsent: true,
          hasConsent: false,
        })
      ).rejects.toThrow(/consent required/i);
    });
  });

  describe('Consent UI Requirements', () => {
    it('should provide clear consent request text', async () => {
      const userId = 'user-clear-consent-text';

      const consentRequest = await geoLocationService.requestGPSConsent(
        userId,
        {
          purpose: 'Geo-restriction enforcement',
        }
      );

      expect(consentRequest.consentText).toBeDefined();
      expect(consentRequest.consentText.length).toBeGreaterThan(50);
      expect(consentRequest.consentText).toContain('location');
      expect(consentRequest.consentText).toContain('purpose');
    });

    it('should provide accept and decline options', async () => {
      const userId = 'user-accept-decline';

      const consentRequest = await geoLocationService.requestGPSConsent(
        userId,
        {
          purpose: 'Geo-restriction',
        }
      );

      expect(consentRequest.acceptButtonText).toBeDefined();
      expect(consentRequest.declineButtonText).toBeDefined();
      expect(consentRequest.canDecline).toBe(true);
    });

    it('should link to privacy policy in consent request', async () => {
      const userId = 'user-privacy-policy-link';

      const consentRequest = await geoLocationService.requestGPSConsent(
        userId,
        {
          purpose: 'Geo-restriction',
        }
      );

      expect(consentRequest.privacyPolicyUrl).toBeDefined();
      expect(consentRequest.privacyPolicyUrl).toMatch(/^https?:\/\//);
    });

    it('should not use pre-ticked consent boxes', async () => {
      const userId = 'user-no-preticked';

      const consentRequest = await geoLocationService.requestGPSConsent(
        userId,
        {
          purpose: 'Geo-restriction',
        }
      );

      expect(consentRequest.defaultChecked).toBe(false);
      expect(consentRequest.requiresExplicitAction).toBe(true);
    });
  });

  describe('Data Minimization with Consent', () => {
    it('should collect minimal data even with consent', async () => {
      const userId = 'user-minimal-data';

      jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({
        coords: {
          latitude: 52.52,
          longitude: 13.405,
          accuracy: 10,
          altitude: 100,
          altitudeAccuracy: 5,
          heading: 90,
          speed: 0,
        },
      } as any);

      const location = await geoLocationService.detectUserLocation(userId, {
        method: 'gps',
        requireConsent: true,
        hasConsent: true,
        purpose: 'Geo-restriction',
      });

      // Should only store necessary fields
      expect(location.coords).toMatchObject({
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      });

      // Should not store unnecessary fields
      expect(location.coords.altitude).toBeUndefined();
      expect(location.coords.heading).toBeUndefined();
      expect(location.coords.speed).toBeUndefined();
    });

    it('should not retain location data longer than necessary', async () => {
      const userId = 'user-location-retention';

      jest.spyOn(Location, 'getCurrentPositionAsync').mockResolvedValue({
        coords: { latitude: 52.52, longitude: 13.405, accuracy: 10 },
      } as any);

      await geoLocationService.detectUserLocation(userId, {
        method: 'gps',
        requireConsent: true,
        hasConsent: true,
        purpose: 'Geo-restriction',
      });

      // Mock time passage (1 hour - cache TTL)
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1000));

      // Run cleanup
      await geoLocationService.cleanupExpiredLocations();

      const { data: cachedLocation } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', userId)
        .single();

      expect(cachedLocation).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('Audit Logging for Consent', () => {
    it('should log all consent grants and withdrawals', async () => {
      const userId = 'user-consent-audit';

      // Grant consent
      await geoLocationService.grantGPSConsent(userId, {
        purpose: 'Geo-restriction',
      });

      // Withdraw consent
      await geoLocationService.withdrawConsent(userId, 'gps_location');

      const { data: auditLogs } = await supabase
        .from('privacy_consent_audit')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      expect(auditLogs).toHaveLength(2);
      expect(auditLogs?.[0].action).toBe('consent_granted');
      expect(auditLogs?.[1].action).toBe('consent_withdrawn');
    });

    it('should log consent version and policy version', async () => {
      const userId = 'user-consent-version-audit';

      await geoLocationService.grantGPSConsent(userId, {
        purpose: 'Geo-restriction',
      });

      const { data: auditLog } = await supabase
        .from('privacy_consent_audit')
        .select('*')
        .eq('user_id', userId)
        .single();

      expect(auditLog?.metadata).toMatchObject({
        consent_version: expect.any(String),
        privacy_policy_version: expect.any(String),
      });
    });
  });
});
