/**
 * Mock for react-native-css-interop SafeAreaView wrapper
 * Prevents displayName errors in tests
 */

export function wrap(Component: any) {
  // Return component as-is without wrapping
  return Component;
}

export default {
  wrap,
};
