import * as React from 'react';
import { Pressable } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { OfflineMode } from '@/lib/auth';
import { sessionManager } from '@/lib/auth/session-manager';
import { showErrorMessage } from '@/lib/flash-message';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

interface OfflineModeBannerProps {
  mode: OfflineMode;
  onDismiss?: () => void;
  onReconnect?: () => void;
}

function getBannerStyles(mode: OfflineMode) {
  const isReadonly = mode === 'readonly';
  return {
    bannerClassName: `mx-4 my-2 rounded-lg p-4 ${
      isReadonly
        ? 'bg-warning-100 dark:bg-warning-900'
        : 'bg-danger-100 dark:bg-danger-900'
    }`,
    titleClassName: `font-semibold ${
      isReadonly
        ? 'text-warning-900 dark:text-warning-100'
        : 'text-danger-900 dark:text-danger-100'
    }`,
    messageClassName: `mt-1 text-sm ${
      isReadonly
        ? 'text-warning-800 dark:text-warning-200'
        : 'text-danger-800 dark:text-danger-200'
    }`,
    isReadonly,
    isBlocked: mode === 'blocked',
  };
}

function DismissButton({ onDismiss }: { onDismiss?: () => void }) {
  if (!onDismiss) return null;
  return (
    <Pressable
      testID="offline-mode-banner-dismiss"
      onPress={onDismiss}
      className="ml-3 rounded-full p-2"
      accessibilityRole="button"
      accessibilityLabel={translate('common.dismiss')}
      accessibilityHint={translate('auth.offline_dismiss_hint')}
    >
      <Text
        testID="offline-mode-banner-dismiss-icon"
        className="text-xl text-warning-900 dark:text-warning-100"
      >
        ×
      </Text>
    </Pressable>
  );
}

export function OfflineModeBanner({
  mode,
  onDismiss,
  onReconnect,
}: OfflineModeBannerProps): React.JSX.Element | null {
  const [isReconnecting, setIsReconnecting] = React.useState(false);

  if (mode === 'full') return null;

  const {
    bannerClassName,
    titleClassName,
    messageClassName,
    isReadonly,
    isBlocked,
  } = getBannerStyles(mode);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const isValid = await sessionManager.forceValidation();
      if (isValid && onReconnect) onReconnect();
    } catch (error) {
      captureCategorizedErrorSync(error, {
        source: 'component',
        component: 'OfflineModeBanner',
        action: 'handleReconnect',
      });
      showErrorMessage(translate('auth.offline_reconnect_error'));
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <View
      testID="offline-mode-banner"
      className={bannerClassName}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text testID="offline-mode-banner-title" className={titleClassName}>
            {translate(
              isReadonly
                ? 'auth.offline_readonly_title'
                : 'auth.offline_blocked_title'
            )}
          </Text>
          <Text
            testID="offline-mode-banner-message"
            className={messageClassName}
          >
            {translate(
              isReadonly
                ? 'auth.offline_readonly_message'
                : 'auth.offline_blocked_message'
            )}
          </Text>

          {isBlocked && (
            <Button
              testID="offline-mode-banner-reconnect"
              label={translate('common.reconnect')}
              onPress={handleReconnect}
              disabled={isReconnecting}
              loading={isReconnecting}
              className="mt-3"
              size="sm"
              variant="destructive"
            />
          )}
        </View>

        {isReadonly ? <DismissButton onDismiss={onDismiss} /> : null}
      </View>
    </View>
  );
}
