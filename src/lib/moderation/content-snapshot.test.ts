/**
 * Unit tests for content snapshot manager
 *
 * Tests cryptographic hashing and snapshot integrity verification
 */

import stringify from 'fast-json-stable-stringify';

import {
  createContentSnapshot,
  extractMinimalSnapshotData,
  generateContentHash,
  verifySnapshotIntegrity,
} from '@/lib/moderation/content-snapshot';
import type { ContentSnapshot } from '@/types/moderation';

// Mock expo-crypto with a simple but distinct hash function
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn((algorithm, content, _options) => {
    // Generate a simple but unique hash based on content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Promise.resolve(`mock_hash_${Math.abs(hash).toString(16)}`);
  }),
  randomUUID: jest.fn(() => 'mock-uuid-123'),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  CryptoEncoding: {
    HEX: 'hex',
  },
}));

describe('generateContentHash', () => {
  test('generates hash for content string', async () => {
    const content = 'This is test content';
    const hash = await generateContentHash(content);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  test('generates consistent hash for same content', async () => {
    const content = 'Consistent content';
    const hash1 = await generateContentHash(content);
    const hash2 = await generateContentHash(content);

    expect(hash1).toBe(hash2);
  });

  test('generates different hashes for different content', async () => {
    const content1 = 'Content A';
    const content2 = 'Content B';

    const hash1 = await generateContentHash(content1);
    const hash2 = await generateContentHash(content2);

    expect(hash1).not.toBe(hash2);
  });
});

describe('createContentSnapshot', () => {
  const mockContentData = {
    id: '123',
    user_id: 'user-456',
    content: 'Test post content',
    created_at: '2025-01-01T00:00:00Z',
  };

  test('creates snapshot with hash and metadata', async () => {
    const snapshot = await createContentSnapshot({
      contentId: '123',
      contentType: 'post',
      contentData: mockContentData,
      reportId: 'report-789',
    });

    expect(snapshot).toMatchObject({
      id: expect.any(String),
      content_id: '123',
      content_type: 'post',
      snapshot_hash: expect.any(String),
      snapshot_data: mockContentData,
      captured_by_report_id: 'report-789',
    });
    expect(snapshot.captured_at).toBeInstanceOf(Date);
    expect(snapshot.created_at).toBeInstanceOf(Date);
  });

  test('creates snapshot without report ID', async () => {
    const snapshot = await createContentSnapshot({
      contentId: '123',
      contentType: 'post',
      contentData: mockContentData,
    });

    expect(snapshot.captured_by_report_id).toBeUndefined();
  });

  test('snapshot hash matches content data', async () => {
    const snapshot = await createContentSnapshot({
      contentId: '123',
      contentType: 'post',
      contentData: mockContentData,
    });

    const expectedHash = await generateContentHash(stringify(mockContentData));

    expect(snapshot.snapshot_hash).toBe(expectedHash);
  });
});

describe('verifySnapshotIntegrity', () => {
  test('verifies valid snapshot', async () => {
    const mockContentData = {
      id: '123',
      content: 'Test content',
    };

    const snapshot: ContentSnapshot = {
      id: 'snapshot-1',
      content_id: '123',
      content_type: 'post',
      snapshot_hash: await generateContentHash(stringify(mockContentData)),
      snapshot_data: mockContentData,
      captured_at: new Date(),
      created_at: new Date(),
    };

    const isValid = await verifySnapshotIntegrity(snapshot);

    expect(isValid).toBe(true);
  });

  test('detects tampered snapshot', async () => {
    const originalData = {
      id: '123',
      content: 'Original content',
    };

    const tamperedData = {
      id: '123',
      content: 'Tampered content',
    };

    const snapshot: ContentSnapshot = {
      id: 'snapshot-1',
      content_id: '123',
      content_type: 'post',
      snapshot_hash: await generateContentHash(stringify(originalData)),
      snapshot_data: tamperedData, // Data doesn't match hash!
      captured_at: new Date(),
      created_at: new Date(),
    };

    const isValid = await verifySnapshotIntegrity(snapshot);

    expect(isValid).toBe(false);
  });
});

describe('extractMinimalSnapshotData', () => {
  test('extracts minimal fields for post', () => {
    const fullPost = {
      id: '123',
      user_id: 'user-456',
      title: 'Test Post',
      content: 'Post content',
      media_urls: ['https://example.com/image.jpg'],
      visibility: 'public',
      extra_field: 'not needed',
      another_extra: 'also not needed',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };

    const minimal = extractMinimalSnapshotData(fullPost, 'post');

    expect(minimal).toEqual({
      id: '123',
      user_id: 'user-456',
      title: 'Test Post',
      content: 'Post content',
      media_urls: ['https://example.com/image.jpg'],
      visibility: 'public',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    });
    expect(minimal).not.toHaveProperty('extra_field');
    expect(minimal).not.toHaveProperty('another_extra');
  });

  test('extracts minimal fields for comment', () => {
    const fullComment = {
      id: '456',
      user_id: 'user-789',
      post_id: 'post-123',
      content: 'Comment text',
      parent_comment_id: null,
      extra: 'not needed',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };

    const minimal = extractMinimalSnapshotData(fullComment, 'comment');

    expect(minimal).toEqual({
      id: '456',
      user_id: 'user-789',
      post_id: 'post-123',
      content: 'Comment text',
      parent_comment_id: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    });
  });

  test('extracts minimal fields for image', () => {
    const fullImage = {
      id: '789',
      user_id: 'user-123',
      url: 'https://example.com/image.jpg',
      caption: 'Image caption',
      alt_text: 'Alt text',
      extra: 'not needed',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };

    const minimal = extractMinimalSnapshotData(fullImage, 'image');

    expect(minimal).toEqual({
      id: '789',
      user_id: 'user-123',
      url: 'https://example.com/image.jpg',
      caption: 'Image caption',
      alt_text: 'Alt text',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    });
  });

  test('extracts minimal fields for profile', () => {
    const fullProfile = {
      id: '321',
      username: 'testuser',
      display_name: 'Test User',
      bio: 'User bio',
      avatar_url: 'https://example.com/avatar.jpg',
      extra: 'not needed',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };

    const minimal = extractMinimalSnapshotData(fullProfile, 'profile');

    expect(minimal).toEqual({
      id: '321',
      username: 'testuser',
      display_name: 'Test User',
      bio: 'User bio',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    });
  });

  test('preserves all data for "other" content type', () => {
    const fullData = {
      id: '999',
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    };

    const minimal = extractMinimalSnapshotData(fullData, 'other');

    expect(minimal).toEqual(fullData);
  });

  test('handles missing fields gracefully', () => {
    const partialPost = {
      id: '123',
      user_id: 'user-456',
      // Missing title, content, etc.
    };

    const minimal = extractMinimalSnapshotData(partialPost, 'post');

    expect(minimal).toEqual({
      id: '123',
      user_id: 'user-456',
    });
  });
});
