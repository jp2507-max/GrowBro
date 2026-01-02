/**
 * Unit tests for harvest photo upload service
 */

import * as FileSystem from 'expo-file-system';

import { stripExifAndGeolocation } from '@/lib/media/exif';
import { supabase } from '@/lib/supabase';

import {
  generateHarvestPhotoPath,
  uploadHarvestPhoto,
} from './harvest-photo-upload';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock('@/lib/media/exif', () => ({
  stripExifAndGeolocation: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn((_base64: string) => {
    // Create a mock ArrayBuffer from base64
    // 'ZmFrZSBpbWFnZSBkYXRh' decodes to 'fake image data' (15 bytes)
    return new ArrayBuffer(15);
  }),
}));

describe('generateHarvestPhotoPath', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates correct path for original variant', () => {
    const path = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      variant: 'original',
      extension: 'jpg',
    });

    expect(path).toBe('user123/harvest456/abc123_original.jpg');
  });

  test('generates correct path for resized variant', () => {
    const path = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      variant: 'resized',
      extension: 'jpg',
    });

    expect(path).toBe('user123/harvest456/abc123_resized.jpg');
  });

  test('generates correct path for thumbnail variant', () => {
    const path = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      variant: 'thumbnail',
      extension: 'jpg',
    });

    expect(path).toBe('user123/harvest456/abc123_thumbnail.jpg');
  });

  test('sanitizes user ID by removing leading/trailing slashes', async () => {
    const path = generateHarvestPhotoPath({
      userId: '/malicious/',
      harvestId: 'harvest456',
      hash: 'abc123',
      variant: 'original',
      extension: 'jpg',
    });

    expect(path).toBe('malicious/harvest456/abc123_original.jpg');
  });

  test('sanitizes harvest ID by removing leading/trailing slashes', () => {
    const path = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: '/malicious/',
      hash: 'abc123',
      variant: 'original',
      extension: 'jpg',
    });

    expect(path).toBe('user123/malicious/abc123_original.jpg');
  });

  test('handles different file extensions', () => {
    const pngPath = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      variant: 'original',
      extension: 'png',
    });

    expect(pngPath).toBe('user123/harvest456/abc123_original.png');

    const heicPath = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: 'abc123',
      variant: 'original',
      extension: 'heic',
    });

    expect(heicPath).toBe('user123/harvest456/abc123_original.heic');
  });

  test('removes leading/trailing slashes from hash', () => {
    const path = generateHarvestPhotoPath({
      userId: 'user123',
      harvestId: 'harvest456',
      hash: '/abc123/',
      variant: 'original',
      extension: 'jpg',
    });

    expect(path).toBe('user123/harvest456/abc123_original.jpg');
  });
});

describe('uploadHarvestPhoto', () => {
  const mockUpload = jest.fn();
  const mockStripExif = stripExifAndGeolocation as jest.MockedFunction<
    typeof stripExifAndGeolocation
  >;
  const mockReadAsStringAsync =
    FileSystem.readAsStringAsync as jest.MockedFunction<
      typeof FileSystem.readAsStringAsync
    >;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.storage.from as jest.Mock).mockReturnValue({
      upload: mockUpload,
    });

    // Mock EXIF stripping (no stripping by default)
    mockStripExif.mockResolvedValue({
      uri: 'file:///photos/stripped.jpg',
      didStrip: false,
    });

    // Mock FileSystem.readAsStringAsync to return base64 encoded data
    // 'ZmFrZSBpbWFnZSBkYXRh' is base64 for 'fake image data'
    mockReadAsStringAsync.mockResolvedValue('ZmFrZSBpbWFnZSBkYXRh');
  });

  test('uploads photo successfully with correct parameters', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user123/harvest456/abc123_original.jpg' },
      error: null,
    });

    const result = await uploadHarvestPhoto({
      userId: 'user123',
      harvestId: 'harvest456',
      localUri: 'file:///photos/abc123.jpg',
      variant: 'original',
      hash: 'abc123',
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });

    expect(result.bucket).toBe('harvest-photos');
    expect(result.path).toBe('user123/harvest456/abc123_original.jpg');
    expect(result.fullPath).toBe(
      'harvest-photos/user123/harvest456/abc123_original.jpg'
    );
    expect(mockStripExif).toHaveBeenCalledWith('file:///photos/abc123.jpg');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'file:///photos/stripped.jpg',
      { encoding: 'base64' }
    );
    expect(supabase.storage.from).toHaveBeenCalledWith('harvest-photos');
    expect(mockUpload).toHaveBeenCalledWith(
      'user123/harvest456/abc123_original.jpg',
      expect.any(ArrayBuffer),
      {
        contentType: 'image/jpeg',
        upsert: false,
      }
    );
  });

  test('handles upload failure with error message', async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: 'Storage quota exceeded' },
    });

    await expect(
      uploadHarvestPhoto({
        userId: 'user123',
        harvestId: 'harvest456',
        localUri: 'file:///photos/abc123.jpg',
        variant: 'original',
        hash: 'abc123',
        extension: 'jpg',
        mimeType: 'image/jpeg',
      })
    ).rejects.toThrow('Storage quota exceeded');
  });

  test('handles EXIF stripping error', async () => {
    mockStripExif.mockRejectedValue(new Error('EXIF processing failed'));

    await expect(
      uploadHarvestPhoto({
        userId: 'user123',
        harvestId: 'harvest456',
        localUri: 'file:///photos/abc123.jpg',
        variant: 'original',
        hash: 'abc123',
        extension: 'jpg',
        mimeType: 'image/jpeg',
      })
    ).rejects.toThrow('EXIF processing failed');
  });

  test('converts base64 to ArrayBuffer correctly', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user123/harvest456/abc123_original.jpg' },
      error: null,
    });

    await uploadHarvestPhoto({
      userId: 'user123',
      harvestId: 'harvest456',
      localUri: 'file:///photos/abc123.jpg',
      variant: 'original',
      hash: 'abc123',
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });

    const uploadCall = mockUpload.mock.calls[0];
    const buffer = uploadCall[1] as ArrayBuffer;

    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  test('uses correct mime type for PNG', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user123/harvest456/abc123_original.png' },
      error: null,
    });

    await uploadHarvestPhoto({
      userId: 'user123',
      harvestId: 'harvest456',
      localUri: 'file:///photos/abc123.png',
      variant: 'original',
      hash: 'abc123',
      extension: 'png',
      mimeType: 'image/png',
    });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ArrayBuffer),
      {
        contentType: 'image/png',
        upsert: false,
      }
    );
  });

  test('converts to JPEG when EXIF is stripped', async () => {
    mockStripExif.mockResolvedValue({
      uri: 'file:///photos/stripped.jpg',
      didStrip: true,
    });

    mockUpload.mockResolvedValue({
      data: { path: 'user123/harvest456/abc123_original.jpg' },
      error: null,
    });

    await uploadHarvestPhoto({
      userId: 'user123',
      harvestId: 'harvest456',
      localUri: 'file:///photos/abc123.heic',
      variant: 'original',
      hash: 'abc123',
      extension: 'heic',
      mimeType: 'image/heic',
    });

    expect(mockUpload).toHaveBeenCalledWith(
      'user123/harvest456/abc123_original.jpg',
      expect.any(ArrayBuffer),
      {
        contentType: 'image/jpeg',
        upsert: false,
      }
    );
  });

  test('sets upsert to false to prevent overwriting', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user123/harvest456/abc123_original.jpg' },
      error: null,
    });

    await uploadHarvestPhoto({
      userId: 'user123',
      harvestId: 'harvest456',
      localUri: 'file:///photos/abc123.jpg',
      variant: 'original',
      hash: 'abc123',
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });

    const uploadCall = mockUpload.mock.calls[0];
    expect(uploadCall[2]).toEqual({
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  test('handles all three variants', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'test/path' },
      error: null,
    });

    const variants = ['original', 'resized', 'thumbnail'] as const;

    for (const variant of variants) {
      mockUpload.mockClear();

      await uploadHarvestPhoto({
        userId: 'user123',
        harvestId: 'harvest456',
        localUri: `file:///photos/${variant}.jpg`,
        variant,
        hash: 'abc123',
        extension: 'jpg',
        mimeType: 'image/jpeg',
      });

      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining(`_${variant}.jpg`),
        expect.any(ArrayBuffer),
        expect.any(Object)
      );
    }
  });
});
