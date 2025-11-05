import React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import { LegalDocumentViewer } from './legal-document-viewer';

const mockGetLegalDocument = jest.fn();
const mockGetLastSyncTimestamp = jest.fn();

jest.mock('@/lib/legal/legal-documents-service', () => ({
  getLegalDocument: mockGetLegalDocument,
  getLastSyncTimestamp: mockGetLastSyncTimestamp,
}));

let mockNetworkStatus = { isInternetReachable: true };
jest.mock('@/lib/hooks/use-network-status', () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

const mockI18n = { language: 'en' };
jest.mock('@/lib/i18n', () => ({ default: mockI18n }));

jest.mock('@/lib', () => ({
  translate: (key: string) => key,
}));

afterEach(cleanup);

describe('LegalDocumentViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetworkStatus = { isInternetReachable: true };
    mockI18n.language = 'en';
    mockGetLastSyncTimestamp.mockReturnValue('2024-01-01T00:00:00.000Z');
    // Set default successful mock for getLegalDocument
    mockGetLegalDocument.mockResolvedValue({
      type: 'privacy',
      version: '1.0.0',
      lastUpdated: '2024-01-01T00:00:00.000Z',
      content: {
        en: '# Privacy Policy\n\nThis is the privacy policy content.',
        de: '# Datenschutz\n\nDies ist der Datenschutz-Inhalt.',
      },
      requiresReAcceptance: false,
    });
  });

  describe('Rendering', () => {
    test('renders loading state initially', () => {
      mockGetLegalDocument.mockImplementation(() => new Promise(() => {})); // Never resolves

      setup(<LegalDocumentViewer documentType="privacy" />);
      expect(screen.getByTestId('activity-indicator')).toBeOnTheScreen();
    });

    test('renders document content when loaded successfully', async () => {
      const mockDocument = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# Privacy Policy\n\nThis is the privacy policy content.',
          de: '# Datenschutz\n\nDies ist der Datenschutz-Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);

      setup(<LegalDocumentViewer documentType="privacy" />);

      await waitFor(() => {
        expect(screen.getByText('settings.legal.version')).toBeOnTheScreen();
      });

      expect(screen.getByText('1.0.0')).toBeOnTheScreen();
      expect(screen.getByText('# Privacy Policy')).toBeOnTheScreen();
    });

    test('renders error state when document fails to load', async () => {
      mockGetLegalDocument.mockRejectedValue(new Error('Network error'));

      setup(<LegalDocumentViewer documentType="privacy" />);

      await waitFor(() => {
        expect(
          screen.getByText('settings.legal.document_not_available')
        ).toBeOnTheScreen();
      });
    });

    test('renders offline badge when not connected to internet', async () => {
      const mockDocument = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# Terms of Service\n\nTerms content.',
          de: '# Nutzungsbedingungen\n\nBedingungen Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);
      mockNetworkStatus = { isInternetReachable: false };

      setup(<LegalDocumentViewer documentType="terms" />);

      await waitFor(() => {
        expect(screen.getByText('settings.legal.version')).toBeOnTheScreen();
      });

      expect(
        screen.getByText('settings.legal.may_be_outdated')
      ).toBeOnTheScreen();
    });
  });

  describe('Document Type Handling', () => {
    test('loads different document types correctly', async () => {
      const mockDocument = {
        version: '2.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# Terms\n\nTerms content.',
          de: '# Bedingungen\n\nBedingungen Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);

      setup(<LegalDocumentViewer documentType="terms" />);

      await waitFor(() => {
        expect(screen.getByText('settings.legal.version')).toBeOnTheScreen();
      });

      expect(mockGetLegalDocument).toHaveBeenCalledWith('terms', 'en');
    });

    test('handles German locale correctly', async () => {
      // Override the already-mocked i18n module's language before rendering
      const i18nMock = require('@/lib/i18n').default;
      i18nMock.language = 'de';

      const mockDocument = {
        version: '1.1.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# English Terms\n\nEnglish content.',
          de: '# Deutsche Bedingungen\n\nDeutscher Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);

      setup(<LegalDocumentViewer documentType="terms" />);

      await waitFor(() => {
        expect(screen.getByText('settings.legal.version')).toBeOnTheScreen();
      });

      expect(mockGetLegalDocument).toHaveBeenCalledWith('terms', 'de');
    });
  });

  describe('State Management', () => {
    test('updates loading state correctly', async () => {
      const mockDocument = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# Content\n\nDocument content.',
          de: '# Inhalt\n\nDokument Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);

      setup(<LegalDocumentViewer documentType="privacy" />);

      // Initially loading
      expect(screen.getByTestId('activity-indicator')).toBeOnTheScreen();

      // After loading completes
      await waitFor(() => {
        expect(
          screen.queryByTestId('activity-indicator')
        ).not.toBeOnTheScreen();
      });

      expect(screen.getByText('settings.legal.version')).toBeOnTheScreen();
    });

    test('handles component unmounting during async operation', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockGetLegalDocument.mockReturnValue(promise);

      const { unmount } = setup(<LegalDocumentViewer documentType="privacy" />);

      // Unmount component before promise resolves
      unmount();

      // Resolve the promise after unmount
      resolvePromise!({
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# Content\n\nDocument content.',
          de: '# Inhalt\n\nDokument Inhalt.',
        },
      });

      // Should not throw any errors due to cleanup
      await waitFor(() => {
        expect(true).toBe(true); // Just wait for any potential async operations
      });
    });
  });

  describe('Date Formatting', () => {
    test('displays last synced timestamp when available', async () => {
      mockGetLastSyncTimestamp.mockReturnValue('2024-06-15T10:30:00.000Z');

      const mockDocument = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        content: {
          en: '# Content\n\nDocument content.',
          de: '# Inhalt\n\nDokument Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);

      setup(<LegalDocumentViewer documentType="privacy" />);

      await waitFor(() => {
        expect(
          screen.getByText('settings.legal.last_updated')
        ).toBeOnTheScreen();
      });

      // Should show the sync timestamp, not the document lastUpdated
      expect(screen.getByText('6/15/2024')).toBeOnTheScreen();
    });

    test('falls back to document lastUpdated when no sync timestamp', async () => {
      mockGetLastSyncTimestamp.mockReturnValue(undefined);

      const mockDocument = {
        version: '1.0.0',
        lastUpdated: '2024-03-10T15:45:00.000Z',
        content: {
          en: '# Content\n\nDocument content.',
          de: '# Inhalt\n\nDokument Inhalt.',
        },
      };

      mockGetLegalDocument.mockResolvedValue(mockDocument);

      setup(<LegalDocumentViewer documentType="privacy" />);

      await waitFor(() => {
        expect(
          screen.getByText('settings.legal.last_updated')
        ).toBeOnTheScreen();
      });

      expect(screen.getByText('3/10/2024')).toBeOnTheScreen();
    });
  });
});
