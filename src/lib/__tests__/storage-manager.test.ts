import * as FileSystem from 'expo-file-system';

import { createStorageManager } from '@/lib/sync/storage-manager';
import { basename, dirname } from '@/lib/utils/path-utils';

// Mock FileSystem module
const mockFileSystem = (() => {
  const files = new Map<
    string,
    { isDirectory: boolean; size: number; modificationTime: number }
  >();
  const dirChildren = new Map<string, Set<string>>();
  const ROOT = 'file:///';

  function ensurePath(uri: string) {
    if (!dirChildren.has(uri)) dirChildren.set(uri, new Set());
  }

  function asDir(uri: string): string {
    return uri.endsWith('/') ? uri : `${uri}/`;
  }
  function parentOf(uri: string): string {
    return asDir(dirname(uri));
  }
  function childName(parent: string, uri: string): string {
    return basename(uri);
  }

  // Named implementation for moveAsync to keep function sizes reasonable
  async function moveAsyncImpl({ from, to }: { from: string; to: string }) {
    // Determine if from/to are directories by checking their presence in dirChildren or files
    const fromIsDirectory = dirChildren.has(
      from.endsWith('/') ? from : `${from}/`
    );
    const toIsDirectory = dirChildren.has(to.endsWith('/') ? to : `${to}/`);

    // Normalize: append trailing '/' for directories, strip for files
    const fromNormalized = fromIsDirectory
      ? from.endsWith('/')
        ? from
        : `${from}/`
      : from.endsWith('/')
        ? from.slice(0, -1)
        : from;
    const toNormalized = toIsDirectory
      ? to.endsWith('/')
        ? to
        : `${to}/`
      : to.endsWith('/')
        ? to.slice(0, -1)
        : to;

    // Set isDirectoryMove based on directory-aware normalization
    const isDirectoryMove = fromIsDirectory;

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
        // Update mtime to current time for moved file
        const movedFile = {
          ...fromFile,
          modificationTime: Date.now(),
        };
        files.set(toNormalized, movedFile);
        files.delete(fromNormalized);
      }

      // Compute source and destination parents directly using path helpers
      const fromParent = parentOf(fromNormalized);
      const toParent = parentOf(toNormalized);
      const fromName = childName(fromParent, fromNormalized);
      const toName = childName(toParent, toNormalized);

      // Ensure destination parent exists before adding child
      ensurePath(toParent);

      // Update dirChildren by removing from source parent and adding to destination parent
      const fromParentChildren = dirChildren.get(fromParent);
      if (fromParentChildren) {
        fromParentChildren.delete(fromName);
      }

      const toParentChildren = dirChildren.get(toParent);
      if (toParentChildren) {
        toParentChildren.add(toName);
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

    // Fix parent update math for directory moves using proper helper functions
    // This ensures URL schemes are preserved and eliminates off-by-one errors
    const sourceParent = parentOf(sourcePrefix);
    if (sourceParent !== sourcePrefix) {
      const sourceChildName = childName(sourceParent, sourcePrefix);
      operations.parentUpdates.push({
        parent: sourceParent,
        removeChild: sourceChildName,
      });
    }

    const destParent = parentOf(destPrefix);
    if (destParent !== destPrefix) {
      const destChildName = childName(destParent, destPrefix);
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
      // Build relative parts against ROOT constant
      const relativePath = dir.startsWith(ROOT) ? dir.slice(ROOT.length) : dir;
      const parts = relativePath.split('/').filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) {
        const accumulatedParts = parts.slice(0, i + 1);
        const parentPath = ROOT + accumulatedParts.join('/') + '/';
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
      ensurePath(asDir(uri));
    }),
    readDirectoryAsync: jest.fn(async (uri: string) =>
      Array.from(dirChildren.get(uri) ?? [])
    ),
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      const parent = parentOf(uri);
      ensurePath(parent);
      dirChildren.get(parent)!.add(childName(parent, uri));
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
        const parent = parentOf(to);
        ensurePath(parent);
        dirChildren.get(parent)!.add(childName(parent, to));
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
    __reset: jest.fn(() => {
      files.clear();
      dirChildren.clear();
    }),
  };
})();

// Apply mock before any module that uses FileSystem
Object.keys(mockFileSystem).forEach((key) => {
  (FileSystem as any)[key] = (mockFileSystem as any)[key];
});

describe('StorageManager', () => {
  beforeEach(() => {
    (mockFileSystem as any).__reset?.();
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
    const exists = await (FileSystem.getInfoAsync as any)(original);
    expect(exists?.exists).toBe(true);
  });
});
