// Ambient declarations for globals used in tests/runtime shims
// Ensures TypeScript recognizes `global.__DEV__` mutations in tests

export {};

declare global {
  // In React Native typings, `__DEV__` is declared as a global constant.
  // Our tests temporarily override it on `global` to simulate prod/dev.
  // Augment the global types so `global.__DEV__` is allowed.

  var __DEV__: boolean;

  interface globalThis {
    __DEV__: boolean;
  }

  // Node test environment-specific global augmentation
  namespace NodeJS {
    interface Global {
      __DEV__: boolean;
    }
  }
}
