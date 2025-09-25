// Mock react-native-css-interop for tests
// This prevents issues with CSS interop trying to process components that don't have displayName

export const cssInterop = jest.fn();

export const rem = jest.fn((value: number) => value * 16);

export const vh = jest.fn((value: number) => value);
export const vw = jest.fn((value: number) => value);
export const vmin = jest.fn((value: number) => value);
export const vmax = jest.fn((value: number) => value);

export const createInteropElement = jest.fn((Component: any) => Component);

// Mock any other exports that might be used
export default {
  cssInterop,
  rem,
  vh,
  vw,
  vmin,
  vmax,
  createInteropElement,
};
