/**
 * Trichome Helper Modal
 *
 * Educational trichome assessment and harvest timing guidance
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import {
  HarvestSuggestionCard,
  HarvestWindowList,
  TrichomeAssessmentForm,
  TrichomeGuideCard,
} from '@/components/trichome';
import { Button, Text } from '@/components/ui';
import { useTrichomeHelper } from '@/lib/trichome';
import type { TrichomeAssessment } from '@/types/playbook';

type TabType = 'guide' | 'assess' | 'windows';

function TabButton({
  label,
  active,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <Button
      label={label}
      variant={active ? 'default' : 'outline'}
      size="sm"
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    />
  );
}

function LatestAssessmentCard({
  assessment,
}: {
  assessment: TrichomeAssessment;
}) {
  const { t } = useTranslation();

  return (
    <View className="mt-4 rounded-lg bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-2 text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
        {t('trichome.helper.latestAssessmentTitle')}
      </Text>
      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        {new Date(assessment.createdAt).toLocaleDateString()}
      </Text>
      <View className="mt-2 flex-row justify-between">
        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
          {t('trichome.helper.clearLabelShort')} {assessment.clearPercent || 0}%
        </Text>
        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
          {t('trichome.helper.milkyLabelShort')} {assessment.milkyPercent || 0}%
        </Text>
        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
          {t('trichome.helper.amberLabelShort')} {assessment.amberPercent || 0}%
        </Text>
      </View>
    </View>
  );
}

function SuggestionsSection({
  suggestions,
  onAccept,
  onDecline,
}: {
  suggestions: any[];
  onAccept: (s: any) => Promise<void>;
  onDecline: (s: any) => void;
}) {
  const { t } = useTranslation();

  if (suggestions.length === 0) return null;

  return (
    <View className="mb-6">
      <Text className="mb-3 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
        {t('trichome.helper.harvestSuggestionsTitle')}
      </Text>
      {suggestions.map((suggestion, index) => (
        <HarvestSuggestionCard
          key={index}
          suggestion={suggestion}
          onAccept={() => onAccept(suggestion)}
          onDecline={() => onDecline(suggestion)}
          className="mb-3"
        />
      ))}
    </View>
  );
}

function useLoadAssessment(
  plantId: string | undefined,
  getLatestAssessment: any,
  suggestHarvestAdjustments: any
) {
  const [latestAssessment, setLatestAssessment] =
    React.useState<TrichomeAssessment | null>(null);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);

  const loadLatestAssessment = React.useCallback(async () => {
    if (!plantId) return;

    try {
      const assessment = await getLatestAssessment(plantId);
      setLatestAssessment(assessment);

      if (assessment) {
        const harvestSuggestions = await suggestHarvestAdjustments(assessment);
        setSuggestions(harvestSuggestions);
      }
    } catch (error) {
      console.error('Failed to load latest assessment:', error);
    }
  }, [plantId, getLatestAssessment, suggestHarvestAdjustments]);

  return {
    latestAssessment,
    setLatestAssessment,
    suggestions,
    setSuggestions,
    loadLatestAssessment,
  };
}

function useSubmitAssessment(options: {
  plantId: string | undefined;
  playbookId: string | undefined;
  logTrichomeCheck: any;
  suggestHarvestAdjustments: any;
  setLatestAssessment: any;
  setSuggestions: any;
}) {
  const [loading, setLoading] = React.useState(false);

  const handleSubmitAssessment = async (data: {
    clearPercent?: number;
    milkyPercent?: number;
    amberPercent?: number;
    notes?: string;
  }) => {
    if (!options.plantId) return null;

    setLoading(true);
    try {
      const assessment = await options.logTrichomeCheck(
        {
          plantId: options.plantId,
          assessmentDate: new Date().toISOString().split('T')[0],
          ...data,
        },
        options.playbookId
      );

      const harvestSuggestions =
        await options.suggestHarvestAdjustments(assessment);
      options.setSuggestions(harvestSuggestions);
      options.setLatestAssessment(assessment);

      return harvestSuggestions.length > 0;
    } catch (error) {
      console.error('Failed to log assessment:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { loading, handleSubmitAssessment };
}

function useTrichomeState(plantId?: string, playbookId?: string) {
  const {
    getAssessmentGuide,
    getHarvestWindows,
    logTrichomeCheck,
    suggestHarvestAdjustments,
    getLatestAssessment,
    acceptSuggestion,
  } = useTrichomeHelper();

  const {
    latestAssessment,
    setLatestAssessment,
    suggestions,
    setSuggestions,
    loadLatestAssessment,
  } = useLoadAssessment(
    plantId,
    getLatestAssessment,
    suggestHarvestAdjustments
  );

  const { loading, handleSubmitAssessment } = useSubmitAssessment({
    plantId,
    playbookId,
    logTrichomeCheck,
    suggestHarvestAdjustments,
    setLatestAssessment,
    setSuggestions,
  });

  const [guide, setGuide] = React.useState<any>(null);
  const [windows, setWindows] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (plantId) {
      loadLatestAssessment();
    }
  }, [plantId, loadLatestAssessment]);

  React.useEffect(() => {
    const assessmentGuide = getAssessmentGuide(playbookId);
    const harvestWindows = getHarvestWindows();
    setGuide(assessmentGuide);
    setWindows(harvestWindows);
  }, [playbookId, getAssessmentGuide, getHarvestWindows]);

  return {
    loading,
    latestAssessment,
    suggestions,
    setSuggestions,
    handleSubmitAssessment,
    acceptSuggestion,
    guide,
    windows,
  };
}

function ModalHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xl font-semibold text-charcoal-950 dark:text-neutral-100">
        {t('trichome.helper.header')}
      </Text>
      <Button
        label={t('trichome.helper.closeButton')}
        variant="ghost"
        size="sm"
        onPress={onClose}
        testID="close-button"
      />
    </View>
  );
}

function TabBar({
  activeTab,
  setActiveTab,
  hasPlantId,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  hasPlantId: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View className="mt-3 flex-row gap-2">
      <TabButton
        label={t('trichome.helper.guideTab')}
        active={activeTab === 'guide'}
        onPress={() => setActiveTab('guide')}
        testID="guide-tab"
      />
      <TabButton
        label={t('trichome.helper.assessTab')}
        active={activeTab === 'assess'}
        onPress={() => setActiveTab('assess')}
        disabled={!hasPlantId}
        testID="assess-tab"
      />
      <TabButton
        label={t('trichome.helper.windowsTab')}
        active={activeTab === 'windows'}
        onPress={() => setActiveTab('windows')}
        testID="windows-tab"
      />
    </View>
  );
}

function TabContent({
  activeTab,
  guide,
  onSubmit,
  loading,
  latestAssessment,
  suggestions,
  setSuggestions,
  onAccept,
  windows,
}: {
  activeTab: TabType;
  guide: any;
  onSubmit: (data: any) => void;
  loading: boolean;
  latestAssessment: TrichomeAssessment | null;
  suggestions: any[];
  setSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  onAccept: (suggestion: any) => Promise<void>;
  windows: any[];
}) {
  const { t } = useTranslation();

  if (activeTab === 'guide') {
    if (!guide) {
      return (
        <View className="rounded-lg bg-white p-4 dark:bg-charcoal-900">
          <Text className="text-center text-neutral-600 dark:text-neutral-400">
            {t('trichome.helper.loadingGuide')}
          </Text>
        </View>
      );
    }
    return <TrichomeGuideCard guide={guide} />;
  }

  if (activeTab === 'assess') {
    return (
      <View>
        <TrichomeAssessmentForm onSubmit={onSubmit} loading={loading} />
        {latestAssessment && (
          <LatestAssessmentCard assessment={latestAssessment} />
        )}
      </View>
    );
  }

  return (
    <View>
      <SuggestionsSection
        suggestions={suggestions}
        onAccept={onAccept}
        onDecline={(s) =>
          setSuggestions((prev) => prev.filter((item) => item !== s))
        }
      />
      <HarvestWindowList windows={windows} />
    </View>
  );
}

function useAcceptHandler(
  plantId: string | undefined,
  acceptSuggestionFn: any,
  setSuggestions: any
) {
  const { t } = useTranslation();

  const onAccept = async (suggestion: any) => {
    if (!plantId) return;

    const previousSuggestions = await new Promise<any>((resolve) => {
      setSuggestions((prev: any) => {
        resolve(prev);
        return prev.filter((item: any) => item !== suggestion);
      });
    });

    try {
      await acceptSuggestionFn(plantId, suggestion);
    } catch (error) {
      setSuggestions(previousSuggestions);
      showMessage({
        message: t('trichome.helper.failedToAcceptSuggestion'),
        description: t('trichome.helper.pleaseTryAgain'),
        type: 'danger',
      });
      console.error('Failed to accept harvest suggestion:', error);
    }
  };

  return onAccept;
}

export default function TrichomeHelperModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    plantId?: string;
    playbookId?: string;
  }>();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = React.useState<TabType>('guide');

  const {
    loading,
    latestAssessment,
    suggestions,
    setSuggestions,
    handleSubmitAssessment,
    acceptSuggestion: acceptSuggestionFn,
    guide,
    windows,
  } = useTrichomeState(params.plantId, params.playbookId);

  const onAccept = useAcceptHandler(
    params.plantId,
    acceptSuggestionFn,
    setSuggestions
  );

  const onSubmit = async (data: any) => {
    const hasSuggestions = await handleSubmitAssessment(data);
    if (hasSuggestions) {
      setActiveTab('windows');
    }
  };

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-charcoal-700 dark:bg-charcoal-900">
        <ModalHeader onClose={() => router.back()} />
        <TabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasPlantId={!!params.plantId}
        />
      </View>

      <ScrollView className="flex-1 p-4">
        <TabContent
          activeTab={activeTab}
          guide={guide}
          onSubmit={onSubmit}
          loading={loading}
          latestAssessment={latestAssessment}
          suggestions={suggestions}
          setSuggestions={setSuggestions}
          onAccept={onAccept}
          windows={windows}
        />
      </ScrollView>

      <View className="border-t border-neutral-200 bg-white px-4 py-3 dark:border-charcoal-700 dark:bg-charcoal-900">
        <Text className="text-center text-xs italic text-neutral-600 dark:text-neutral-400">
          {t('trichome.helper.footerDisclaimer')}
        </Text>
      </View>
    </View>
  );
}
