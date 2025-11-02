/**
 * Profile settings screen
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8, 9.9, 9.10, 10.1, 10.2, 10.3, 10.4
 *
 * Allows users to edit profile information, manage avatar, control visibility,
 * and view account statistics.
 *
 * eslint-disable-next-line max-lines-per-function -- Complex JSX-heavy screen component
 */

import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView } from 'react-native';
import { z } from 'zod';

import { AvatarPicker } from '@/components/settings/avatar-picker';
import {
  Button,
  ControlledInput,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { checkProfanity } from '@/lib/compliance/profanity-filter';
import { useProfileStatistics } from '@/lib/hooks/use-profile-statistics';
import type { AvatarUploadProgress } from '@/lib/media/avatar-upload';
import { uploadAvatar } from '@/lib/media/avatar-upload';
import { requestSelectedPhotos } from '@/lib/media/photo-access';
import {
  fetchProfileFromBackend,
  syncProfileToBackend,
} from '@/lib/sync/profile-sync';

// Form validation schema - Requirements: 9.2, 9.3
const profileSchema = z.object({
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(30, 'Display name must be at most 30 characters')
    .regex(
      /^[\p{L}\p{N}\s\-_]+$/u,
      'Only letters, numbers, spaces, hyphens, and underscores allowed (all languages)'
    ),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  location: z
    .string()
    .max(100, 'Location must be at most 100 characters')
    .optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
// Presentational subcomponents extracted to reduce main component length for ESLint
function AvatarSection({
  avatarUrl,
  avatarStatus,
  uploadProgress,
  onPress,
}: {
  avatarUrl: string | null;
  avatarStatus: 'idle' | 'uploading' | 'pending' | 'failed';
  uploadProgress: number;
  onPress: () => void;
}) {
  return (
    <AvatarPicker
      avatarUrl={avatarUrl}
      avatarStatus={avatarStatus}
      uploadProgress={uploadProgress}
      onPress={onPress}
    />
  );
}

function ProfileFormFields({
  control,
  errors,
  isProfileLoading,
  t,
  showProfileToCommunity,
  setShowProfileToCommunity,
  allowDirectMessages,
  setAllowDirectMessages,
}: {
  control: any;
  errors: any;
  isProfileLoading: boolean;
  t: any;
  showProfileToCommunity: boolean;
  setShowProfileToCommunity: (v: boolean) => void;
  allowDirectMessages: boolean;
  setAllowDirectMessages: (v: boolean) => void;
}) {
  if (isProfileLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator size="large" />
        <Text className="mt-2 text-neutral-600 dark:text-neutral-400">
          {t('profile.loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ControlledInput
        control={control}
        name="displayName"
        label={t('profile.displayName.label')}
        placeholder={t('profile.displayName.placeholder')}
        error={errors.displayName?.message}
        maxLength={30}
        testID="profile-display-name"
      />

      <ControlledInput
        control={control}
        name="bio"
        label={t('profile.bio.label')}
        placeholder={t('profile.bio.placeholder')}
        error={errors.bio?.message}
        maxLength={500}
        multiline
        numberOfLines={4}
        testID="profile-bio"
      />

      <ControlledInput
        control={control}
        name="location"
        label={t('profile.location.label')}
        placeholder={t('profile.location.placeholder')}
        error={errors.location?.message}
        maxLength={100}
        testID="profile-location"
      />

      <View className="my-4">
        <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {t('profile.privacy.title')}
        </Text>

        <Pressable
          accessibilityRole="button"
          className="mb-3 flex-row items-center justify-between rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"
          onPress={() => setShowProfileToCommunity(!showProfileToCommunity)}
        >
          <Text className="flex-1 text-neutral-900 dark:text-neutral-100">
            {t('profile.privacy.showProfile')}
          </Text>
          <View
            className={`size-6 rounded ${showProfileToCommunity ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}`}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className="flex-row items-center justify-between rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"
          onPress={() => setAllowDirectMessages(!allowDirectMessages)}
        >
          <Text className="flex-1 text-neutral-900 dark:text-neutral-100">
            {t('profile.privacy.allowDMs')}
          </Text>
          <View
            className={`size-6 rounded ${allowDirectMessages ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}`}
          />
        </Pressable>
      </View>
    </>
  );
}

function StatisticsPanel({
  statistics,
  navigateToPlants,
  navigateToHarvests,
  t,
}: {
  statistics: any;
  navigateToPlants: () => void;
  navigateToHarvests: () => void;
  t: any;
}) {
  return (
    <View className="my-4">
      <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {t('profile.statistics.title')}
      </Text>

      {statistics.isLoading ? (
        <ActivityIndicator />
      ) : (
        <View className="flex-row flex-wrap gap-3">
          <Pressable
            accessibilityRole="button"
            className="flex-1 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"
            onPress={navigateToPlants}
          >
            <Text className="text-2xl font-bold text-primary-600">
              {statistics.plantsCount}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('profile.statistics.plants')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="flex-1 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"
            onPress={navigateToHarvests}
          >
            <Text className="text-2xl font-bold text-primary-600">
              {statistics.harvestsCount}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('profile.statistics.harvests')}
            </Text>
          </Pressable>

          <View className="flex-1 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800">
            <Text className="text-2xl font-bold text-primary-600">
              {statistics.postsCount}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('profile.statistics.posts')}
            </Text>
          </View>

          <View className="flex-1 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800">
            <Text className="text-2xl font-bold text-primary-600">
              {statistics.likesReceived}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {t('profile.statistics.likes')}
            </Text>
          </View>
        </View>
      )}

      {statistics.isSyncing && (
        <Text className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
          {t('profile.statistics.syncing')}
        </Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  // ProfileScreen: main settings screen for editing user profile.
  // Responsibilities:
  // - Load existing profile from backend on mount and populate the form (loadProfile)
  // - Allow avatar selection/upload with progress feedback (handleAvatarPicker / handleAvatarUpload)
  // - Validate input locally (zod + profanity checks) and sync updates to backend (onSubmit)
  // - Expose privacy toggles for community visibility and direct messages
  // - Show lightweight profile statistics and navigation to related areas (plants/harvests)
  //
  // Notes on accessibility and UX:
  // - Interactive elements use accessibilityRole where appropriate (Pressable buttons)
  // - Long running operations (avatar upload / profile sync) update status state so UI can
  //   show progress indicators and disable actions while busy.
  //
  // Requirements mapping (for auditors/developers):
  // 9.x -> Avatar, privacy, form validation and save flow
  // 10.x -> Statistics and navigation to related screens
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id || '';

  // Profile statistics - Requirements: 10.1, 10.2, 10.4
  const statistics = useProfileStatistics(userId);

  // Profile loading state
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Form state
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      bio: '',
      location: '',
    },
  });

  // Avatar state - Requirements: 9.4, 9.5, 9.9
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<
    'idle' | 'uploading' | 'pending' | 'failed'
  >('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Privacy toggles state - Requirements: 9.8
  const [showProfileToCommunity, setShowProfileToCommunity] = useState(true);
  const [allowDirectMessages, setAllowDirectMessages] = useState(true);

  // Load existing profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setIsProfileLoading(false);
        return;
      }

      try {
        const profile = await fetchProfileFromBackend(userId);
        if (profile) {
          // Populate form fields and sync local UI state from the backend response.
          // We intentionally call `reset` to update react-hook-form values rather
          // than setting them individually so validation remains consistent.
          // Set form values
          reset({
            displayName: profile.displayName,
            bio: profile.bio || '',
            location: profile.location || '',
          });

          // Set avatar and privacy states
          setAvatarUrl(profile.avatarUrl || null);
          setShowProfileToCommunity(profile.showProfileToCommunity);
          setAllowDirectMessages(profile.allowDirectMessages);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        // Keep default values if fetch fails
      } finally {
        setIsProfileLoading(false);
      }
    };

    void loadProfile();
  }, [userId, reset]);

  // Handle avatar picker - Requirements: 9.4
  const handleAvatarUpload = useCallback(
    async (localUri: string) => {
      // Upload flow:
      // 1. Provide onProgress callback to update UI (status + progress)
      // 2. Call uploadAvatar helper which abstracts storage + CDN details
      // 3. On success update `avatarUrl`, on failure set status and show an alert
      try {
        const onProgress = (progress: AvatarUploadProgress) => {
          setAvatarStatus(progress.status);
          setUploadProgress(progress.progress);
        };

        const result = await uploadAvatar({
          userId,
          localUri,
          onProgress,
        });

        setAvatarUrl(result.url);
        setAvatarStatus('idle');
      } catch (error) {
        console.error('Avatar upload failed:', error);
        setAvatarStatus('failed');
        Alert.alert(
          t('profile.avatar.uploadFailed'),
          t('profile.avatar.uploadFailedMessage')
        );
      }
    },
    [userId, t]
  );

  const handleAvatarPicker = useCallback(async () => {
    try {
      // Request camera permission
      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();

      // Show action sheet
      Alert.alert(t('profile.avatar.title'), t('profile.avatar.subtitle'), [
        {
          text: t('profile.avatar.takePhoto'),
          onPress: async () => {
            if (!cameraPermission.granted) {
              Alert.alert(
                t('profile.avatar.permissionDenied'),
                t('profile.avatar.permissionMessage')
              );
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 1,
            });

            if (!result.canceled && result.assets[0]) {
              await handleAvatarUpload(result.assets[0].uri);
            }
          },
        },
        {
          text: t('profile.avatar.chooseLibrary'),
          onPress: async () => {
            const result = await requestSelectedPhotos();
            if (result.granted && result.selection && result.selection[0]) {
              await handleAvatarUpload(result.selection[0].uri);
            }
          },
        },
        {
          text: t('profile.avatar.remove'),
          style: 'destructive',
          onPress: () => {
            setAvatarUrl(null);
          },
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ]);
    } catch (error) {
      console.error('Avatar picker error:', error);
    }
  }, [t, handleAvatarUpload]);

  // Handle form submission - Requirements: 9.6, 9.7, 9.10
  const onSubmit = useCallback(
    async (data: ProfileFormData) => {
      // onSubmit responsibilities:
      // - Run local profanity checks (displayName, bio)
      // - If checks pass, call syncProfileToBackend which performs the server
      //   side update and returns a success/error shape
      // - Provide user feedback via Alert and navigate back on success
      try {
        // Profanity check - Requirements: 9.10
        const displayNameCheck = checkProfanity(data.displayName);
        if (displayNameCheck.isProfane) {
          setError('displayName', {
            message: displayNameCheck.feedback,
          });
          return;
        }

        if (data.bio) {
          const bioCheck = checkProfanity(data.bio);
          if (bioCheck.isProfane) {
            setError('bio', {
              message: bioCheck.feedback,
            });
            return;
          }
        }

        // Sync to backend - Requirements: 9.6, 9.7
        const syncResult = await syncProfileToBackend({
          userId,
          displayName: data.displayName,
          bio: data.bio || undefined,
          location: data.location || undefined,
          avatarUrl: avatarUrl || undefined,
          showProfileToCommunity,
          allowDirectMessages,
        });

        if (syncResult.success) {
          Alert.alert(
            t('profile.saveSuccess'),
            t('profile.saveSuccessMessage')
          );
          router.back();
        } else {
          Alert.alert(t('profile.saveFailed'), syncResult.error);
        }
      } catch (error) {
        console.error('Profile save failed:', error);
        Alert.alert(t('profile.saveFailed'), t('profile.saveFailedMessage'));
      }
    },
    [
      userId,
      avatarUrl,
      showProfileToCommunity,
      allowDirectMessages,
      router,
      t,
      setError,
    ]
  );

  // Navigate to relevant sections - Requirements: 10.3
  const navigateToPlants = useCallback(() => {
    router.push('/plants');
  }, [router]);

  const navigateToHarvests = useCallback(() => {
    router.push('/harvests');
  }, [router]);

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView className="flex-1 bg-white dark:bg-charcoal-950">
        <View className="p-4">
          {/* Avatar Section - Requirements: 9.4, 9.5 */}
          {/*
            AvatarPicker shows the current avatar, upload status, and progress.
            - `avatarStatus` controls small UI states (idle, uploading, failed)
            - `uploadProgress` is used by the picker to render a progress ring or bar
            - onPress opens a platform action sheet to choose or take a photo
          */}
          <AvatarSection
            avatarUrl={avatarUrl}
            avatarStatus={avatarStatus}
            uploadProgress={uploadProgress}
            onPress={handleAvatarPicker}
          />

          {/* Form Fields - Requirements: 9.1, 9.2, 9.3 */}
          {/*
            ControlledInput components are wired to react-hook-form via `control`.
            Validation is handled by `zodResolver(profileSchema)` and additional
            runtime checks (profanity) are applied on submit.
          */}
          <ProfileFormFields
            control={control}
            errors={errors}
            isProfileLoading={isProfileLoading}
            t={t}
            showProfileToCommunity={showProfileToCommunity}
            setShowProfileToCommunity={setShowProfileToCommunity}
            allowDirectMessages={allowDirectMessages}
            setAllowDirectMessages={setAllowDirectMessages}
          />

          {/* Statistics Section - Requirements: 10.1, 10.2 */}
          {/*
            Read-only user statistics fetched by `useProfileStatistics`.
            While loading we show an ActivityIndicator. If the user taps the
            plants/harvests tiles we navigate to the respective screens.
            `statistics.isSyncing` indicates a background refresh is in progress.
          */}
          <StatisticsPanel
            statistics={statistics}
            navigateToPlants={navigateToPlants}
            navigateToHarvests={navigateToHarvests}
            t={t}
          />

          {/* Save Button */}
          <Button
            label={t('profile.save')}
            onPress={handleSubmit(onSubmit)}
            className="mt-4"
            disabled={isProfileLoading}
            testID="profile-save-button"
          />
        </View>
      </ScrollView>
    </>
  );
}
