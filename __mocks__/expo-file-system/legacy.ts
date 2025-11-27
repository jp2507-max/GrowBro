// Jest manual mock forwarding for expo-file-system/legacy
// Re-export the existing top-level expo-file-system mock so imports
// of 'expo-file-system/legacy' resolve in the Jest/node environment.
export * from '../expo-file-system';
export { default } from '../expo-file-system';
