/**
 * Bug Report Form Screen
 * Route: /settings/support/report-bug
 * Requirements: 7.4, 7.8, 7.9
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { z } from 'zod';

import {
  Button,
  ControlledInput,
  FocusAwareStatusBar,
  ScrollView,
  Select,
  Text,
  View,
} from '@/components/ui';
import { translate, useAuth } from '@/lib';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import {
  collectDiagnostics,
  prepareDiagnosticsForSubmission,
  redactSecrets,
} from '@/lib/support/diagnostics';
import { submitBugReport } from '@/lib/support/submit-bug-report';
import type { BugDiagnostics } from '@/types/settings';

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

const bugReportSchema = z.object({
  title: z
    .string()
    .min(5, 'settings.support.report_bug.title_too_short')
    .max(100, 'settings.support.report_bug.title_too_long'),
  description: z
    .string()
    .min(20, 'settings.support.report_bug.description_too_short')
    .max(5000, 'settings.support.report_bug.description_too_long'),
  category: z.enum(['crash', 'ui', 'sync', 'performance', 'other']),
  includeDiagnostics: z.boolean().default(true),
});

type BugReportFormData = z.infer<typeof bugReportSchema>;

// eslint-disable-next-line max-lines-per-function -- Complex form screen
export default function ReportBugScreen() {
  const router = useRouter();
  const user = useAuth.use.user();
  const { isInternetReachable } = useNetworkStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<BugDiagnostics | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'other',
      includeDiagnostics: true,
    },
  });

  const includeDiagnostics = watch('includeDiagnostics');

  // Collect diagnostics on mount
  useEffect(() => {
    void (async () => {
      const collected = await collectDiagnostics();
      collected.networkStatus = isInternetReachable ? 'online' : 'offline';
      setDiagnostics(collected);
    })();
  }, [isInternetReachable]);

  const onSubmit = async (data: BugReportFormData) => {
    if (!diagnostics) {
      Alert.alert(
        translate('settings.support.report_bug.error_title'),
        translate('settings.support.report_bug.diagnostics_not_ready')
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare diagnostics based on user consent
      const preparedDiagnostics = prepareDiagnosticsForSubmission(
        diagnostics,
        data.includeDiagnostics
      );

      // Redact secrets from description
      const sanitizedDescription = redactSecrets(data.description);

      const bugReport = {
        title: data.title,
        description: sanitizedDescription,
        category: data.category,
        diagnostics: preparedDiagnostics as BugDiagnostics,
        userId: user?.id,
      };

      const result = await submitBugReport(bugReport);

      if (result.success) {
        Alert.alert(
          translate('settings.support.report_bug.success_title'),
          translate('settings.support.report_bug.success_message', {
            ticketId:
              result.ticketId ||
              translate('settings.support.report_bug.ticket_id_fallback'),
          }),
          [
            {
              text: translate('common.ok'),
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      Alert.alert(
        translate('settings.support.report_bug.error_title'),
        translate('settings.support.report_bug.error_message')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
        >
          <View className="flex-1 px-4 pb-8 pt-4">
            <Text className="mb-1 text-xl font-bold">
              {translate('settings.support.report_bug.title')}
            </Text>
            <Text className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
              {translate('settings.support.report_bug.description')}
            </Text>

            {/* Title */}
            <View className="mb-4">
              <ControlledInput
                control={control}
                name="title"
                label={translate('settings.support.report_bug.title_label')}
                placeholder={translate(
                  'settings.support.report_bug.title_placeholder'
                )}
                error={errors.title?.message}
                accessibilityLabel={translate(
                  'settings.support.report_bug.title_label'
                )}
                accessibilityHint={translate(
                  'settings.support.report_bug.title_hint'
                )}
              />
            </View>

            {/* Category */}
            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-charcoal-900 dark:text-neutral-100">
                {translate('settings.support.report_bug.category_label')}
              </Text>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <Select
                    value={value}
                    onSelect={(selectedValue) => onChange(selectedValue)}
                    options={[
                      {
                        label: translate(
                          'settings.support.report_bug.category.crash'
                        ),
                        value: 'crash',
                      },
                      {
                        label: translate(
                          'settings.support.report_bug.category.ui'
                        ),
                        value: 'ui',
                      },
                      {
                        label: translate(
                          'settings.support.report_bug.category.sync'
                        ),
                        value: 'sync',
                      },
                      {
                        label: translate(
                          'settings.support.report_bug.category.performance'
                        ),
                        value: 'performance',
                      },
                      {
                        label: translate(
                          'settings.support.report_bug.category.other'
                        ),
                        value: 'other',
                      },
                    ]}
                    placeholder={translate(
                      'settings.support.report_bug.category_placeholder'
                    )}
                  />
                )}
              />
            </View>

            {/* Description */}
            <View className="mb-4">
              <ControlledInput
                control={control}
                name="description"
                label={translate(
                  'settings.support.report_bug.description_label'
                )}
                placeholder={translate(
                  'settings.support.report_bug.description_placeholder'
                )}
                multiline
                numberOfLines={6}
                error={errors.description?.message}
                accessibilityLabel={translate(
                  'settings.support.report_bug.description_label'
                )}
                accessibilityHint={translate(
                  'settings.support.report_bug.description_hint'
                )}
              />
            </View>

            {/* Include Diagnostics Toggle */}
            <View className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {translate('settings.support.report_bug.include_diagnostics')}
                </Text>
                <Controller
                  control={control}
                  name="includeDiagnostics"
                  render={({ field: { onChange, value } }) => (
                    <Button
                      label={
                        value ? translate('common.on') : translate('common.off')
                      }
                      onPress={() => onChange(!value)}
                      variant={value ? 'default' : 'outline'}
                      size="sm"
                    />
                  )}
                />
              </View>
              <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                {translate(
                  'settings.support.report_bug.diagnostics_description'
                )}
              </Text>

              {/* Show diagnostics preview */}
              {includeDiagnostics && diagnostics && (
                <View className="mt-3 rounded border border-neutral-200 bg-white p-2 dark:border-white/10 dark:bg-charcoal-900">
                  <Text className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {`App: ${diagnostics.appVersion}\nBuild: ${diagnostics.buildNumber}\nDevice: ${diagnostics.deviceModel}\nOS: ${diagnostics.osVersion}\nLocale: ${diagnostics.locale}\nStorage: ${diagnostics.freeStorage}MB\nNetwork: ${diagnostics.networkStatus}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Offline Warning */}
            {!isInternetReachable && (
              <View className="mb-4 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
                <Text className="text-sm text-warning-700 dark:text-warning-300">
                  {translate('settings.support.report_bug.offline_warning')}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Button
              label={translate('settings.support.report_bug.submit')}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
