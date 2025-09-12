import * as FileSystem from 'expo-file-system';

import { createStorageManager } from '@/lib/sync/storage-manager';

const mockFileSystem = (() => {
  const files = new Map<
    string,
    { isDirectory: boolean; size: number; modificationTime: number }
  >();
  const dirChildren = new Map<string, Set<string>>();

  function ensurePath(uri: string) {
    if (!dirChildren.has(uri)) dirChildren.set(uri, new Set());
  }

  return {
    documentDirectory: 'file:///docs/',
    cacheDirectory: 'file:///cache/',
    getInfoAsync: jest.fn(async (uri: string) => {
      if (dirChildren.has(uri)) return { exists: true, isDirectory: true };
      const f = files.get(uri);
      if (!f) return { exists: false };
      return {
        exists: true,
        isDirectory: f.isDirectory ?? false,
        size: f.size,
        modificationTime: f.modificationTime,
      } as any;
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
      ensurePath(uri.endsWith('/') ? uri : `${uri}/`);
    }),
    readDirectoryAsync: jest.fn(async (uri: string) =>
      Array.from(dirChildren.get(uri) ?? [])
    ),
    writeAsStringAsync: jest.fn(async (_uri: string, _content: string) => {}),
    readAsStringAsync: jest.fn(async (uri: string) => {
      const f = files.get(uri);
      if (!f) throw new Error('ENOENT');
      return '' + f.size; // not used in this minimal mock
    }),
    copyAsync: jest.fn(
      async ({ from: _from, to }: { from: string; to: string }) => {
        const parent = to.split('/').slice(0, -1).join('/') + '/';
        ensurePath(parent);
        const parentSet = dirChildren.get(parent)!;
        parentSet.add(to.replace(parent, ''));
        files.set(to, {
          isDirectory: false,
          size: 123,
          modificationTime: Date.now(),
        });
      }
    ),
    deleteAsync: jest.fn(async (uri: string) => {
      files.delete(uri);
      // remove from parent directory listing if present
      for (const [dir, children] of dirChildren) {
        const name = uri.replace(dir, '');
        if (children.has(name)) {
          children.delete(name);
          break;
        }
      }
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      // Simple move implementation for test
      const fromFile = files.get(from);
      if (fromFile) {
        files.set(to, fromFile);
        files.delete(from);
      }
      // Update directory structure
      for (const [dir, children] of dirChildren) {
        const name = from.replace(dir, '');
        if (children.has(name)) {
          children.delete(name);
          const toParent = to.split('/').slice(0, -1).join('/') + '/';
          const toName = to.replace(toParent, '');
          if (!dirChildren.has(toParent)) {
            dirChildren.set(toParent, new Set());
          }
          dirChildren.get(toParent)!.add(toName);
          break;
        }
      }
    }),
    getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024),
  };
})();

jest.mock('expo-file-system', () => mockFileSystem);

describe('StorageManager', () => {
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
    // Create a couple of cache entries by touching thumbnail path
    manager.getImagePath('abc', 'thumbnail');
    await manager.cleanupCache(0); // force eviction
    // Ensure original still exists (copyAsync mock put it there)
    const original = manager.getImagePath('abc', 'original');
    const exists = await (FileSystem.getInfoAsync as any)(original);
    expect(exists?.exists).toBe(true);
  });
});
