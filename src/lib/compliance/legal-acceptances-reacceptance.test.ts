/**
 * Legal Re-Acceptance Integration Test
 * Requirements: 8.3, 8.7
 *
 * Tests:
 * - Major version bump blocks app access and requires re-acceptance
 * - Minor/patch version bump shows notification
 * - Version tracking and acceptance persistence
 * - Document version comparison logic
 */

import {
  acceptAllLegalDocuments,
  acceptLegalDocument,
  checkLegalVersionBumps,
  hydrateLegalAcceptances,
  isAllLegalAccepted,
  legalAcceptancesStore,
  needsLegalReAcceptance,
  resetLegalAcceptances,
} from '@/lib/compliance/legal-acceptances';
import { storage } from '@/lib/storage';
import type { LegalDocumentType } from '@/types/settings';

jest.mock('@/lib/storage');
jest.mock('@/lib/auth', () => ({
  useAuth: {
    getState: jest.fn(() => ({
      user: { id: 'test-user-id' },
    })),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Legal Re-Acceptance Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLegalAcceptances();

    // Mock storage methods
    mockStorage.getString.mockReturnValue(undefined);
    mockStorage.set.mockReturnValue(undefined);
    mockStorage.delete.mockReturnValue(undefined);
  });

  afterEach(() => {
    resetLegalAcceptances();
    jest.restoreAllMocks();
  });

  describe('Initial Acceptance', () => {
    test('all documents start unaccepted', () => {
      hydrateLegalAcceptances();

      const allAccepted = isAllLegalAccepted();
      expect(allAccepted).toBe(false);
    });

    test('accepts individual document', () => {
      acceptLegalDocument('terms', '1.0.0');

      const store = legalAcceptancesStore.getState();
      expect(store.acceptances.terms.accepted).toBe(true);
      expect(store.acceptances.terms.acceptedVersion).toBe('1.0.0');
      expect(store.acceptances.terms.acceptedAt).toBeTruthy();
    });

    test('accepts all documents at once', () => {
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      const allAccepted = isAllLegalAccepted();
      expect(allAccepted).toBe(true);
    });

    test('persists acceptances to storage', () => {
      acceptLegalDocument('terms', '1.0.0');

      expect(mockStorage.set).toHaveBeenCalledWith(
        'compliance.legal.acceptances',
        expect.stringContaining('"terms"')
      );
    });
  });

  describe('Version Bump Detection', () => {
    test('detects major version bump (1.0.0 → 2.0.0)', () => {
      // Accept version 1.0.0
      acceptLegalDocument('terms', '1.0.0');

      // Check if needs re-acceptance for version 2.0.0
      const needsReAcceptance = needsLegalReAcceptance('terms', '2.0.0');
      expect(needsReAcceptance).toBe(true);
    });

    test('detects minor version bump (1.0.0 → 1.1.0)', () => {
      acceptLegalDocument('terms', '1.0.0');

      // Minor bump should NOT require re-acceptance
      const needsReAcceptance = needsLegalReAcceptance('terms', '1.1.0');
      expect(needsReAcceptance).toBe(false);

      // But checkLegalVersionBumps should detect it for notification
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      // Mock current versions with minor bump
      const mockCurrentVersions = {
        terms: { version: '1.1.0', lastUpdated: new Date().toISOString() },
        privacy: { version: '1.0.0', lastUpdated: new Date().toISOString() },
        cannabis: { version: '1.0.0', lastUpdated: new Date().toISOString() },
      };

      const bumps = checkLegalVersionBumps(mockCurrentVersions);
      expect(bumps.needsBlocking).toBe(false);
      expect(bumps.needsNotification).toBe(true);
    });

    test('detects patch version bump (1.0.0 → 1.0.1)', () => {
      acceptLegalDocument('terms', '1.0.0');

      // Patch bump should NOT require re-acceptance
      const needsReAcceptance = needsLegalReAcceptance('terms', '1.0.1');
      expect(needsReAcceptance).toBe(false);
    });

    test('requires re-acceptance for multiple major bumps', () => {
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      expect(needsLegalReAcceptance('terms', '3.0.0')).toBe(true);
      expect(needsLegalReAcceptance('privacy', '2.5.0')).toBe(true);
    });

    test('requires re-acceptance if document never accepted', () => {
      // No prior acceptance
      const needsReAcceptance = needsLegalReAcceptance('terms', '1.0.0');
      expect(needsReAcceptance).toBe(true);
    });
  });

  describe('Blocking App Access', () => {
    test('checkLegalVersionBumps identifies blocking documents', () => {
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      // Mock current versions with major bumps
      const mockCurrentVersions = {
        terms: { version: '2.0.0', lastUpdated: new Date().toISOString() },
        privacy: { version: '2.0.0', lastUpdated: new Date().toISOString() },
        cannabis: { version: '1.0.0', lastUpdated: new Date().toISOString() },
      };

      const bumps = checkLegalVersionBumps(mockCurrentVersions);
      expect(bumps.needsBlocking).toBe(true);
      expect(bumps.documents).toContain('terms');
      expect(bumps.documents).toContain('privacy');
      expect(bumps.documents).not.toContain('cannabis');
    });

    test('blocks access until all major versions accepted', () => {
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      // Mock current versions with major bumps
      const mockCurrentVersions = {
        terms: { version: '2.0.0', lastUpdated: new Date().toISOString() },
        privacy: { version: '2.0.0', lastUpdated: new Date().toISOString() },
        cannabis: { version: '1.0.0', lastUpdated: new Date().toISOString() },
      };

      // Check before accepting new versions
      const beforeBumps = checkLegalVersionBumps(mockCurrentVersions);
      expect(beforeBumps.needsBlocking).toBe(true);

      // Accept updated terms but not privacy
      acceptLegalDocument('terms', '2.0.0');

      // Should still block due to privacy
      const afterTermsBumps = checkLegalVersionBumps(mockCurrentVersions);
      expect(afterTermsBumps.needsBlocking).toBe(true);

      // Accept all updated versions
      acceptLegalDocument('privacy', '2.0.0');

      // Should no longer block
      const finalBumps = checkLegalVersionBumps(mockCurrentVersions);
      expect(finalBumps.needsBlocking).toBe(false);
    });
  });

  describe('Notification Flow (Minor/Patch)', () => {
    test('shows notification for minor version bump', () => {
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      // Mock minor bump
      const mockCurrentVersions = {
        terms: { version: '1.1.0', lastUpdated: new Date().toISOString() },
        privacy: { version: '1.0.0', lastUpdated: new Date().toISOString() },
        cannabis: { version: '1.0.0', lastUpdated: new Date().toISOString() },
      };

      const bumps = checkLegalVersionBumps(mockCurrentVersions);
      expect(bumps.needsBlocking).toBe(false);
      expect(bumps.needsNotification).toBe(true);
      expect(bumps.documents).toContain('terms');
    });

    test('acknowledges minor version without blocking', () => {
      acceptLegalDocument('terms', '1.0.0');

      // User can acknowledge minor version
      acceptLegalDocument('terms', '1.1.0');

      const store = legalAcceptancesStore.getState();
      expect(store.acceptances.terms.acceptedVersion).toBe('1.1.0');
    });
  });

  describe('Persistence and Hydration', () => {
    test('loads persisted acceptances on hydration', () => {
      const persistedData = JSON.stringify({
        acceptances: {
          terms: {
            documentType: 'terms',
            accepted: true,
            acceptedAt: '2025-01-01T00:00:00Z',
            acceptedVersion: '1.0.0',
          },
          privacy: {
            documentType: 'privacy',
            accepted: true,
            acceptedAt: '2025-01-01T00:00:00Z',
            acceptedVersion: '1.0.0',
          },
          cannabis: {
            documentType: 'cannabis',
            accepted: true,
            acceptedAt: '2025-01-01T00:00:00Z',
            acceptedVersion: '1.0.0',
          },
        },
        lastUpdated: '2025-01-01T00:00:00Z',
      });

      mockStorage.getString.mockReturnValue(persistedData);

      hydrateLegalAcceptances();

      const store = legalAcceptancesStore.getState();
      expect(store.acceptances.terms.accepted).toBe(true);
      expect(store.acceptances.terms.acceptedVersion).toBe('1.0.0');
    });

    test('handles corrupted persisted data', () => {
      mockStorage.getString.mockReturnValue('invalid-json');

      hydrateLegalAcceptances();

      // Should fall back to empty state
      const allAccepted = isAllLegalAccepted();
      expect(allAccepted).toBe(false);
    });

    test('resets and clears storage', () => {
      acceptAllLegalDocuments({
        terms: '1.0.0',
        privacy: '1.0.0',
        cannabis: '1.0.0',
      });

      expect(isAllLegalAccepted()).toBe(true);

      resetLegalAcceptances();

      expect(mockStorage.delete).toHaveBeenCalledWith(
        'compliance.legal.acceptances'
      );
      expect(isAllLegalAccepted()).toBe(false);
    });
  });

  describe('Multi-Document Scenarios', () => {
    test('handles mixed version states', () => {
      acceptLegalDocument('terms', '2.0.0'); // Up to date
      acceptLegalDocument('privacy', '1.0.0'); // Needs major update
      acceptLegalDocument('cannabis', '1.5.0'); // Needs minor update

      // Mock current versions
      jest
        .spyOn(
          require('@/lib/compliance/legal-acceptances'),
          'getCurrentLegalVersions'
        )
        .mockReturnValue({
          terms: { version: '2.0.0', lastUpdated: new Date().toISOString() },
          privacy: { version: '2.0.0', lastUpdated: new Date().toISOString() },
          cannabis: { version: '1.6.0', lastUpdated: new Date().toISOString() },
        });

      const termsNeedsReAccept = needsLegalReAcceptance('terms', '2.0.0');
      const privacyNeedsReAccept = needsLegalReAcceptance('privacy', '2.0.0');
      const cannabisNeedsReAccept = needsLegalReAcceptance('cannabis', '1.6.0');

      expect(termsNeedsReAccept).toBe(false); // Up to date
      expect(privacyNeedsReAccept).toBe(true); // Major bump
      expect(cannabisNeedsReAccept).toBe(false); // Minor bump
    });

    test('requires acceptance of all documents before granting access', () => {
      acceptLegalDocument('terms', '1.0.0');
      acceptLegalDocument('privacy', '1.0.0');
      // Cannabis not accepted yet

      expect(isAllLegalAccepted()).toBe(false);

      acceptLegalDocument('cannabis', '1.0.0');

      expect(isAllLegalAccepted()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles same version re-acceptance', () => {
      acceptLegalDocument('terms', '1.0.0');

      // Re-accept same version
      acceptLegalDocument('terms', '1.0.0');

      const store = legalAcceptancesStore.getState();
      expect(store.acceptances.terms.acceptedVersion).toBe('1.0.0');
    });

    test('handles downgrade (newer to older version)', () => {
      acceptLegalDocument('terms', '2.0.0');

      // Check against older version (shouldn't happen, but test edge case)
      const needsReAcceptance = needsLegalReAcceptance('terms', '1.0.0');

      // Major version is lower, so shouldn't need re-acceptance
      expect(needsReAcceptance).toBe(false);
    });

    test('validates all document types', () => {
      const documentTypes: LegalDocumentType[] = [
        'terms',
        'privacy',
        'cannabis',
      ];

      documentTypes.forEach((type) => {
        acceptLegalDocument(type, '1.0.0');
      });

      const store = legalAcceptancesStore.getState();
      documentTypes.forEach((type) => {
        expect(store.acceptances[type].accepted).toBe(true);
      });
    });
  });

  describe('Timestamp Tracking', () => {
    test('records acceptance timestamp', () => {
      const beforeTime = new Date().getTime();

      acceptLegalDocument('terms', '1.0.0');

      const afterTime = new Date().getTime();
      const store = legalAcceptancesStore.getState();
      const acceptedAt = new Date(
        store.acceptances.terms.acceptedAt!
      ).getTime();

      expect(acceptedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(acceptedAt).toBeLessThanOrEqual(afterTime);
    });

    test('updates timestamp on re-acceptance', async () => {
      acceptLegalDocument('terms', '1.0.0');

      const firstAcceptance =
        legalAcceptancesStore.getState().acceptances.terms.acceptedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      acceptLegalDocument('terms', '2.0.0');

      const secondAcceptance =
        legalAcceptancesStore.getState().acceptances.terms.acceptedAt;

      expect(secondAcceptance).not.toBe(firstAcceptance);
    });
  });
});
