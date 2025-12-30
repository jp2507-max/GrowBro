/**
 * Mock for expo-file-system (SDK 54 File API)
 *
 * NOTE: Paths.document.uri and Paths.cache.uri do NOT have trailing slashes
 * in production to match the actual SDK 54 behavior. The helper functions
 * in @/lib/fs/paths ensure trailing slashes are added for path concatenation.
 */

export const cacheDirectory = 'file:///cache';
export const documentDirectory = 'file:///documents';

// Create a mock Directory constructor that can be used in tests
export const Directory = jest
  .fn()
  .mockImplementation(
    (parent: { uri: string } | null | undefined, name: string) => ({
      uri:
        parent && typeof parent.uri === 'string'
          ? `${parent.uri.endsWith('/') ? parent.uri : parent.uri + '/'}${name}`
          : `file:///${name}`,
      exists: true,
      create: jest.fn(),
      list: jest.fn().mockReturnValue([]),
    })
  ) as jest.Mock<DirectoryLike, [{ uri: string } | null | undefined, string]>;

type DirectoryLike = {
  uri: string;
  exists: boolean;
  create: jest.Mock;
  list: jest.Mock;
};

export class File {
  uri: string;
  exists: boolean;
  name: string;
  size: number;

  constructor(parent: DirectoryLike | string, name?: string) {
    if (typeof parent === 'string') {
      this.uri = parent;
      this.name = parent.split('/').pop() || '';
    } else {
      this.uri = name
        ? `${parent.uri}${parent.uri.endsWith('/') ? '' : '/'}${name}`
        : parent.uri;
      this.name = name || '';
    }
    this.exists = true;
    this.size = 1024; // Mock size
  }

  async write(
    _content: string | ArrayBuffer | Uint8Array,
    _options?: { encoding?: string }
  ) {
    // Mock implementation
  }

  copy(_target: File) {
    // Mock implementation
  }

  async delete() {
    // Mock implementation
    this.exists = false;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // Mock implementation - return empty buffer
    return new ArrayBuffer(0);
  }
}

// Provide simple Path objects with `uri` shape to match SDK 54 Paths API
export const Paths = {
  cache: { uri: cacheDirectory },
  document: { uri: documentDirectory },
  get totalDiskSpace() {
    return 100000000; // 100MB
  },
  get availableDiskSpace() {
    return 50000000; // 50MB
  },
};

export const getInfoAsync = jest.fn().mockResolvedValue({
  exists: true,
  isDirectory: false,
  uri: `${documentDirectory}mock`,
  size: 0,
});
export const makeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const copyAsync = jest.fn().mockResolvedValue(undefined);
export const moveAsync = jest.fn().mockResolvedValue(undefined);
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const getFreeDiskStorageAsync = jest.fn().mockResolvedValue(50_000_000);
export const getTotalDiskCapacityAsync = jest
  .fn()
  .mockResolvedValue(100_000_000);

export default {
  cacheDirectory,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  readAsStringAsync,
  copyAsync,
  moveAsync,
  deleteAsync,
  getFreeDiskStorageAsync,
  getTotalDiskCapacityAsync,
};
