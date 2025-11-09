import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, Modal } from 'react-native';

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
import {
  Button,
  FocusAwareStatusBar,
  Input,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Lock, Shield, Trash } from '@/components/ui/icons';
import { translate } from '@/lib';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { openLinkInBrowser } from '@/lib/utils';

type PendingMfaEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
  friendlyName?: string;
};

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
  const [mfaModalVisible, setMfaModalVisible] = React.useState(false);
  const [pendingEnrollment, setPendingEnrollment] =
    React.useState<PendingMfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = React.useState('');

  const totpFactors = mfaFactors?.totp ?? [];
  const activeFactor = totpFactors[0];
  const isMfaEnabled = totpFactors.length > 0;

  const handleChangePassword = () => {
    presentChangePasswordModal();
  };

  const handleDeleteAccount = () => {
    // Navigate to dedicated delete account screen
    router.push('/settings/delete-account');
  };

  const handleStartEnableMfa = async () => {
    try {
      const enrollment = await enrollTotp.mutateAsync({
        friendlyName: translate('auth.security.primary_mfa_label'),
      });
      setPendingEnrollment({
        factorId: enrollment.id,
        secret: enrollment.totp.secret,
        uri: enrollment.totp.uri,
        friendlyName: enrollment.friendly_name,
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
        translate('common.success'),
        translate('auth.security.mfa_verification_success')
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
                translate('common.success'),
                translate('auth.security.mfa_disabled_toast')
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
          <ItemsContainer title="auth.security.mfa_section">
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
                onPress={handleDisableMfa}
                disabled={unenrollTotp.isPending}
                loading={unenrollTotp.isPending}
                testID="disable-mfa-button"
              />
            ) : (
              <Button
                label={translate('auth.security.enable_mfa')}
                onPress={handleStartEnableMfa}
                disabled={enrollTotp.isPending || isMfaLoading}
                loading={enrollTotp.isPending}
                testID="enable-mfa-button"
              />
            )}
          </ItemsContainer>

          {/* Active Sessions Section */}
          <ItemsContainer title="auth.security.sessions_section">
            <Item
              text="auth.security.active_sessions"
              onPress={() => router.push('/settings/active-sessions')}
              testID="active-sessions-item"
            />
          </ItemsContainer>

          {/* Danger Zone */}
          <ItemsContainer title="auth.security.danger_zone">
            <Item
              text="auth.security.delete_account"
              icon={<Trash />}
              onPress={handleDeleteAccount}
              testID="delete-account-item"
            />
          </ItemsContainer>

          <DangerZoneWarning />
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <ChangePasswordModal ref={changePasswordModalRef} />

      <Modal
        visible={mfaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMfaModal}
      >
        <View className="flex-1 bg-black/60">
          <View className="flex-1 items-center justify-center px-4 py-10">
            <View className="w-full rounded-2xl bg-white p-5 dark:bg-charcoal-900">
              <Text className="mb-2 text-xl font-bold">
                {translate('auth.security.mfa_setup_title')}
              </Text>
              <Text className="mb-4 text-neutral-600 dark:text-neutral-300">
                {translate('auth.security.mfa_setup_description')}
              </Text>
              {pendingEnrollment ? (
                <>
                  <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                    {translate('auth.security.mfa_secret_label')}
                  </Text>
                  <View className="my-2 rounded-lg border border-dashed border-neutral-400 p-3">
                    <Text selectable className="font-mono text-lg">
                      {pendingEnrollment.secret}
                    </Text>
                  </View>
                  <Button
                    variant="outline"
                    label={translate('auth.security.mfa_open_authenticator')}
                    onPress={() => openLinkInBrowser(pendingEnrollment.uri)}
                    className="mt-2"
                  />
                </>
              ) : null}
              <Input
                className="mt-4"
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder={translate('auth.security.mfa_code_placeholder')}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                testID="mfa-code-input"
              />
              <View className="mt-6 flex-row gap-3">
                <Button
                  variant="outline"
                  label={translate('common.cancel')}
                  onPress={handleCloseMfaModal}
                  className="flex-1"
                />
                <Button
                  label={translate('common.confirm')}
                  onPress={handleVerifyMfa}
                  loading={verifyTotp.isPending}
                  className="flex-1"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
