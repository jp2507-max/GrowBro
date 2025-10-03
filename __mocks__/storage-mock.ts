// Mock for @/lib/storage
const mockStorage = {
  getAllKeys: jest.fn().mockReturnValue([]),
  getString: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clearAll: jest.fn(),
  getBoolean: jest.fn(),
  getNumber: jest.fn(),
};

export const storage = mockStorage;
