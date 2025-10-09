/**
 * Mock for expo-file-system (SDK 54 File API)
 */

export const cacheDirectory = 'file:///cache/';
export const documentDirectory = 'file:///documents/';

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
