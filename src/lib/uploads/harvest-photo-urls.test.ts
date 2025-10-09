/**
 * Unit tests for harvest photo signed URL service
 */

import { supabase } from '@/lib/supabase';

import {
  getHarvestPhotoVariantUrls,
  getSignedUrl,
  getSignedUrls,
} from './harvest-photo-urls';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

describe('getSignedUrl', () => {
  const mockCreateSignedUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.storage.from as jest.Mock).mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });
  });

  test('generates signed URL successfully', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/signed-url-123' },
      error: null,
    });

    const result = await getSignedUrl(
      'user123/harvest456/abc123_original.jpg',
      3600
    );

    expect(result.signedUrl).toBe('https://storage.supabase.co/signed-url-123');
    expect(result.path).toBe('user123/harvest456/abc123_original.jpg');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(supabase.storage.from).toHaveBeenCalledWith('harvest-photos');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_original.jpg',
      3600
    );
  });

  test('uses default expiration of 1 hour', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/signed-url-123' },
      error: null,
    });

    await getSignedUrl('user123/harvest456/abc123_original.jpg');

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_original.jpg',
      3600
    );
  });

  test('handles storage error', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'File not found' },
    });

    await expect(
      getSignedUrl('user123/harvest456/missing.jpg')
    ).rejects.toThrow('File not found');
  });

  test('handles null signedUrl', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: null },
      error: null,
    });

    await expect(
      getSignedUrl('user123/harvest456/abc123_original.jpg')
    ).rejects.toThrow('Signed URL is null');
  });
});

describe('getSignedUrls', () => {
  const mockCreateSignedUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.storage.from as jest.Mock).mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });
  });

  test('generates signed URLs for multiple paths', async () => {
    mockCreateSignedUrl
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.supabase.co/url-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.supabase.co/url-2' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.supabase.co/url-3' },
        error: null,
      });

    const paths = [
      'user123/harvest456/abc123_original.jpg',
      'user123/harvest456/abc123_resized.jpg',
      'user123/harvest456/abc123_thumbnail.jpg',
    ];

    const results = await getSignedUrls(paths);

    expect(results).toHaveLength(3);
    expect(results[0].path).toBe('user123/harvest456/abc123_original.jpg');
    expect(results[0].signedUrl).toBe('https://storage.supabase.co/url-1');
    expect(results[1].signedUrl).toBe('https://storage.supabase.co/url-2');
    expect(results[2].signedUrl).toBe('https://storage.supabase.co/url-3');
  });

  test('handles empty array', async () => {
    const results = await getSignedUrls([]);
    expect(results).toEqual([]);
  });

  test('uses custom expiration for all URLs', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/url' },
      error: null,
    });

    const paths = [
      'user123/harvest456/abc123_original.jpg',
      'user123/harvest456/abc123_resized.jpg',
    ];

    await getSignedUrls(paths, 7200);

    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(paths[0], 7200);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(paths[1], 7200);
  });
});

describe('getHarvestPhotoVariantUrls', () => {
  const mockCreateSignedUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.storage.from as jest.Mock).mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });
  });

  test('generates URLs for all three variants', async () => {
    mockCreateSignedUrl
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.supabase.co/original' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.supabase.co/resized' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.supabase.co/thumbnail' },
        error: null,
      });

    const result = await getHarvestPhotoVariantUrls({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      extension: 'jpg',
    });

    expect(result.original).toBe('https://storage.supabase.co/original');
    expect(result.resized).toBe('https://storage.supabase.co/resized');
    expect(result.thumbnail).toBe('https://storage.supabase.co/thumbnail');
  });

  test('constructs correct paths for variants', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/url' },
      error: null,
    });

    await getHarvestPhotoVariantUrls({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      extension: 'jpg',
    });

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_original.jpg',
      3600
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_resized.jpg',
      3600
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_thumbnail.jpg',
      3600
    );
  });

  test('uses custom expiration time', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/url' },
      error: null,
    });

    await getHarvestPhotoVariantUrls({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      extension: 'jpg',
      expiresIn: 7200,
    });

    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(3);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(expect.any(String), 7200);
  });

  test('handles different file extensions', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/url' },
      error: null,
    });

    await getHarvestPhotoVariantUrls({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      extension: 'png',
    });

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_original.png',
      3600
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_resized.png',
      3600
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'user123/harvest456/abc123_thumbnail.png',
      3600
    );
  });
});
