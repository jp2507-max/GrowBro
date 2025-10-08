/**
 * Mock for expo-file-system (SDK 54 File API)
 */

export const File = jest.fn();
export const Directory = jest.fn();

export const Paths = {
  cache: 'file:///cache',
  document: 'file:///documents',
  totalDiskSpace: 100000000,
  availableDiskSpace: 50000000,
};

export default {
  File,
  Directory,
  Paths,
};
