import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ScrollView, Switch, Text, View } from '@/components/ui';
import type { LegalDocumentType } from '@/lib/compliance/legal-acceptances';
import {
  acceptAllLegalDocuments,
  getCurrentLegalVersions,
} from '@/lib/compliance/legal-acceptances';
import { translate } from '@/lib/i18n';
import type {
  LegalAcceptances,
  LegalConfirmationModalProps,
} from '@/types/settings';

type LegalDocumentSectionProps = {
  documentType: LegalDocumentType;
  title: string;
  summary: string;
  accepted: boolean;
  onChange: (value: boolean) => void;
};

function useLegalAcceptanceState() {
  const [acceptances, setAcceptances] = useState<LegalAcceptances>({
    termsOfService: false,
    privacyPolicy: false,
    cannabisPolicy: false,
  });

  const setTermsOfService = (value: boolean) =>
    setAcceptances((prev) => ({ ...prev, termsOfService: value }));
  const setPrivacyPolicy = (value: boolean) =>
    setAcceptances((prev) => ({ ...prev, privacyPolicy: value }));
  const setCannabisPolicy = (value: boolean) =>
    setAcceptances((prev) => ({ ...prev, cannabisPolicy: value }));

  const isAllAccepted =
    acceptances.termsOfService &&
    acceptances.privacyPolicy &&
    acceptances.cannabisPolicy;

  return {
    acceptances,
    setTermsOfService,
    setPrivacyPolicy,
    setCannabisPolicy,
    isAllAccepted,
  };
}

function LegalDocumentSection({
  documentType,
  title,
  summary,
  accepted,
  onChange,
}: LegalDocumentSectionProps): React.ReactElement {
  return (
    <View className="mb-6" testID={`legal-section-${documentType}`}>
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {title}
          </Text>
        </View>
        <Switch
          checked={accepted}
          onChange={onChange}
          onValueChange={onChange}
          testID={`legal-switch-${documentType}`}
          accessibilityLabel={title}
          accessibilityHint={translate('accessibility.common.toggle_hint')}
        />
      </View>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {summary}
      </Text>
    </View>
  );
}

function LegalConfirmationHeader(): React.ReactElement {
  return (
    <View className="mb-6">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
        {translate('cannabis.legal_confirmation_title')}
      </Text>
      <Text className="mt-2 text-base text-neutral-700 dark:text-neutral-300">
        {translate('cannabis.legal_confirmation_subtitle')}
      </Text>
    </View>
  );
}

function LegalConfirmationActions({
  onAccept,
  onDecline,
  isAcceptDisabled,
}: {
  onAccept: () => void;
  onDecline: () => void;
  isAcceptDisabled: boolean;
}): React.ReactElement {
  return (
    <View className="mt-6 gap-3">
      <Button
        label={translate('cannabis.legal_confirmation_accept_all')}
        onPress={onAccept}
        disabled={isAcceptDisabled}
        testID="legal-accept-btn"
      />
      <Button
        label={translate('cannabis.legal_confirmation_decline')}
        onPress={onDecline}
        testID="legal-decline-btn"
        variant="secondary"
      />
      {isAcceptDisabled && (
        <Text
          className="text-center text-sm text-danger-500"
          testID="legal-all-required-message"
        >
          {translate('cannabis.legal_confirmation_all_required')}
        </Text>
      )}
    </View>
  );
}

export function LegalConfirmationModal({
  isVisible,
  onAccept,
  onDecline,
}: LegalConfirmationModalProps): React.ReactElement | null {
  const {
    acceptances,
    setTermsOfService,
    setPrivacyPolicy,
    setCannabisPolicy,
    isAllAccepted,
  } = useLegalAcceptanceState();

  const handleAccept = React.useCallback(() => {
    if (!isAllAccepted) return;

    const versions = getCurrentLegalVersions();
    acceptAllLegalDocuments({
      terms: versions.terms.version,
      privacy: versions.privacy.version,
      cannabis: versions.cannabis.version,
    });

    onAccept(acceptances);
  }, [isAllAccepted, onAccept, acceptances]);

  if (!isVisible) return null;

  return (
    <View
      className="flex-1 bg-white dark:bg-neutral-900"
      testID="legal-confirmation-modal"
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View className="flex-1 px-6 py-10">
          <LegalConfirmationHeader />

          <LegalDocumentSection
            documentType="terms"
            title={translate('cannabis.legal_confirmation_terms_label')}
            summary={translate('cannabis.legal_confirmation_terms_summary')}
            accepted={acceptances.termsOfService}
            onChange={setTermsOfService}
          />

          <LegalDocumentSection
            documentType="privacy"
            title={translate('cannabis.legal_confirmation_privacy_label')}
            summary={translate('cannabis.legal_confirmation_privacy_summary')}
            accepted={acceptances.privacyPolicy}
            onChange={setPrivacyPolicy}
          />

          <LegalDocumentSection
            documentType="cannabis"
            title={translate('cannabis.legal_confirmation_cannabis_label')}
            summary={translate('cannabis.legal_confirmation_cannabis_summary')}
            accepted={acceptances.cannabisPolicy}
            onChange={setCannabisPolicy}
          />

          <LegalConfirmationActions
            onAccept={handleAccept}
            onDecline={onDecline}
            isAcceptDisabled={!isAllAccepted}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});

export default LegalConfirmationModal;
