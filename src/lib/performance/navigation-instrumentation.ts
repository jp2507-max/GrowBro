/**
 * React Navigation instrumentation for Sentry performance monitoring
 * Tracks navigation transitions with detailed timing spans
 */

import type { NavigationContainerRef } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';

import { PERFORMANCE_OPERATIONS, PERFORMANCE_TRANSACTIONS } from './constants';

let navigationInstrumentationInstance: ReturnType<
  typeof Sentry.reactNavigationIntegration
> | null = null;

/**
 * Creates and configures React Navigation instrumentation for Sentry
 * Should be called once during app initialization
 */
export function createNavigationInstrumentation(): ReturnType<
  typeof Sentry.reactNavigationIntegration
> {
  if (navigationInstrumentationInstance) {
    return navigationInstrumentationInstance;
  }

  navigationInstrumentationInstance = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
  });

  return navigationInstrumentationInstance;
}

type NavigationIntegration = ReturnType<
  typeof Sentry.reactNavigationIntegration
> & {
  registerNavigationContainer?: (
    ref: NavigationContainerRef<Record<string, unknown>>
  ) => void;
};

/**
 * Registers the navigation container with Sentry instrumentation
 * Should be called after the navigation container is mounted
 */
export function registerNavigationContainer(
  navigationRef: NavigationContainerRef<Record<string, unknown>>
): void {
  if (!navigationInstrumentationInstance) {
    console.warn(
      '[Performance] Navigation instrumentation not initialized. Call createNavigationInstrumentation first.'
    );
    return;
  }

  // The reactNavigationIntegration returns an object with a registerNavigationContainer method
  const integration =
    navigationInstrumentationInstance as NavigationIntegration;
  if (
    integration.registerNavigationContainer &&
    typeof integration.registerNavigationContainer === 'function'
  ) {
    integration.registerNavigationContainer(navigationRef);
  }
}

/**
 * Manually track a navigation transition with child spans
 * Use this for custom navigation tracking outside of React Navigation
 */
export function trackNavigationTransition(
  screenName: string,
  operation: 'push' | 'pop' | 'replace' = 'push'
): {
  finish: () => void;
  addSpan: (
    spanName: string,
    spanOperation: string,
    callback: () => void | Promise<void>
  ) => Promise<void>;
} {
  // Use Sentry's startSpan API instead of deprecated startTransaction
  let transactionFinished = false;

  const finish = () => {
    transactionFinished = true;
  };

  const addSpan = async (
    spanName: string,
    spanOperation: string,
    callback: () => void | Promise<void>
  ) => {
    if (transactionFinished) return;

    await Sentry.startSpan(
      {
        op: spanOperation,
        name: spanName,
      },
      callback
    );
  };

  // Start root span for navigation
  void Sentry.startSpan(
    {
      op: `navigation.${operation}`,
      name: `${PERFORMANCE_TRANSACTIONS.NAVIGATION_PUSH}:${screenName}`,
    },
    async () => {
      // Wait for transaction to be finished
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (transactionFinished) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  );

  return { finish, addSpan };
}

/**
 * Track a database read operation within a navigation transaction
 */
export function trackDBRead(
  description: string,
  callback: () => void | Promise<void>
): Promise<void> {
  const span = Sentry.startSpan(
    {
      op: PERFORMANCE_OPERATIONS.DB_READ,
      name: description,
    },
    callback
  );

  return Promise.resolve(span);
}

/**
 * Track a network request within a navigation transaction
 */
export function trackNetworkRequest(
  url: string,
  method: string,
  callback: () => void | Promise<void>
): Promise<void> {
  const span = Sentry.startSpan(
    {
      op: PERFORMANCE_OPERATIONS.NETWORK_REQUEST,
      name: `${method} ${url}`,
    },
    callback
  );

  return Promise.resolve(span);
}

/**
 * Track image decoding/processing within a navigation transaction
 */
export function trackImageDecode(
  imageUrl: string,
  callback: () => void | Promise<void>
): Promise<void> {
  const span = Sentry.startSpan(
    {
      op: PERFORMANCE_OPERATIONS.IMAGE_PROCESSING,
      name: `Image decode: ${imageUrl}`,
    },
    callback
  );

  return Promise.resolve(span);
}

/**
 * Get navigation instrumentation instance
 * Returns null if not initialized
 */
export function getNavigationInstrumentation(): ReturnType<
  typeof Sentry.reactNavigationIntegration
> | null {
  return navigationInstrumentationInstance;
}
