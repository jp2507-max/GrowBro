/* eslint-disable max-lines-per-function, import/first */
// Mock axios FIRST before any imports
jest.mock('axios');

import axios from 'axios';

import type { StrainsApiClient } from './client';
import { getStrainsApiClient, resetStrainsApiClient } from './client';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock env
jest.mock('@env', () => ({
  Env: {
    API_URL: 'https://api.example.com',
  },
}));

// Mock error handling
jest.mock('@/lib/error-handling', () => ({
  categorizeError: jest.fn(() => ({ isRetryable: false })),
}));

// Mock backoff
jest.mock('@/lib/sync/backoff', () => ({
  computeBackoffMs: jest.fn(() => 100),
}));

const createMockAxiosInstance = () => ({
  get: jest.fn(),
  interceptors: {
    response: {
      use: jest.fn((_successFn, _errorFn) => 0),
    },
  },
});

describe('StrainsApiClient', () => {
  let client: StrainsApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStrainsApiClient(); // Reset singleton between tests
    mockAxiosInstance = createMockAxiosInstance();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    client = getStrainsApiClient();
  });

  describe('getStrains', () => {
    test('fetches strains with default params', async () => {
      const mockResponse = {
        data: {
          strains: [
            { id: '1', name: 'Strain 1', race: 'indica' },
            { id: '2', name: 'Strain 2', race: 'sativa' },
          ],
          hasMore: true,
          nextCursor: 'cursor123',
        },
        headers: {},
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
      const result = await client.getStrains();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/strains',
        expect.objectContaining({
          params: expect.any(URLSearchParams),
        })
      );

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('cursor123');
    });

    test('applies search query with proper encoding', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { strains: [], hasMore: false },
        headers: {},
      });

      await client.getStrains({ searchQuery: 'OG Kush #1' });

      const callArgs = mockAxiosInstance.get.mock.calls[0];
      const params = callArgs[1].params as URLSearchParams;
      expect(params.get('search')).toBe('OG%20Kush%20%231');
    });

    test('applies filters correctly', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { strains: [], hasMore: false },
        headers: {},
      });

      await client.getStrains({
        filters: {
          race: 'indica',
          effects: ['Relaxed', 'Happy'],
          thcMin: 15,
          thcMax: 25,
        },
      });

      const params = mockAxiosInstance.get.mock.calls[0][1]
        .params as URLSearchParams;
      expect(params.get('type')).toBe('indica');
      expect(params.get('effects')).toBe('Relaxed,Happy');
      expect(params.get('thc_min')).toBe('15');
      expect(params.get('thc_max')).toBe('25');
    });

    test('uses cursor for pagination when provided', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { strains: [], hasMore: false },
        headers: {},
      });

      await client.getStrains({ cursor: 'cursor123' });

      const params = mockAxiosInstance.get.mock.calls[0][1]
        .params as URLSearchParams;
      expect(params.get('cursor')).toBe('cursor123');
      expect(params.has('page')).toBe(false);
    });

    test('normalizes legacy response format', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [{ id: '1', name: 'Strain 1', race: 'indica' }],
          next: 'https://api.example.com/strains?cursor=next123',
        },
        headers: {},
      });

      const result = await client.getStrains();
      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('next123');
    });

    test('handles direct array response', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          { id: '1', name: 'Strain 1', race: 'indica' },
          { id: '2', name: 'Strain 2', race: 'sativa' },
        ],
        headers: {},
      });

      const result = await client.getStrains({ pageSize: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('getStrain', () => {
    test('fetches single strain by ID', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { strain: { id: '123', name: 'OG Kush', race: 'indica' } },
        headers: {},
      });

      const result = await client.getStrain('123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/strains/123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cache-Control': 'max-age=86400',
          }),
        })
      );

      expect(result.id).toBe('123');
      expect(result.name).toBe('OG Kush');
    });

    test('encodes strain ID properly', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { strain: { id: 'og-kush-#1', name: 'OG Kush #1' } },
        headers: {},
      });

      await client.getStrain('og-kush-#1');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/strains/og-kush-%231',
        expect.any(Object)
      );
    });
  });

  describe('caching', () => {
    test('sends If-None-Match header on subsequent requests', async () => {
      const mockResponse = {
        data: { strains: [], hasMore: false },
        headers: { etag: 'etag123' },
      };

      // First request
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
      await client.getStrains({ searchQuery: 'test' });

      // Second request
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
      await client.getStrains({ searchQuery: 'test' });

      const secondCallArgs = mockAxiosInstance.get.mock.calls[1];
      expect(secondCallArgs[1].headers['If-None-Match']).toBe('etag123');
    });
  });
});
