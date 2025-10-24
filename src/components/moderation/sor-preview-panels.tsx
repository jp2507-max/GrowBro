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
            ? 'moderation.sorPreview.validation.noPiiDetected'
            : 'moderation.sorPreview.validation.piiValidationFailed'
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
        label: t('moderation.sorPreview.fields.decisionGround'),
        value: userFacing.decision_ground,
      },
      {
        label: t('moderation.sorPreview.fields.legalReference'),
        value:
          userFacing.legal_reference ||
          t('moderation.sorPreview.fields.legalReferenceNA'),
      },
      {
        label: t('moderation.sorPreview.fields.contentType'),
        value: userFacing.content_type,
      },
      {
        label: t('moderation.sorPreview.fields.factsAndCircumstances'),
        value: userFacing.facts_and_circumstances,
        multiline: true,
      },
      {
        label: t('moderation.sorPreview.fields.automatedDetection'),
        value: userFacing.automated_detection
          ? t('moderation.sorPreview.fields.yes')
          : t('moderation.sorPreview.fields.no'),
      },
      {
        label: t('moderation.sorPreview.fields.automatedDecision'),
        value: userFacing.automated_decision
          ? t('moderation.sorPreview.fields.yes')
          : t('moderation.sorPreview.fields.no'),
      },
      {
        label: t('moderation.sorPreview.fields.territorialScope'),
        value:
          userFacing.territorial_scope?.join(', ') ||
          t('moderation.sorPreview.fields.territorialScopeGlobal'),
      },
      {
        label: t('moderation.sorPreview.fields.redressOptions'),
        value: userFacing.redress.join(', '),
      },
      {
        label: t('moderation.sorPreview.fields.createdAt'),
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
        label: t('moderation.sorPreview.fields.decisionGround'),
        value: redacted.decision_ground,
      },
      {
        label: t('moderation.sorPreview.fields.legalReference'),
        value:
          redacted.legal_reference ||
          t('moderation.sorPreview.fields.legalReferenceNA'),
      },
      {
        label: t('moderation.sorPreview.fields.contentType'),
        value: redacted.content_type,
      },
      {
        label: t('moderation.sorPreview.fields.automatedDetection'),
        value: redacted.automated_detection
          ? t('moderation.sorPreview.fields.yes')
          : t('moderation.sorPreview.fields.no'),
      },
      {
        label: t('moderation.sorPreview.fields.automatedDecision'),
        value: redacted.automated_decision
          ? t('moderation.sorPreview.fields.yes')
          : t('moderation.sorPreview.fields.no'),
      },
      {
        label: t('moderation.sorPreview.fields.territorialScope'),
        value:
          redacted.territorial_scope?.join(', ') ||
          t('moderation.sorPreview.fields.territorialScopeGlobal'),
      },
      {
        label: t('moderation.sorPreview.fields.redressOptions'),
        value: redacted.redress.join(', '),
      },
      {
        label: t('moderation.sorPreview.fields.pseudonymizedReporter'),
        value: redacted.pseudonymized_reporter_id,
        highlight: true,
      },
      {
        label: t('moderation.sorPreview.fields.pseudonymizedModerator'),
        value: redacted.pseudonymized_moderator_id,
        highlight: true,
      },
      {
        label: t('moderation.sorPreview.fields.aggregatedReportCount'),
        value:
          redacted.aggregated_data.report_count === 'suppressed'
            ? t('moderation.sorPreview.fields.aggregatedReportCountSuppressed')
            : String(redacted.aggregated_data.report_count),
        highlight: true,
      },
      {
        label: t('moderation.sorPreview.fields.evidenceType'),
        value: redacted.aggregated_data.evidence_type,
      },
      {
        label: t('moderation.sorPreview.fields.contentAge'),
        value: redacted.aggregated_data.content_age,
      },
      {
        label: t('moderation.sorPreview.fields.scrubbedAt'),
        value: formatDate(redacted.scrubbing_metadata.scrubbed_at),
      },
      {
        label: t('moderation.sorPreview.fields.scrubbingVersion'),
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
              tx="moderation.sorPreview.userFacingTitle"
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            />
            <Text
              tx="moderation.sorPreview.userFacingSubtitle"
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
              tx="moderation.sorPreview.redactedTitle"
              className="text-base font-semibold text-primary-900 dark:text-primary-100"
            />
            <Text
              tx="moderation.sorPreview.redactedSubtitle"
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
