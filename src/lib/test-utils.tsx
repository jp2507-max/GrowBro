import '@shopify/flash-list/jestSetup';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderOptions } from '@testing-library/react-native';
import { render, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resources } from './i18n/resources';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const i18n = require('./i18n').default;

// Initialize i18n for tests using the same approach as jest-setup
export function initI18n() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const i18n = require('./i18n').default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initReactI18next } = require('react-i18next');

  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      compatibilityJSON: 'v3',
      interpolation: { escapeValue: false },
    });
  }
}

initI18n();

const createAppWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <I18nextProvider i18n={i18n}>
            <NavigationContainer>{children}</NavigationContainer>
          </I18nextProvider>
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = createAppWrapper(); // make sure we have a new wrapper for each render
  return render(ui, { wrapper: Wrapper, ...options });
};

// use this if you want to test user events
export const setup = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = createAppWrapper();
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
};

// Mock network state for offline testing
let mockIsOffline = false;

export const mockNetworkState = {
  setOffline: (offline: boolean) => {
    mockIsOffline = offline;
  },
  isOffline: () => mockIsOffline,
};

// Mock file system for photo testing
const mockFileSystem: Record<string, string> = {};

export const mockFileSystemHelpers = {
  write: (uri: string, content: string) => {
    mockFileSystem[uri] = content;
  },
  read: (uri: string): string | undefined => mockFileSystem[uri],
  delete: (uri: string) => {
    delete mockFileSystem[uri];
  },
  exists: (uri: string): boolean => uri in mockFileSystem,
  clear: () => {
    Object.keys(mockFileSystem).forEach((key) => {
      delete mockFileSystem[key];
    });
  },
  getAll: () => ({ ...mockFileSystem }),
};

export * from '@testing-library/react-native';
export { customRender as render };
