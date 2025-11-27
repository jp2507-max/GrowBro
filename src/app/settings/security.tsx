import type { AuthMFAEnrollTOTPResponse } from '@supabase/auth-js';
import type { UseMutationResult } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert } from 'react-native';

import {
  useMfaChallengeAndVerify,
  useMfaEnrollTotp,
  useMfaFactors,
  useMfaUnenroll,
} from '@/api/auth';
import {
  ChangePasswordModal,
  useChangePasswordModal,
} from '@/components/auth/change-password-modal';
import { BiometricToggleSection } from '@/components/settings/biometric-toggle-section';
import { DangerZoneWarning } from '@/components/settings/danger-zone-warning';
import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { MfaSetupModal } from '@/components/settings/mfa-setup-modal';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Lock, Shield, Trash } from '@/components/ui/icons';
import { translate } from '@/lib';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type PendingMfaEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
  friendlyName: string | null;
};

/**
 * Custom hook to handle MFA enrollment and verification logic
 */
function useMfaHandlers({
  enrollTotp,
  verifyTotp,
  unenrollTotp,
  refetchMfaFactors,
  activeFactor,
}: {
  enrollTotp: ReturnType<typeof useMfaEnrollTotp>;
  verifyTotp: ReturnType<typeof useMfaChallengeAndVerify>;
  unenrollTotp: ReturnType<typeof useMfaUnenroll>;
  refetchMfaFactors: () => void;
  activeFactor: { id: string } | undefined;
}) {
  const [mfaModalVisible, setMfaModalVisible] = React.useState(false);
  const [pendingEnrollment, setPendingEnrollment] =
    React.useState<PendingMfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = React.useState('');

  const handleStartEnableMfa = async () => {
    try {
      const enrollment = await enrollTotp.mutateAsync({
        friendlyName: translate('auth.security.primary_mfa_label'),
      });
      setPendingEnrollment({
        factorId: enrollment.id,
        secret: enrollment.totp.secret,
        uri: enrollment.totp.uri,
        friendlyName: enrollment.friendly_name ?? null,
      });
      setVerificationCode('');
      setMfaModalVisible(true);
    } catch (error) {
      Alert.alert(
        translate('common.error'),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleVerifyMfa = async () => {
    if (!pendingEnrollment) return;
    const code = verificationCode.trim();
    if (code.length < 6) {
      Alert.alert(
        translate('common.error'),
        translate('auth.security.mfa_code_required')
      );
      return;
    }
    try {
      await verifyTotp.mutateAsync({
        factorId: pendingEnrollment.factorId,
        code,
      });
      const sessionResponse = await supabase.auth.getSession();
      if (sessionResponse.data.session) {
        const { updateSession } = useAuth.getState();
        updateSession(sessionResponse.data.session);
      }
      await refetchMfaFactors();
      setPendingEnrollment(null);
      setVerificationCode('');
      setMfaModalVisible(false);
      Alert.alert(
        translate('auth.security.mfa_verification_success'),
        undefined
      );
    } catch (error) {
      Alert.alert(
        translate('common.error'),
        error instanceof Error
          ? error.message
          : translate('auth.security.mfa_verification_error')
      );
    }
  };

  const handleDisableMfa = () => {
    if (!activeFactor) return;
    Alert.alert(
      translate('auth.security.mfa_disable_confirm_title'),
      translate('auth.security.mfa_disable_confirm_message'),
      [
        {
          text: translate('common.cancel'),
          style: 'cancel',
        },
        {
          text: translate('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unenrollTotp.mutateAsync({ factorId: activeFactor.id });
              await refetchMfaFactors();
              Alert.alert(
                translate('auth.security.mfa_disabled_toast'),
                undefined
              );
            } catch (error) {
              Alert.alert(
                translate('common.error'),
                error instanceof Error ? error.message : String(error)
              );
            }
          },
        },
      ]
    );
  };

  const handleCloseMfaModal = () => {
    setMfaModalVisible(false);
    setPendingEnrollment(null);
    setVerificationCode('');
  };

  return {
    mfaModalVisible,
    pendingEnrollment,
    verificationCode,
    setVerificationCode,
    handleStartEnableMfa,
    handleVerifyMfa,
    handleDisableMfa,
    handleCloseMfaModal,
  };
}

type MfaSectionProps = {
  isMfaEnabled: boolean;
  isMfaLoading: boolean;
  enrollTotp: UseMutationResult<
    NonNullable<AuthMFAEnrollTOTPResponse['data']>,
    Error,
    { friendlyName?: string },
    unknown
  >;
  unenrollTotp: UseMutationResult<
    { id: string },
    Error,
    { factorId: string },
    unknown
  >;
  onStartEnableMfa: () => void;
  onDisableMfa: () => void;
  testID?: string;
};

function MfaSection({
  isMfaEnabled,
  isMfaLoading,
  enrollTotp,
  unenrollTotp,
  onStartEnableMfa,
  onDisableMfa,
  testID,
}: MfaSectionProps) {
  return (
    <ItemsContainer title="auth.security.mfa_section" testID={testID}>
      <Item
        text="auth.security.two_factor_auth"
        value={translate(
          isMfaEnabled
            ? 'auth.security.mfa_status_enabled'
            : 'auth.security.mfa_status_disabled'
        )}
        icon={<Shield />}
        testID="two-factor-item"
        description={
          isMfaEnabled
            ? translate('auth.security.mfa_enabled_hint')
            : translate('auth.security.mfa_disabled_hint')
        }
      />
      {isMfaEnabled ? (
        <Button
          variant="outline"
          label={translate('auth.security.disable_mfa')}
          onPress={onDisableMfa}
          disabled={unenrollTotp.isPending}
          loading={unenrollTotp.isPending}
          testID="disable-mfa-button"
        />
      ) : (
        <Button
          label={translate('auth.security.enable_mfa')}
          onPress={onStartEnableMfa}
          disabled={enrollTotp.isPending || isMfaLoading}
          loading={enrollTotp.isPending}
          testID="enable-mfa-button"
        />
      )}
    </ItemsContainer>
  );
}

type DangerZoneSectionProps = {
  testID?: string;
};

function DangerZoneSection({ testID }: DangerZoneSectionProps) {
  const router = useRouter();

  const handleDeleteAccount = () => {
    // Navigate to dedicated delete account screen
    router.push('/settings/delete-account');
  };

  return (
    <ItemsContainer title="auth.security.danger_zone" testID={testID}>
      <Item
        text="auth.security.delete_account"
        icon={<Trash />}
        onPress={handleDeleteAccount}
        testID="delete-account-item"
      />
    </ItemsContainer>
  );
}

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { ref: changePasswordModalRef, present: presentChangePasswordModal } =
    useChangePasswordModal();
  const {
    data: mfaFactors,
    isLoading: isMfaLoading,
    refetch: refetchMfaFactors,
  } = useMfaFactors();
  const enrollTotp = useMfaEnrollTotp();
  const verifyTotp = useMfaChallengeAndVerify();
  const unenrollTotp = useMfaUnenroll();

  const allFactors = mfaFactors?.all ?? [];
  const totpFactors = allFactors.filter(
    (factor) => factor.factor_type === 'totp'
  );
  const activeFactor = totpFactors[0];
  const isMfaEnabled = totpFactors.length > 0;

  const {
    mfaModalVisible,
    pendingEnrollment,
    verificationCode,
    setVerificationCode,
    handleStartEnableMfa,
    handleVerifyMfa,
    handleDisableMfa,
    handleCloseMfaModal,
  } = useMfaHandlers({
    enrollTotp,
    verifyTotp,
    unenrollTotp,
    refetchMfaFactors,
    activeFactor,
  });

  const handleChangePassword = () => {
    presentChangePasswordModal();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: translate('auth.security.title'),
          headerBackTitle: translate('common.back'),
        }}
      />
      <FocusAwareStatusBar />

      <ScrollView className="flex-1 bg-white dark:bg-charcoal-950">
        <View className="px-4 py-6">
          <Text className="mb-2 text-xl font-bold">
            {translate('auth.security.title')}
          </Text>
          <Text className="mb-4 text-neutral-600 dark:text-neutral-400">
            {translate('auth.security.description')}
          </Text>

          {/* Password Section */}
          <ItemsContainer title="auth.security.password_section">
            <Item
              text="auth.security.change_password"
              icon={<Lock />}
              onPress={handleChangePassword}
              testID="change-password-item"
            />
          </ItemsContainer>

          {/* Biometric Section */}
          <BiometricToggleSection />

          {/* MFA Section */}
          <MfaSection
            isMfaEnabled={isMfaEnabled}
            isMfaLoading={isMfaLoading}
            enrollTotp={enrollTotp}
            unenrollTotp={unenrollTotp}
            onStartEnableMfa={handleStartEnableMfa}
            onDisableMfa={handleDisableMfa}
            testID="mfa-section"
          />

          {/* Active Sessions Section */}
          <ItemsContainer title="auth.security.sessions_section">
            <Item
              text="auth.security.active_sessions"
              onPress={() => router.push('/settings/active-sessions')}
              testID="active-sessions-item"
            />
          </ItemsContainer>

          {/* Danger Zone */}
          <DangerZoneSection testID="danger-zone-section" />

          <DangerZoneWarning />
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <ChangePasswordModal ref={changePasswordModalRef} />

      <MfaSetupModal
        visible={mfaModalVisible}
        pendingEnrollment={pendingEnrollment}
        verificationCode={verificationCode}
        onVerificationCodeChange={setVerificationCode}
        onVerify={handleVerifyMfa}
        onClose={handleCloseMfaModal}
        isVerifying={verifyTotp.isPending}
      />
    </>
  );
}
