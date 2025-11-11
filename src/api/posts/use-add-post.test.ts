import type { AttachmentInput } from './use-add-post';
import { processRemoteAttachment } from './use-add-post';

// Mock the download and upload functions
jest.mock('@/lib/media/photo-storage-service', () => ({
  downloadRemoteImage: jest.fn().mockResolvedValue({
    localUri: '/tmp/downloaded-image.jpg',
    cleanup: jest.fn(),
  }),
  captureAndStore: jest.fn().mockResolvedValue({
    originalPath:
      'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
    resizedPath:
      'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
    thumbnailPath:
      'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
    width: 800,
    height: 600,
    aspectRatio: 4 / 3,
    bytes: 102400,
  }),
  uploadPhoto: jest.fn().mockResolvedValue({
    originalPath:
      'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
    resizedPath:
      'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
    thumbnailPath:
      'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
    width: 800,
    height: 600,
    aspectRatio: 4 / 3,
    bytes: 102400,
  }),
}));

// Mock Supabase auth
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  },
}));

// Mock photo hash function
jest.mock('@/lib/media/photo-hash', () => ({
  hashFileContent: jest.fn().mockResolvedValue('mock-file-hash'),
}));

describe('processRemoteAttachment', () => {
  test('handles prefill attachments without metadata', async () => {
    // Simulate a prefill attachment from parsePrefillImages()
    const prefillAttachment: AttachmentInput = {
      uri: 'https://supabase-storage.com/storage/v1/object/public/images/prefill.jpg',
      filename: 'suggested-photo.jpg',
      // No metadata provided (typical for prefill)
    };

    const result = await processRemoteAttachment(prefillAttachment);

    // Should fall back to downloading and processing the image
    expect(result).toEqual({
      originalPath:
        'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
      resizedPath:
        'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
      thumbnailPath:
        'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    });
  });

  test('handles attachments with complete metadata', async () => {
    const attachmentWithMetadata: AttachmentInput = {
      uri: 'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
      filename: 'photo.jpg',
      metadata: {
        width: 1200,
        height: 800,
        bytes: 204800,
        aspectRatio: 1.5,
        resizedPath:
          'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
        thumbnailPath:
          'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
      },
    };

    const result = await processRemoteAttachment(attachmentWithMetadata);

    expect(result).toEqual({
      originalPath:
        'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
      resizedPath:
        'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
      thumbnailPath:
        'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
      bytes: 204800,
    });
  });

  test('handles Supabase attachments with incomplete metadata by falling back to download', async () => {
    const incompleteAttachment: AttachmentInput = {
      uri: 'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
      filename: 'photo.jpg',
      metadata: {
        width: 1200,
        // Missing height and bytes - should fall back to download
      },
    };

    const result = await processRemoteAttachment(incompleteAttachment);

    // Should fall back to downloading and processing instead of throwing
    expect(result).toEqual({
      originalPath:
        'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
      resizedPath:
        'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
      thumbnailPath:
        'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    });
  });

  test('handles non-Supabase URLs with incomplete metadata', async () => {
    // Mock for non-Supabase URLs
    const {
      downloadRemoteImage,
    } = require('@/lib/media/photo-storage-service');
    downloadRemoteImage.mockResolvedValueOnce({
      localUri: '/tmp/external-image.jpg',
      cleanup: jest.fn(),
    });

    const externalAttachment: AttachmentInput = {
      uri: 'https://trusted-external.com/image.jpg',
      filename: 'external-photo.jpg',
      // No metadata - should still work for non-Supabase URLs
    };

    const result = await processRemoteAttachment(externalAttachment);

    // Should fall back to downloading and processing
    expect(result).toEqual({
      originalPath:
        'https://supabase-storage.com/storage/v1/object/public/images/photo.jpg',
      resizedPath:
        'https://supabase-storage.com/storage/v1/object/public/images/resized/photo.jpg',
      thumbnailPath:
        'https://supabase-storage.com/storage/v1/object/public/images/thumb/photo.jpg',
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    });
  });
});
