/**
 * Mock for nativewind package
 * Prevents CSS interop wrapping during tests
 */

export function cssInterop(Component: any, _config?: any): any {
  // Return component as-is without wrapping
  // Ensure it has a displayName for React DevTools
  if (Component && !Component.displayName) {
    Component.displayName = Component.name || 'Component';
  }
  return Component;
}

export function useColorScheme() {
  return {
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  };
}

export default {
  cssInterop,
  useColorScheme,
};
