import React from 'react';
import { Pressable, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { translate, translateDynamic } from '@/lib/i18n/utils';
import type { DiagnosticResult } from '@/lib/nutrient-engine/types';
import { navigateToSecondOpinion } from '@/lib/nutrient-engine/utils/community-navigation';

type Props = {
  result: DiagnosticResult;
  onFeedback: (diagnosticId: string, helpful: boolean) => void;
  testID?: string;
};

export function DiagnosticResultCard({
  result,
  onFeedback,
  testID = 'diagnostic-result-card',
}: Props): React.ReactElement {
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);

  const handleFeedback = React.useCallback(
    (helpful: boolean) => {
      onFeedback(result.id, helpful);
      setFeedbackSubmitted(true);
    },
    [result.id, onFeedback]
  );

  const handleSecondOpinion = React.useCallback(() => {
    navigateToSecondOpinion(result);
  }, [result]);

  const confidencePercent = Math.round(result.confidence * 100);
  const confidenceColor = getConfidenceColor(result.confidence);

  return (
    <View
      className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900"
      testID={testID}
    >
      <ClassificationHeader
        result={result}
        confidencePercent={confidencePercent}
        confidenceColor={confidenceColor}
      />

      <ConfidenceBreakdown result={result} />

      {result.rationale && result.rationale.length > 0 && (
        <RationaleSection rationale={result.rationale} />
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <RecommendationsSection recommendations={result.recommendations} />
      )}

      {result.disclaimerKeys && result.disclaimerKeys.length > 0 && (
        <DisclaimersSection disclaimerKeys={result.disclaimerKeys} />
      )}

      {result.needsSecondOpinion && (
        <SecondOpinionCTA
          onPress={handleSecondOpinion}
          testID={`${testID}-second-opinion-cta`}
        />
      )}

      {!feedbackSubmitted && (
        <FeedbackButtons
          onFeedback={handleFeedback}
          testID={`${testID}-feedback`}
        />
      )}

      {feedbackSubmitted && (
        <Text className="mt-3 text-center text-sm text-success-700 dark:text-success-400">
          {translate('nutrient.diagnostics.feedbackThanks')}
        </Text>
      )}
    </View>
  );
}

function ClassificationHeader({
  result,
  confidencePercent,
  confidenceColor,
}: {
  result: DiagnosticResult;
  confidencePercent: number;
  confidenceColor: string;
}): React.ReactElement {
  const issueTypeKey = `nutrient.diagnostics.issueTypes.${result.classification.type}`;
  const severityKey = `nutrient.diagnostics.severity.${result.classification.severity}`;

  return (
    <View className="mb-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xl font-semibold text-charcoal-900 dark:text-neutral-100">
          {translateDynamic(issueTypeKey)}
        </Text>
        <View
          className={`rounded-full px-3 py-1 ${confidenceColor}`}
          testID="confidence-badge"
        >
          <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {confidencePercent}%
          </Text>
        </View>
      </View>

      {result.nutrientCode && (
        <Text className="mb-1 text-base font-medium text-neutral-600 dark:text-neutral-400">
          {translate('nutrient.diagnostics.nutrient')}: {result.nutrientCode}
        </Text>
      )}

      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {translateDynamic(severityKey)}
      </Text>

      <SourceBadge source={result.confidenceSource} />
    </View>
  );
}

function ConfidenceBreakdown({
  result,
}: {
  result: DiagnosticResult;
}): React.ReactElement | null {
  if (!result.confidenceBreakdown) {
    return null;
  }

  const { rules, ai, threshold } = result.confidenceBreakdown;

  if (rules === undefined && ai === undefined) {
    return null;
  }

  return (
    <View className="mb-3 rounded-lg bg-white p-3 dark:bg-charcoal-900">
      <Text className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {translate('nutrient.diagnostics.confidenceBreakdown')}
      </Text>
      {rules !== undefined && (
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {translate('nutrient.diagnostics.rulesConfidence')}:{' '}
          {Math.round(rules * 100)}%
        </Text>
      )}
      {ai !== undefined && (
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {translate('nutrient.diagnostics.aiConfidence')}:{' '}
          {Math.round(ai * 100)}%
        </Text>
      )}
      <Text className="text-xs text-neutral-500 dark:text-neutral-400">
        {translate('nutrient.diagnostics.threshold')}:{' '}
        {Math.round(threshold * 100)}%
      </Text>
    </View>
  );
}

function SourceBadge({
  source,
}: {
  source: DiagnosticResult['confidenceSource'];
}): React.ReactElement {
  const badgeConfig = {
    rules: { color: 'bg-primary-100 dark:bg-primary-900', label: 'Rules' },
    ai: { color: 'bg-purple-100 dark:bg-purple-900', label: 'AI' },
    hybrid: { color: 'bg-orange-100 dark:bg-orange-900', label: 'Hybrid' },
  };

  const config = badgeConfig[source];

  return (
    <View className={`mt-2 self-start rounded px-2 py-1 ${config.color}`}>
      <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {config.label}
      </Text>
    </View>
  );
}

function RationaleSection({
  rationale,
}: {
  rationale: string[];
}): React.ReactElement {
  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
        {translate('nutrient.diagnostics.rationale.title')}
      </Text>
      {rationale.map((item, index) => (
        <Text
          key={index}
          className="mb-1 text-sm text-neutral-500 dark:text-neutral-400"
        >
          • {translateDynamic(item)}
        </Text>
      ))}
    </View>
  );
}

function RecommendationsSection({
  recommendations,
}: {
  recommendations: DiagnosticResult['recommendations'];
}): React.ReactElement {
  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
        {translate('nutrient.diagnostics.recommendations.title')}
      </Text>
      {recommendations.map((rec, index) => (
        <View
          key={index}
          className="mb-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-charcoal-900"
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {translateDynamic(rec.description)}
            </Text>
            {rec.context?.source && (
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {rec.context.source}
              </Text>
            )}
          </View>
          {rec.priority === 1 && (
            <Text className="text-xs font-medium text-danger-600 dark:text-danger-400">
              {translate('nutrient.diagnostics.priorityHigh')}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function DisclaimersSection({
  disclaimerKeys,
}: {
  disclaimerKeys: string[];
}): React.ReactElement {
  return (
    <View className="dark:bg-warning-950 mb-3 rounded-lg border border-warning-300 bg-warning-50 p-3 dark:border-warning-800">
      <Text className="mb-2 text-sm font-semibold text-warning-800 dark:text-warning-200">
        ⚠️ {translate('nutrient.diagnostics.disclaimers.title')}
      </Text>
      {disclaimerKeys.map((key, index) => (
        <Text
          key={index}
          className="mb-1 text-sm text-warning-700 dark:text-warning-300"
        >
          • {translateDynamic(key)}
        </Text>
      ))}
    </View>
  );
}

function SecondOpinionCTA({
  onPress,
  testID,
}: {
  onPress: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Button
      label={translate('nutrient.diagnostics.getSecondOpinion')}
      onPress={onPress}
      variant="outline"
      className="mb-3"
      testID={testID}
    />
  );
}

function FeedbackButtons({
  onFeedback,
  testID,
}: {
  onFeedback: (helpful: boolean) => void;
  testID: string;
}): React.ReactElement {
  return (
    <View className="mt-3">
      <Text className="mb-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {translate('nutrient.diagnostics.feedbackQuestion')}
      </Text>
      <View className="flex-row justify-center gap-3">
        <Pressable
          onPress={() => onFeedback(true)}
          className="rounded-lg bg-success-100 px-4 py-2 dark:bg-success-900"
          accessibilityRole="button"
          accessibilityLabel={translate('nutrient.diagnostics.helpful')}
          accessibilityHint="Mark this diagnostic result as helpful"
          testID={`${testID}-helpful`}
        >
          <Text className="font-medium text-success-800 dark:text-success-200">
            👍 {translate('nutrient.diagnostics.helpful')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onFeedback(false)}
          className="rounded-lg bg-danger-100 px-4 py-2 dark:bg-danger-900"
          accessibilityRole="button"
          accessibilityLabel={translate('nutrient.diagnostics.notHelpful')}
          accessibilityHint="Mark this diagnostic result as not helpful"
          testID={`${testID}-not-helpful`}
        >
          <Text className="font-medium text-danger-800 dark:text-danger-200">
            👎 {translate('nutrient.diagnostics.notHelpful')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) {
    return 'bg-success-200 dark:bg-success-800';
  }
  if (confidence >= 0.7) {
    return 'bg-warning-200 dark:bg-warning-800';
  }
  return 'bg-danger-200 dark:bg-danger-800';
}
