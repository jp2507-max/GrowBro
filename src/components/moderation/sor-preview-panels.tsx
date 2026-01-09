/**
 * SoR Preview Panels Component
 * Side-by-side view of user-facing and redacted Statement of Reasons with diff highlighting
 * Requirements: 2.2, 3.3, 3.4, 6.4
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Text, View } from '@/components/ui';
import type { RedactedSoR, StatementOfReasons } from '@/types/moderation';

type Props = {
  userFacing: StatementOfReasons;
  redacted: RedactedSoR;
  validationStatus?: {
    no_pii_detected: boolean;
    errors: string[];
    warnings: string[];
  };
  testID?: string;
};

type FieldData = {
  label: string;
  value: string;
  multiline?: boolean;
  highlight?: boolean;
};

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ValidationBanner({
  validationStatus,
}: {
  validationStatus?: Props['validationStatus'];
}): React.ReactElement | null {
  if (!validationStatus) return null;

  return (
    <View
      className={`mb-4 rounded-lg p-3 ${
        validationStatus.no_pii_detected
          ? 'bg-success-100 dark:bg-success-900/20'
          : 'bg-danger-100 dark:bg-danger-900/20'
      }`}
    >
      <Text
        className={`mb-1 text-sm font-semibold ${
          validationStatus.no_pii_detected
            ? 'text-success-800 dark:text-success-200'
            : 'text-danger-800 dark:text-danger-200'
        }`}
        tx={
          validationStatus.no_pii_detected
            ? 'moderation.sor_preview.validation.no_pii_detected'
            : 'moderation.sor_preview.validation.pii_validation_failed'
        }
      />
      {validationStatus.errors.length > 0 && (
        <View className="mb-2">
          {validationStatus.errors.map((error, idx) => (
            <Text
              key={idx}
              className="text-xs text-danger-700 dark:text-danger-300"
            >
              • {error}
            </Text>
          ))}
        </View>
      )}
      {validationStatus.warnings.length > 0 && (
        <View>
          {validationStatus.warnings.map((warning, idx) => (
            <Text
              key={idx}
              className="text-xs text-warning-700 dark:text-warning-300"
            >
              ⚠ {warning}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SoRField({ item }: { item: FieldData }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View
      className={`mb-4 ${
        item.highlight
          ? 'rounded-md bg-warning-100 p-2 dark:bg-warning-900/20'
          : ''
      }`}
    >
      <Text
        className={`mb-1 text-xs font-medium ${
          item.highlight
            ? 'text-warning-700 dark:text-warning-300'
            : 'text-neutral-500 dark:text-neutral-400'
        }`}
      >
        {item.label}
        {item.highlight && ` ${t('moderation.transformed')}`}
      </Text>
      <Text
        className={`text-sm ${item.multiline ? 'leading-5' : ''} ${
          item.highlight
            ? 'font-medium text-warning-900 dark:text-warning-100'
            : 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {item.value}
      </Text>
    </View>
  );
}

function useUserFacingData(
  userFacing: StatementOfReasons,
  t: (key: string) => string
): FieldData[] {
  return useMemo(
    () => [
      {
        label: t('moderation.sor_preview.fields.decision_ground'),
        value: userFacing.decision_ground,
      },
      {
        label: t('moderation.sor_preview.fields.legal_reference'),
        value:
          userFacing.legal_reference ||
          t('moderation.sor_preview.fields.legal_reference_n_a'),
      },
      {
        label: t('moderation.sor_preview.fields.content_type'),
        value: userFacing.content_type,
      },
      {
        label: t('moderation.sor_preview.fields.facts_and_circumstances'),
        value: userFacing.facts_and_circumstances,
        multiline: true,
      },
      {
        label: t('moderation.sor_preview.fields.automated_detection'),
        value: userFacing.automated_detection
          ? t('moderation.sor_preview.fields.yes')
          : t('moderation.sor_preview.fields.no'),
      },
      {
        label: t('moderation.sor_preview.fields.automated_decision'),
        value: userFacing.automated_decision
          ? t('moderation.sor_preview.fields.yes')
          : t('moderation.sor_preview.fields.no'),
      },
      {
        label: t('moderation.sor_preview.fields.territorial_scope'),
        value:
          userFacing.territorial_scope?.join(', ') ||
          t('moderation.sor_preview.fields.territorial_scope_global'),
      },
      {
        label: t('moderation.sor_preview.fields.redress_options'),
        value: userFacing.redress.join(', '),
      },
      {
        label: t('moderation.sor_preview.fields.created_at'),
        value: formatDate(userFacing.created_at),
      },
    ],
    [userFacing, t]
  );
}

function useRedactedData(
  redacted: RedactedSoR,
  t: (key: string) => string
): FieldData[] {
  return useMemo(
    () => [
      {
        label: t('moderation.sor_preview.fields.decision_ground'),
        value: redacted.decision_ground,
      },
      {
        label: t('moderation.sor_preview.fields.legal_reference'),
        value:
          redacted.legal_reference ||
          t('moderation.sor_preview.fields.legal_reference_n_a'),
      },
      {
        label: t('moderation.sor_preview.fields.content_type'),
        value: redacted.content_type,
      },
      {
        label: t('moderation.sor_preview.fields.automated_detection'),
        value: redacted.automated_detection
          ? t('moderation.sor_preview.fields.yes')
          : t('moderation.sor_preview.fields.no'),
      },
      {
        label: t('moderation.sor_preview.fields.automated_decision'),
        value: redacted.automated_decision
          ? t('moderation.sor_preview.fields.yes')
          : t('moderation.sor_preview.fields.no'),
      },
      {
        label: t('moderation.sor_preview.fields.territorial_scope'),
        value:
          redacted.territorial_scope?.join(', ') ||
          t('moderation.sor_preview.fields.territorial_scope_global'),
      },
      {
        label: t('moderation.sor_preview.fields.redress_options'),
        value: redacted.redress.join(', '),
      },
      {
        label: t('moderation.sor_preview.fields.pseudonymized_reporter'),
        value: redacted.pseudonymized_reporter_id,
        highlight: true,
      },
      {
        label: t('moderation.sor_preview.fields.pseudonymized_moderator'),
        value: redacted.pseudonymized_moderator_id,
        highlight: true,
      },
      {
        label: t('moderation.sor_preview.fields.aggregated_report_count'),
        value:
          redacted.aggregated_data.report_count === 'suppressed'
            ? t(
                'moderation.sor_preview.fields.aggregated_report_count_suppressed'
              )
            : String(redacted.aggregated_data.report_count),
        highlight: true,
      },
      {
        label: t('moderation.sor_preview.fields.evidence_type'),
        value: redacted.aggregated_data.evidence_type,
      },
      {
        label: t('moderation.sor_preview.fields.content_age'),
        value: redacted.aggregated_data.content_age,
      },
      {
        label: t('moderation.sor_preview.fields.scrubbed_at'),
        value: formatDate(redacted.scrubbing_metadata.scrubbed_at),
      },
      {
        label: t('moderation.sor_preview.fields.scrubbing_version'),
        value: redacted.scrubbing_metadata.scrubbing_version,
      },
    ],
    [redacted, t]
  );
}

export function SoRPreviewPanels({
  userFacing,
  redacted,
  validationStatus,
  testID = 'sor-preview',
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const userFacingData = useUserFacingData(userFacing, t);
  const redactedData = useRedactedData(redacted, t);

  return (
    <View className="flex-1" testID={testID}>
      <ValidationBanner validationStatus={validationStatus} />

      {/* Side-by-side panels */}
      <View className="flex-1 flex-row gap-4">
        {/* User-Facing SoR Panel */}
        <View className="flex-1 rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-charcoal-800">
          <View className="border-b border-neutral-200 p-4 dark:border-neutral-700">
            <Text
              tx="moderation.sor_preview.user_facing_title"
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            />
            <Text
              tx="moderation.sor_preview.user_facing_subtitle"
              className="text-xs text-neutral-600 dark:text-neutral-400"
            />
          </View>
          <ScrollView className="flex-1 p-4">
            {userFacingData.map((item, idx) => (
              <SoRField key={idx} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* Redacted SoR Panel */}
        <View className="flex-1 rounded-xl border border-primary-200 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/10">
          <View className="border-b border-primary-200 p-4 dark:border-primary-700">
            <Text
              tx="moderation.sor_preview.redacted_title"
              className="text-base font-semibold text-primary-900 dark:text-primary-100"
            />
            <Text
              tx="moderation.sor_preview.redacted_subtitle"
              className="text-xs text-primary-700 dark:text-primary-300"
            />
          </View>
          <ScrollView className="flex-1 p-4">
            {redactedData.map((item, idx) => (
              <SoRField key={idx} item={item} />
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
