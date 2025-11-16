/**
 * Re-authentication Modal
 *
 * Prompts user to re-enter password for sensitive operations
 * like account deletion. Validates credentials before allowing
 * the operation to proceed.
 *
 * Requirements:
 * - 10.3: Re-authentication required before account deletion
 */

import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

import { Button, ControlledInput, Text, View } from '../ui';
import { Modal, useModal } from '../ui/modal';

const schema = z.object({
  password: z.string().min(1, 'auth.validation_password_required'),
});

type ReAuthFormData = z.infer<typeof schema>;

export type ReAuthModalProps = {
  onSuccess: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
};

export const ReAuthModal = React.forwardRef<BottomSheetModal, ReAuthModalProps>(
  ({ onSuccess, onCancel, title, description }, ref) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { dismiss } = useModal();
    const [isVerifying, setIsVerifying] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const { handleSubmit, control, reset } = useForm<ReAuthFormData>({
      resolver: zodResolver(schema),
    });

    const onSubmit: SubmitHandler<ReAuthFormData> = async (data) => {
      if (!user?.email) {
        setError(t('auth.error_no_user'));
        return;
      }

      setIsVerifying(true);
      setError(null);

      try {
        // Verify password by attempting sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: data.password,
        });

        if (signInError) {
          setError(t('auth.error_invalid_password'));
          setIsVerifying(false);
          return;
        }

        // Success - dismiss modal and trigger callback
        reset();
        dismiss();
        onSuccess();
      } catch (err) {
        console.error('Re-authentication error:', err);
        setError(t('auth.error_generic'));
        setIsVerifying(false);
      }
    };

    const handleCancel = () => {
      reset();
      setError(null);
      dismiss();
      onCancel?.();
    };

    return (
      <Modal
        ref={ref}
        snapPoints={['50%']}
        title={title || t('auth.re_auth_title')}
        enableDismissOnClose
      >
        <View className="flex-1 px-4 pb-4">
          <Text className="mb-4 text-neutral-600 dark:text-neutral-400">
            {description || t('auth.re_auth_description')}
          </Text>

          <ControlledInput
            testID="re-auth-password-input"
            control={control}
            name="password"
            label={t('auth.password_label')}
            placeholder={t('auth.password_placeholder')}
            secureTextEntry
            autoFocus
            onSubmitEditing={handleSubmit(onSubmit)}
          />

          {error && (
            <View className="mt-2 rounded-lg bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-sm text-danger-900 dark:text-danger-100">
                {error}
              </Text>
            </View>
          )}

          <View className="mt-6 flex-row gap-3">
            <Button
              testID="re-auth-cancel-button"
              label={t('common.cancel')}
              variant="outline"
              onPress={handleCancel}
              className="flex-1"
            />
            <Button
              testID="re-auth-confirm-button"
              label={t('common.confirm')}
              onPress={handleSubmit(onSubmit)}
              loading={isVerifying}
              disabled={isVerifying}
              className="flex-1"
            />
          </View>
        </View>
      </Modal>
    );
  }
);

ReAuthModal.displayName = 'ReAuthModal';

export { useModal as useReAuthModal };
