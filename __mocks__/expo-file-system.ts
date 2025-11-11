/**
 * Mock for expo-file-system (SDK 54 File API)
 */

export const cacheDirectory = 'file:///cache/';
export const documentDirectory = 'file:///documents/';

// Create a mock Directory constructor that can be used in tests
export const Directory = jest
  .fn()
  .mockImplementation(
    (parent: { uri: string } | null | undefined, name: string) => ({
      uri:
        parent && typeof parent.uri === 'string'
          ? `${parent.uri}${name}/`
          : `file:///${name}/`,
      exists: true,
      create: jest.fn(),
      list: jest.fn().mockReturnValue([]),
    })
  ) as any;

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

  async write(_content: any, _options?: any) {
    // Mock implementation
  }

  copy(_target: File) {
    // Mock implementation
  }
}

export const Paths = {
  cache: new Directory(null as any, 'cache'),
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
