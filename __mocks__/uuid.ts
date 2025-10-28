// Mock for uuid package

let counter = 0;

export const v4 = jest.fn(() => {
  counter++;
  return 'mock-uuid-' + counter.toString(36).slice(0, 9);
});

export const resetUuidCounter = () => {
  counter = 0;
};

export { v4 as uuidv4 };
