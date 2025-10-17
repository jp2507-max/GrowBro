/**
 * Inventory Error Boundary
 *
 * Component-level error boundary for inventory features with Sentry reporting.
 * Provides graceful degradation with fallback UI and recovery actions.
 *
 * Requirements:
 * - 11.5: Error boundaries with proper release tracking
 * - 11.6: Error messages with recovery options
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

interface InventoryErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback component */
  fallback?: React.ComponentType<{
    error: Error;
    resetErrorBoundary: () => void;
  }>;
  /** Optional context for error reporting */
  context?: Record<string, unknown>;
}

/**
 * Inventory Error Boundary Component
 */
export function InventoryErrorBoundary({
  children,
  fallback: CustomFallback,
  context,
}: InventoryErrorBoundaryProps): React.ReactElement {
  const handleError = (
    error: Error,
    info: { componentStack?: string | null }
  ) => {
    // Report to Sentry with inventory context
    captureCategorizedErrorSync(error, {
      feature: 'inventory',
      componentStack: info.componentStack ?? undefined,
      ...context,
    });
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={CustomFallback ?? InventoryErrorFallback}
      onError={handleError}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/**
 * Default fallback UI for inventory errors
 */
function InventoryErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="inventory-error-boundary"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="items-center justify-center p-6"
      >
        {/* Error Icon */}
        <View className="mb-6 size-16 items-center justify-center rounded-full bg-danger-100 dark:bg-danger-900/20">
          <Text className="text-3xl">⚠️</Text>
        </View>

        {/* Error Title */}
        <Text className="mb-2 text-center text-xl font-bold text-neutral-900 dark:text-neutral-100">
          {t('inventory.error_boundary.title')}
        </Text>

        {/* Error Message */}
        <Text className="mb-6 text-center text-sm text-neutral-600 dark:text-neutral-300">
          {t('inventory.error_boundary.message')}
        </Text>

        {/* Error Details (dev only) */}
        {__DEV__ && (
          <View className="mb-6 w-full rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-900">
            <Text className="mb-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {t('common.error_details')}:
            </Text>
            <Text className="font-mono text-xs text-danger-600 dark:text-danger-400">
              {error.message}
            </Text>
            {error.stack && (
              <Text className="mt-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {error.stack.slice(0, 500)}
              </Text>
            )}
          </View>
        )}

        {/* Recovery Actions */}
        <View className="w-full gap-3">
          {/* Retry Button */}
          <Pressable
            accessibilityRole="button"
            onPress={resetErrorBoundary}
            className="rounded-lg bg-primary-600 px-6 py-3"
            testID="retry-button"
          >
            <Text className="text-center text-base font-semibold text-white">
              {t('common.try_again')}
            </Text>
          </Pressable>

          {/* Go Back Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/(tabs)/home');
              }
            }}
            className="rounded-lg border border-neutral-300 bg-white px-6 py-3 dark:border-neutral-700 dark:bg-charcoal-900"
            testID="go-back-button"
          >
            <Text className="text-center text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('common.go_back')}
            </Text>
          </Pressable>

          {/* Go Home Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(app)/(tabs)/home')}
            className="rounded-lg px-6 py-3"
            testID="go-home-button"
          >
            <Text className="text-center text-base font-semibold text-neutral-600 dark:text-neutral-400">
              {t('common.go_home')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Hook to trigger error boundary from child components
 */
export function useErrorHandler(): React.Dispatch<
  React.SetStateAction<Error | null>
> {
  return React.useCallback<React.Dispatch<React.SetStateAction<Error | null>>>(
    (value) => {
      const error = typeof value === 'function' ? value(null) : value;
      if (error instanceof Error) {
        throw error;
      }
    },
    []
  );
}
