/**
 * Change Password Modal
 *
 * Modal for changing user password with current password verification,
 * strength validation, and confirmation.
 */

import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useChangePassword } from '@/api/auth';
import { validatePassword } from '@/api/auth/use-sign-up';
import { Button, ControlledInput, Modal, Text, View } from '@/components/ui';
import {
  showErrorMessage,
  showSuccessMessage,
  translate,
  translateDynamic,
} from '@/lib';

// Password validation schema matching sign-up requirements
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'auth.error.current_password_required'),
    newPassword: z
      .string()
      .min(8, 'auth.error.password_too_short')
      .refine(
        (password) => validatePassword(password).isValid,
        (password) => ({
          message:
            validatePassword(password).errors[0] || 'auth.error.password_weak',
        })
      ),
    confirmPassword: z.string().min(1, 'auth.error.confirm_password_required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'auth.error.passwords_dont_match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'auth.error.new_password_same_as_current',
    path: ['newPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export interface ChangePasswordModalProps {
  onSuccess?: () => void;
}

export const ChangePasswordModal = React.forwardRef<
  BottomSheetModal,
  ChangePasswordModalProps
>(({ onSuccess }, ref) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const changePasswordMutation = useChangePassword({
    onSuccess: () => {
      showSuccessMessage(translate('auth.security.password_changed_success'));
      reset();
      if (ref && 'current' in ref && ref.current) {
        ref.current.dismiss();
      }
      onSuccess?.();
    },
    onError: (error) => {
      const translatedError = translateDynamic(error.message);
      const fallback = translate('auth.security.password_change_error');
      showErrorMessage(translatedError ?? fallback);
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const handleDismiss = () => {
    reset();
  };

  return (
    <Modal
      ref={ref}
      title={translate('auth.security.change_password')}
      snapPoints={['85%']}
      onDismiss={handleDismiss}
    >
      <View className="flex-1 px-4">
        <Text className="mb-6 text-neutral-600 dark:text-neutral-400">
          {translate('auth.security.change_password_description')}
        </Text>

        {/* Current Password */}
        <ControlledInput
          control={control}
          name="currentPassword"
          label={translate('auth.security.current_password')}
          placeholder={translate('auth.security.current_password_placeholder')}
          error={errors.currentPassword?.message}
          secureTextEntry
          autoComplete="current-password"
          testID="current-password-input"
        />

        {/* New Password */}
        <ControlledInput
          control={control}
          name="newPassword"
          label={translate('auth.security.new_password')}
          placeholder={translate('auth.security.new_password_placeholder')}
          error={errors.newPassword?.message}
          secureTextEntry
          autoComplete="new-password"
          testID="new-password-input"
        />

        {/* Confirm Password */}
        <ControlledInput
          control={control}
          name="confirmPassword"
          label={translate('auth.security.confirm_new_password')}
          placeholder={translate(
            'auth.security.confirm_new_password_placeholder'
          )}
          error={errors.confirmPassword?.message}
          secureTextEntry
          autoComplete="new-password"
          testID="confirm-password-input"
        />

        {/* Password Requirements */}
        <View className="mb-6 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {translate('auth.password_requirements')}
          </Text>
        </View>

        {/* Submit Button */}
        <Button
          label={translate('auth.security.change_password')}
          onPress={handleSubmit(onSubmit)}
          loading={changePasswordMutation.isPending}
          disabled={changePasswordMutation.isPending}
          testID="change-password-submit"
        />

        {/* Warning */}
        <View className="mt-4 rounded-lg bg-warning-100 p-3 dark:bg-warning-900">
          <Text className="text-xs text-warning-900 dark:text-warning-100">
            Changing your password will sign you out of all other devices.
          </Text>
        </View>
      </View>
    </Modal>
  );
});

ChangePasswordModal.displayName = 'ChangePasswordModal';

/**
 * Hook to easily use the ChangePasswordModal
 */
export const useChangePasswordModal = () => {
  const ref = React.useRef<BottomSheetModal>(null);

  const present = React.useCallback(() => {
    ref.current?.present();
  }, []);

  const dismiss = React.useCallback(() => {
    ref.current?.dismiss();
  }, []);

  return {
    ref,
    present,
    dismiss,
  };
};
