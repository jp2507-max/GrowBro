// Mock for uuid package
export const v4 = jest.fn(
  () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
);
export { v4 as uuidv4 };
