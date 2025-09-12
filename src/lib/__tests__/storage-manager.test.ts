import * as FileSystem from 'expo-file-system';

import { createStorageManager } from '@/lib/sync/storage-manager';

// Mock FileSystem module
const mockFileSystem = (() => {
  const files = new Map<
    string,
    { isDirectory: boolean; size: number; modificationTime: number }
  >();
  const dirChildren = new Map<string, Set<string>>();

  function ensurePath(uri: string) {
    if (!dirChildren.has(uri)) dirChildren.set(uri, new Set());
  }

  // Named implementation for moveAsync to keep function sizes reasonable
  async function moveAsyncImpl({ from, to }: { from: string; to: string }) {
    const fromNormalized = from.endsWith('/') ? from : from;
    const toNormalized = to.endsWith('/') ? to : to;

    const isDirectoryMove = fromNormalized.endsWith('/');

    if (isDirectoryMove) {
      const sourcePrefix = fromNormalized;
      const destPrefix = toNormalized.endsWith('/')
        ? toNormalized
        : `${toNormalized}/`;

      const operations = _collectMoveOperations(sourcePrefix, destPrefix);
      _applyMoveOperations(operations, destPrefix);
    } else {
      const fromFile = files.get(fromNormalized);
      if (fromFile) {
        files.set(toNormalized, fromFile);
        files.delete(fromNormalized);
      }

      for (const [dir, children] of dirChildren) {
        const name = fromNormalized.replace(dir, '');
        if (children.has(name)) {
          children.delete(name);
          const toParent = toNormalized.split('/').slice(0, -1).join('/') + '/';
          ensurePath(toParent);
          const toName = toNormalized.replace(toParent, '');
          dirChildren.get(toParent)!.add(toName);
          break;
        }
      }
    }
  }

  function _collectMoveOperations(sourcePrefix: string, destPrefix: string) {
    const operations = {
      filesToAdd: new Map<
        string,
        { isDirectory: boolean; size: number; modificationTime: number }
      >(),
      filesToDelete: new Set<string>(),
      dirsToAdd: new Map<string, Set<string>>(),
      dirsToDelete: new Set<string>(),
      parentUpdates: [] as {
        parent: string;
        removeChild?: string;
        addChild?: string;
      }[],
    };

    for (const [key, file] of files) {
      if (key.startsWith(sourcePrefix)) {
        const newKey = key.replace(sourcePrefix, destPrefix);
        operations.filesToAdd.set(newKey, file);
        operations.filesToDelete.add(key);
      }
    }

    for (const [dir, children] of dirChildren) {
      if (dir.startsWith(sourcePrefix)) {
        const newDir = dir.replace(sourcePrefix, destPrefix);
        operations.dirsToAdd.set(newDir, new Set(children));
        operations.dirsToDelete.add(dir);
      }
    }

    const sourceParts = sourcePrefix.split('/').filter(Boolean);
    if (sourceParts.length > 1) {
      const sourceParent = sourceParts.slice(0, -1).join('/') + '/';
      const sourceChildName = sourceParts[sourceParts.length - 1];
      operations.parentUpdates.push({
        parent: sourceParent,
        removeChild: sourceChildName,
      });
    }

    const destParts = destPrefix.split('/').filter(Boolean);
    if (destParts.length > 1) {
      const destParent = destParts.slice(0, -1).join('/') + '/';
      const destChildName = destParts[destParts.length - 1];
      operations.parentUpdates.push({
        parent: destParent,
        addChild: destChildName,
      });
    }

    return operations;
  }

  function _applyMoveOperations(
    operations: ReturnType<typeof _collectMoveOperations>,
    destPrefix: string
  ) {
    for (const key of operations.filesToDelete) files.delete(key);
    for (const dir of operations.dirsToDelete) dirChildren.delete(dir);
    for (const [key, file] of operations.filesToAdd) files.set(key, file);

    for (const [dir, children] of operations.dirsToAdd) {
      dirChildren.set(dir, children);
      let parentPath = '';
      const parts = dir.split('/').filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) {
        parentPath += parts[i] + '/';
        ensurePath(parentPath);
      }
    }

    for (const update of operations.parentUpdates) {
      ensurePath(update.parent);
      const parentChildren = dirChildren.get(update.parent)!;
      if (update.removeChild) parentChildren.delete(update.removeChild);
      if (update.addChild) parentChildren.add(update.addChild);
    }

    if (!files.has(destPrefix)) {
      files.set(destPrefix, {
        isDirectory: true,
        size: 0,
        modificationTime: Date.now(),
      });
    }
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
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      const parent = uri.split('/').slice(0, -1).join('/') + '/';
      ensurePath(parent);
      const parentSet = dirChildren.get(parent)!;
      parentSet.add(uri.replace(parent, ''));
      files.set(uri, {
        isDirectory: false,
        size: content.length,
        modificationTime: Date.now(),
      });
    }),
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
    moveAsync: jest.fn(moveAsyncImpl),
    getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024),
  };
})();

// Apply mock before any module that uses FileSystem
Object.keys(mockFileSystem).forEach((key) => {
  (FileSystem as any)[key] = (mockFileSystem as any)[key];
});

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
