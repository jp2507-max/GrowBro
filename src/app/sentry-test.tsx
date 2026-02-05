import { Env } from '@env';
import * as Sentry from '@sentry/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import { Button, ScrollView, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { isSentryPerformanceInitialized } from '@/lib/performance';
import { hasConsent } from '@/lib/privacy-consent';

export default function SentryTest(): React.ReactElement {
  const [lastEventId, setLastEventId] = React.useState<string | null>(null);

  const onSendTestError = React.useCallback(() => {
    const eventId = Sentry.captureException(
      new Error('Sentry test error (dev)')
    );
    setLastEventId(eventId);
    void Sentry.flush();
  }, []);

  // Early return after hooks to satisfy Rules of Hooks
  if (!__DEV__) return <Redirect href="/" />;

  const hasDsn = Boolean(Env.SENTRY_DSN);
  const hasCrashConsent = hasConsent('crashReporting');
  const sentryInitialized = isSentryPerformanceInitialized();

  return (
    <ScrollView>
      <View className="flex-1 gap-4 p-4">
        <View className="gap-1">
          <Text className="text-xl font-bold">
            {translate('sentry_test.title')}
          </Text>
          <Text className="text-neutral-500">
            {translate('sentry_test.subtitle')}
          </Text>
        </View>

        <View className="gap-2 rounded-md border border-neutral-200 bg-white p-3 dark:border-charcoal-700 dark:bg-charcoal-850">
          <Text>
            {hasDsn
              ? translate('sentry_test.dsn_set')
              : translate('sentry_test.dsn_missing')}
          </Text>
          <Text>
            {hasCrashConsent
              ? translate('sentry_test.crash_consent_on')
              : translate('sentry_test.crash_consent_off')}
          </Text>
          <Text>
            {sentryInitialized
              ? translate('sentry_test.initialized_on')
              : translate('sentry_test.initialized_off')}
          </Text>
          {lastEventId ? (
            <Text className="text-xs text-neutral-500">
              {translate('sentry_test.last_event_id', { id: lastEventId })}
            </Text>
          ) : null}
        </View>

        <Button
          label={translate('sentry_test.send_error')}
          onPress={onSendTestError}
          accessibilityLabel={translate('sentry_test.send_error')}
          accessibilityHint={translate('sentry_test.send_error_hint')}
        />
      </View>
    </ScrollView>
  );
}
