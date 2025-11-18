/**
 * CommunityErrorBoundary component
 *
 * Error boundary for community feed with:
 * - Graceful error handling
 * - Retry mechanism
 * - Error logging
 */

import React, { type ErrorInfo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface CommunityErrorBoundaryProps {
  children: React.ReactNode;
}

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="mb-2 text-center text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('community.list_error_title')}
      </Text>
      <Text className="mb-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {translate('community.list_error_body')}
      </Text>
      {__DEV__ && (
        <Text className="mb-4 text-xs text-danger-600 dark:text-danger-400">
          {error.message}
        </Text>
      )}
      <Button
        label={translate('community.list_retry')}
        onPress={resetErrorBoundary}
        testID="error-boundary-retry"
      />
    </View>
  );
}

export function CommunityErrorBoundary({
  children,
}: CommunityErrorBoundaryProps): React.ReactElement {
  const handleError = React.useCallback((error: Error, info: ErrorInfo) => {
    console.error('Community feed error:', error, info);
    // Could send to error tracking service here
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}
