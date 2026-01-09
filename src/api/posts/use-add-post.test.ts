import type { AttachmentInput } from './use-add-post';
import { ensureRemoteAttachmentMetadata } from './use-add-post';

// Mock the download and upload functions
jest.mock('@/lib/media/photo-storage-service', () => ({
  downloadRemoteImage: jest.fn().mockResolvedValue({
    localUri: '/tmp/downloaded-image.jpg',
    cleanup: jest.fn(),
  }),
  captureAndStore: jest.fn().mockResolvedValue({
    original: '/tmp/original.jpg',
    resized: '/tmp/resized.jpg',
    thumbnail: '/tmp/thumbnail.jpg',
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

// Mock community media upload service
jest.mock('@/lib/media/community-media-upload-service', () => ({
  uploadCommunityMediaVariants: jest.fn().mockResolvedValue({
    originalPath: 'community-posts/test-user-id/hash123/original.jpg',
    resizedPath: 'community-posts/test-user-id/hash123/resized.jpg',
    thumbnailPath: 'community-posts/test-user-id/hash123/thumbnail.jpg',
    metadata: {
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    },
  }),
  cleanupCommunityMedia: jest.fn(),
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

// Mock file validation
jest.mock('@/lib/media/file-validation', () => ({
  validateFileSize: jest.fn().mockResolvedValue({ isValid: true, error: null }),
}));

describe('ensureRemoteAttachmentMetadata', () => {
  test('handles prefill attachments without metadata', async () => {
    // Simulate a prefill attachment from parsePrefillImages()
    const prefillAttachment: AttachmentInput = {
      uri: 'https://supabase-storage.com/storage/v1/object/public/images/prefill.jpg',
      filename: 'suggested-photo.jpg',
      // No metadata provided (typical for prefill)
    };

    const result = await ensureRemoteAttachmentMetadata(prefillAttachment);

    // Should fall back to downloading and processing the image
    expect(result).toEqual({
      originalPath: 'community-posts/test-user-id/hash123/original.jpg',
      resizedPath: 'community-posts/test-user-id/hash123/resized.jpg',
      thumbnailPath: 'community-posts/test-user-id/hash123/thumbnail.jpg',
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    });
  });

  test('handles attachments with complete metadata', async () => {
    const attachmentWithMetadata: AttachmentInput = {
      uri: 'https://supabase-storage.com/storage/v1/object/public/community-posts/user123/abc123/original.jpg',
      filename: 'photo.jpg',
      metadata: {
        width: 1200,
        height: 800,
        bytes: 204800,
        aspectRatio: 1.5,
        resizedPath:
          'https://supabase-storage.com/storage/v1/object/public/community-posts/user123/abc123/resized.jpg',
        thumbnailPath:
          'https://supabase-storage.com/storage/v1/object/public/community-posts/user123/abc123/thumbnail.jpg',
      },
    };

    const result = await ensureRemoteAttachmentMetadata(attachmentWithMetadata);

    // Should extract storage paths and use provided metadata
    expect(result).toEqual({
      originalPath: 'community-posts/user123/abc123/original.jpg',
      resizedPath: 'community-posts/user123/abc123/resized.jpg',
      thumbnailPath: 'community-posts/user123/abc123/thumbnail.jpg',
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

    const result = await ensureRemoteAttachmentMetadata(incompleteAttachment);

    // Should fall back to downloading and processing instead of throwing
    expect(result).toEqual({
      originalPath: 'community-posts/test-user-id/hash123/original.jpg',
      resizedPath: 'community-posts/test-user-id/hash123/resized.jpg',
      thumbnailPath: 'community-posts/test-user-id/hash123/thumbnail.jpg',
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

    const result = await ensureRemoteAttachmentMetadata(externalAttachment);

    // Should fall back to downloading and processing
    expect(result).toEqual({
      originalPath: 'community-posts/test-user-id/hash123/original.jpg',
      resizedPath: 'community-posts/test-user-id/hash123/resized.jpg',
      thumbnailPath: 'community-posts/test-user-id/hash123/thumbnail.jpg',
      width: 800,
      height: 600,
      aspectRatio: 4 / 3,
      bytes: 102400,
    });
  });

  test('extracts storage path from signed URL', async () => {
    const signedUrlAttachment: AttachmentInput = {
      uri: 'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/sign/community-posts/user123/abc123/original.jpg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      filename: 'test.jpg',
      metadata: {
        width: 1920,
        height: 1080,
        bytes: 1024,
        aspectRatio: 1.78,
        resizedPath:
          'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/sign/community-posts/user123/abc123/resized.jpg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        thumbnailPath:
          'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/sign/community-posts/user123/abc123/thumbnail.jpg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      },
    };

    const result = await ensureRemoteAttachmentMetadata(signedUrlAttachment);

    // Should extract bucket-relative paths (not full signed URLs)
    expect(result.originalPath).toBe(
      'community-posts/user123/abc123/original.jpg'
    );
    expect(result.resizedPath).toBe(
      'community-posts/user123/abc123/resized.jpg'
    );
    expect(result.thumbnailPath).toBe(
      'community-posts/user123/abc123/thumbnail.jpg'
    );
  });

  test('extracts storage path from public URL', async () => {
    const publicUrlAttachment: AttachmentInput = {
      uri: 'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/public/community-posts/user123/abc123/original.jpg',
      filename: 'test.jpg',
      metadata: {
        width: 1920,
        height: 1080,
        bytes: 1024,
        aspectRatio: 1.78,
        resizedPath:
          'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/public/community-posts/user123/abc123/resized.jpg',
        thumbnailPath:
          'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/public/community-posts/user123/abc123/thumbnail.jpg',
      },
    };

    const result = await ensureRemoteAttachmentMetadata(publicUrlAttachment);

    // Should extract bucket-relative paths (not full public URLs)
    expect(result.originalPath).toBe(
      'community-posts/user123/abc123/original.jpg'
    );
    expect(result.resizedPath).toBe(
      'community-posts/user123/abc123/resized.jpg'
    );
    expect(result.thumbnailPath).toBe(
      'community-posts/user123/abc123/thumbnail.jpg'
    );
  });

  test('handles already-extracted storage paths', async () => {
    const storagePathAttachment: AttachmentInput = {
      uri: 'community-posts/user123/abc123/original.jpg',
      filename: 'test.jpg',
      metadata: {
        width: 1920,
        height: 1080,
        bytes: 1024,
        aspectRatio: 1.78,
        resizedPath: 'community-posts/user123/abc123/resized.jpg',
        thumbnailPath: 'community-posts/user123/abc123/thumbnail.jpg',
      },
    };

    const result = await ensureRemoteAttachmentMetadata(storagePathAttachment);

    // Should pass through storage paths unchanged
    expect(result.originalPath).toBe(
      'community-posts/user123/abc123/original.jpg'
    );
    expect(result.resizedPath).toBe(
      'community-posts/user123/abc123/resized.jpg'
    );
    expect(result.thumbnailPath).toBe(
      'community-posts/user123/abc123/thumbnail.jpg'
    );
  });

  test('uses original path as fallback when variant paths are missing', async () => {
    const attachmentWithoutVariants: AttachmentInput = {
      uri: 'https://mgbekkpswaizzthgefbc.supabase.co/storage/v1/object/sign/community-posts/user123/abc123/original.jpg?token=xyz',
      filename: 'test.jpg',
      metadata: {
        width: 1920,
        height: 1080,
        bytes: 1024,
        aspectRatio: 1.78,
        // No resizedPath or thumbnailPath
      },
    };

    const result = await ensureRemoteAttachmentMetadata(
      attachmentWithoutVariants
    );

    // Should use original path for all variants
    expect(result.originalPath).toBe(
      'community-posts/user123/abc123/original.jpg'
    );
    expect(result.resizedPath).toBe(
      'community-posts/user123/abc123/original.jpg'
    );
    expect(result.thumbnailPath).toBe(
      'community-posts/user123/abc123/original.jpg'
    );
  });
});
