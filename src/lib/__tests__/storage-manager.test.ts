// Import after mocks are set up
import * as FileSystem from 'expo-file-system/legacy';

import { createStorageManager } from '@/lib/sync/storage-manager';
import { basename, dirname } from '@/lib/utils/path-utils';

// Mock state - use 'mock' prefix to allow reference in jest.mock
const mockFiles = new Map<
  string,
  { isDirectory: boolean; size: number; modificationTime: number }
>();
const mockDirChildren = new Map<string, Set<string>>();

function mockAsDir(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}
function mockParentOf(uri: string): string {
  return mockAsDir(dirname(uri));
}
function mockChildName(_parent: string, uri: string): string {
  return basename(uri);
}
function mockEnsurePath(uri: string) {
  if (!mockDirChildren.has(uri)) mockDirChildren.set(uri, new Set());
}

function resetMockState() {
  mockFiles.clear();
  mockDirChildren.clear();
}

// Mock the new Paths API from expo-file-system
jest.mock('expo-file-system', () => ({
  Paths: {
    cache: { uri: 'file:///cache/' },
    document: { uri: 'file:///docs/' },
  },
}));

// Mock the legacy FileSystem module
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async (uri: string) => {
    if (mockDirChildren.has(uri)) return { exists: true, isDirectory: true };
    const f = mockFiles.get(uri);
    if (!f) return { exists: false };
    return {
      exists: true,
      isDirectory: f.isDirectory ?? false,
      size: f.size,
      modificationTime: f.modificationTime,
    };
  }),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockEnsurePath(mockAsDir(uri));
  }),
  readDirectoryAsync: jest.fn(async (uri: string) =>
    Array.from(mockDirChildren.get(uri) ?? [])
  ),
  writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
    const parent = mockParentOf(uri);
    mockEnsurePath(parent);
    mockDirChildren.get(parent)!.add(mockChildName(parent, uri));
    mockFiles.set(uri, {
      isDirectory: false,
      size: content.length,
      modificationTime: Date.now(),
    });
  }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    const f = mockFiles.get(uri);
    if (!f) throw new Error('ENOENT');
    return '' + f.size;
  }),
  copyAsync: jest.fn(
    async ({ from: _from, to }: { from: string; to: string }) => {
      const parent = mockParentOf(to);
      mockEnsurePath(parent);
      mockDirChildren.get(parent)!.add(mockChildName(parent, to));
      mockFiles.set(to, {
        isDirectory: false,
        size: 123,
        modificationTime: Date.now(),
      });
    }
  ),
  deleteAsync: jest.fn(async (uri: string) => {
    mockFiles.delete(uri);
    for (const [dir, children] of mockDirChildren) {
      const name = uri.replace(dir, '');
      if (children.has(name)) {
        children.delete(name);
        break;
      }
    }
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const fromFile = mockFiles.get(from);
    if (fromFile) {
      mockFiles.set(to, { ...fromFile, modificationTime: Date.now() });
      mockFiles.delete(from);
    }
  }),
  getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024),
}));

describe('StorageManager', () => {
  beforeEach(() => {
    resetMockState();
    jest.clearAllMocks();
  });
  const manager = createStorageManager({ cacheLimitBytes: 1 * 1024 });

  it('stores original and provides deterministic paths', async () => {
    const originalPath = await manager.storeImage('file:///tmp/input.jpg', {
      id: 'abc',
    });
    expect(typeof originalPath).toBe('string');
    expect(manager.getImagePath('abc', 'original')).toBe(originalPath);
    const thumbPath = manager.getImagePath('abc', 'thumbnail');
    expect(thumbPath.includes('/cache/')).toBe(true);
  });

  it('reports storage usage without throwing', async () => {
    const info = await manager.getStorageUsage();
    expect(info.totalSize).toBeGreaterThanOrEqual(0);
    expect(info.availableSpace).toBeGreaterThan(0);
  });

  it('cleans up cache via LRU without affecting originals', async () => {
    // Create original first
    await manager.storeImage('file:///tmp/input.jpg', { id: 'abc' });
    // Create a couple of cache entries by touching thumbnail path
    manager.getImagePath('abc', 'thumbnail');
    await manager.cleanupCache(0); // force eviction
    // Ensure original still exists
    const original = manager.getImagePath('abc', 'original');
    const exists = await (FileSystem.getInfoAsync as jest.Mock)(original);
    expect(exists?.exists).toBe(true);
  });
});
