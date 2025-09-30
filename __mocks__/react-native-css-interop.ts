// Mock react-native-css-interop for tests
// This prevents issues with CSS interop trying to process components that don't have displayName

export function cssInterop(): void {}

export function rem(value: number): number {
  return value * 16;
}

export function vh(value: number): number {
  return value;
}

export function vw(value: number): number {
  return value;
}

export function vmin(value: number): number {
  return value;
}

export function vmax(value: number): number {
  return value;
}

export function createInteropElement(Component: any): any {
  return Component;
}

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
