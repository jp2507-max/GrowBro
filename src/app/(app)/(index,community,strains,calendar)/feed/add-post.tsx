import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useEffect } from 'react';
import { useForm, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { type AttachmentInput, useAddPost } from '@/api';
import { StrainPicker } from '@/components/community/strain-picker';
import {
  Button,
  Image,
  Input,
  showErrorMessage,
  Text,
  View,
} from '@/components/ui';
import { Camera } from '@/components/ui/icons';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { generateCommunityPostPrefill } from '@/lib/assessment/community-post-prefill';
import { getAssessmentSession } from '@/lib/assessment/current-assessment-store';
import { COMMUNITY_HELP_CATEGORY } from '@/lib/community/post-categories';
import { haptics } from '@/lib/haptics';
import { translateDynamic } from '@/lib/i18n/utils';
import type { CapturedPhoto } from '@/types/assessment';

const schema = z.object({
  title: z.string().min(10),
  body: z.string().min(120),
});

type FormType = z.infer<typeof schema>;

type PrefillImage = Pick<AttachmentInput, 'uri' | 'filename'>;

type PrefillHookOptions = {
  params: ReturnType<typeof useLocalSearchParams>;
  setValue: UseFormSetValue<FormType>;
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentInput[]>>;
  setSourceAssessmentId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  translatedHint: string;
};

function appendAssessmentHint(body: string, hint: string): string {
  return `${body}

---
${hint}`;
}

function parsePrefillImages(
  value: string | string[] | undefined
): AttachmentInput[] | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as PrefillImage[];
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(
      (item): item is AttachmentInput =>
        typeof item?.uri === 'string' && typeof item?.filename === 'string'
    );
  } catch (error) {
    console.warn('Failed to parse prefillImages param', error);
    return null;
  }
}

function useAssessmentPrefill({
  params,
  setValue,
  setAttachments,
  setSourceAssessmentId,
  translatedHint,
}: PrefillHookOptions): void {
  const [applied, setApplied] = React.useState(false);
  const mountedRef = React.useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (applied) return;

    const source = params.source;
    if (source !== 'assessment') {
      return;
    }

    const assessmentIdParam = params.assessmentId;
    const assessmentId =
      typeof assessmentIdParam === 'string' ? assessmentIdParam : undefined;

    const titleParam = params.prefillTitle;
    const bodyParam = params.prefillBody;
    const imagesParam = params.prefillImages;

    const hasPrefillParams =
      typeof titleParam === 'string' && typeof bodyParam === 'string';

    const applyPrefill = async (): Promise<void> => {
      if (hasPrefillParams) {
        const title = titleParam as string;
        const bodyWithHint = appendAssessmentHint(
          bodyParam as string,
          translatedHint
        );

        if (!mountedRef.current) return;
        setValue('title', title as FormType['title']);
        if (!mountedRef.current) return;
        setValue('body', bodyWithHint as FormType['body']);

        const parsedImages = parsePrefillImages(imagesParam);
        if (parsedImages?.length) {
          if (!mountedRef.current) return;
          setAttachments(parsedImages);
        }

        if (assessmentId) {
          if (!mountedRef.current) return;
          setSourceAssessmentId(assessmentId);
        }

        if (!mountedRef.current) return;
        setApplied(true);
        return;
      }

      if (!assessmentId) {
        return;
      }

      const session = getAssessmentSession(assessmentId);
      if (!session) {
        return;
      }

      const capturedPhotos: CapturedPhoto[] = session.photos;
      const prefill = await generateCommunityPostPrefill({
        assessment: session.result,
        assessmentId,
        plantContext: session.plantContext,
        capturedPhotos,
      });

      if (!mountedRef.current) return;

      const bodyWithHint = appendAssessmentHint(prefill.body, translatedHint);

      if (!mountedRef.current) return;
      setValue('title', prefill.title as FormType['title']);
      if (!mountedRef.current) return;
      setValue('body', bodyWithHint as FormType['body']);
      if (!mountedRef.current) return;
      setAttachments(prefill.images);
      if (!mountedRef.current) return;
      setSourceAssessmentId(assessmentId);
      if (!mountedRef.current) return;
      setApplied(true);
    };

    void applyPrefill();

    return () => {
      mountedRef.current = false;
    };
  }, [
    applied,
    params,
    setAttachments,
    setSourceAssessmentId,
    setValue,
    translatedHint,
  ]);
}

// ---------------------------------------------------------------------------
// CreatePostHeader
// ---------------------------------------------------------------------------
const HEADER_PADDING_TOP = 8;

type CreatePostHeaderProps = {
  insets: { top: number };
  onClose: () => void;
};

function CreatePostHeader({
  insets,
  onClose,
}: CreatePostHeaderProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View
      className="flex-row items-center justify-between bg-primary-900 px-4 pb-4 dark:bg-primary-800"
      style={{ paddingTop: insets.top + HEADER_PADDING_TOP }}
    >
      {/* Close button */}
      <Pressable
        onPress={onClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        accessibilityHint={t('common.close_screen')}
        className="size-10 items-center justify-center active:opacity-70"
      >
        <Text className="text-2xl font-light text-white">×</Text>
      </Pressable>

      {/* Centered title */}
      <Text className="text-lg font-semibold text-white">
        {t('feed.add_post.title')}
      </Text>

      {/* Spacer for balance */}
      <View className="size-10" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// PostHeroPhotoSection
// ---------------------------------------------------------------------------
type PostHeroPhotoSectionProps = {
  imageUri?: string;
  isProcessing: boolean;
  onPress: () => void;
};

function PostHeroPhotoSection({
  imageUri,
  isProcessing,
  onPress,
}: PostHeroPhotoSectionProps): React.ReactElement {
  const { t } = useTranslation();

  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      className="mb-6"
    >
      <Pressable
        onPress={handlePress}
        disabled={isProcessing}
        accessibilityRole="button"
        accessibilityLabel={
          imageUri ? t('plants.form.edit_photo') : t('plants.form.add_photo')
        }
        accessibilityHint={t('harvest.photo.choose_source')}
        className="active:opacity-80"
      >
        <View className="relative">
          {/* Glass-effect card with lime dashed border */}
          <View
            className={`aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl ${
              imageUri
                ? 'border-2 border-lime-400/60 bg-charcoal-800'
                : 'border-[2.5px] border-dashed border-lime-400/50 bg-white/[0.04]'
            }`}
          >
            {isProcessing ? (
              <View className="items-center justify-center gap-3">
                <ActivityIndicator size="large" color="#a3e635" />
                <Text className="text-sm font-medium text-neutral-400">
                  {t('harvest.photo.processing_photo')}
                </Text>
              </View>
            ) : imageUri ? (
              <Image
                source={{ uri: imageUri }}
                className="size-full"
                contentFit="cover"
              />
            ) : (
              <View className="items-center justify-center gap-3">
                {/* Circular lime icon container with plus badge */}
                <View className="relative">
                  <View className="size-[72px] items-center justify-center rounded-full bg-lime-400">
                    <Camera size={32} className="text-charcoal-900" />
                  </View>
                  {/* Plus badge */}
                  <View className="absolute -right-1 -top-1 size-6 items-center justify-center rounded-full bg-lime-300 shadow-sm">
                    <Text className="text-base font-bold text-charcoal-900">
                      +
                    </Text>
                  </View>
                </View>
                <Text className="text-center text-base font-semibold text-white">
                  {t('feed.add_post.add_photo')}
                </Text>
              </View>
            )}
          </View>

          {/* Floating edit badge when image exists */}
          {imageUri && !isProcessing && (
            <View className="absolute -bottom-2 -right-2 size-11 items-center justify-center rounded-full border-2 border-charcoal-950 bg-lime-500 shadow-lg shadow-lime-500/30">
              <Camera size={20} className="text-charcoal-900" />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// PostFormContent - Extracted to reduce main component line count
// ---------------------------------------------------------------------------
type PostFormContentProps = {
  titleValue: string;
  bodyValue: string;
  setValue: (field: 'title' | 'body', value: string) => void;
  selectedStrain: string | undefined;
  setSelectedStrain: React.Dispatch<React.SetStateAction<string | undefined>>;
  imageUri: string | undefined;
  isProcessingPhoto: boolean;
  onPhotoPress: () => void;
  isPending: boolean;
  onSubmit: () => void;
  bottomInset: number;
};

function PostFormContent({
  titleValue,
  bodyValue,
  setValue,
  selectedStrain,
  setSelectedStrain,
  imageUri,
  isProcessingPhoto,
  onPhotoPress,
  isPending,
  onSubmit,
  bottomInset,
}: PostFormContentProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <PostHeroPhotoSection
        imageUri={imageUri}
        isProcessing={isProcessingPhoto}
        onPress={onPhotoPress}
      />

      {/* Title Input - glass card with floating label */}
      <View className="mb-4 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4">
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400">
          {t('feed.add_post.title_label')}
        </Text>
        <Input
          value={titleValue}
          onChangeText={(text) => setValue('title', text)}
          placeholder={t('feed.add_post.title_placeholder')}
          testID="title"
          placeholderTextColor="#6b7280"
          className="border-0 bg-transparent p-0 text-base text-white"
        />
      </View>

      {/* Content Input - glass card with floating label */}
      <View className="mb-4 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4">
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400">
          {t('feed.add_post.content_label')}
        </Text>
        <Input
          value={bodyValue}
          onChangeText={(text) => setValue('body', text)}
          placeholder={t('feed.add_post.content_placeholder')}
          multiline
          textAlignVertical="top"
          testID="body-input"
          placeholderTextColor="#6b7280"
          className="min-h-[100px] border-0 bg-transparent p-0 text-base text-white"
        />
      </View>

      {/* Strain Picker - glass card with floating label */}
      <View className="mb-8 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4">
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400">
          {t('feed.add_post.strain_label')}
        </Text>
        <StrainPicker
          value={selectedStrain}
          onSelect={setSelectedStrain}
          testID="strain-picker"
        />
      </View>

      {/* Large pill-shaped CTA with arrow */}
      <Button
        className="mt-4 h-auto w-full rounded-full bg-terracotta-500 py-5 shadow-xl shadow-terracotta-500/40 active:bg-terracotta-600"
        textClassName="text-white text-lg font-bold tracking-wide"
        label={`${t('feed.add_post.publish_button')}  ↑`}
        loading={isPending}
        onPress={() => {
          haptics.medium();
          onSubmit();
        }}
        testID="add-post-button"
      />

      <View style={{ height: bottomInset + 24 }} />
    </KeyboardAwareScrollView>
  );
}

// ---------------------------------------------------------------------------
// Photo action handler - extracted to reduce component size
// ---------------------------------------------------------------------------
type PhotoActionOptions = {
  source: 'camera' | 'library';
  t: ReturnType<typeof useTranslation>['t'];
  setIsProcessing: (v: boolean) => void;
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentInput[]>>;
};

async function executePhotoAction(opts: PhotoActionOptions): Promise<void> {
  const { source, t, setIsProcessing, setAttachments } = opts;
  try {
    setIsProcessing(true);
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showErrorMessage(t('harvest.photo.errors.camera_permission_denied'));
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            allowsMultipleSelection: false,
          });
    if (!result.canceled && result.assets[0]) {
      const photo = result.assets[0];
      setAttachments([
        {
          uri: photo.uri,
          filename: photo.fileName || `photo-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        },
      ]);
    }
  } catch (error) {
    console.error('Failed to capture/select photo:', error);
    showErrorMessage(t('harvest.photo.errors.capture_failed'));
  } finally {
    setIsProcessing(false);
  }
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function AddPost(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { grossHeight } = useBottomTabBarHeight();
  const translatedHint = translateDynamic('assessment.community.cta_hint');
  const { handleSubmit, setValue, watch } = useForm<FormType>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', body: '' },
  });
  const { mutate: addPost, isPending } = useAddPost();

  const [attachments, setAttachments] = React.useState<AttachmentInput[]>([]);
  const [sourceAssessmentId, setSourceAssessmentId] = React.useState<string>();
  const [selectedStrain, setSelectedStrain] = React.useState<string>();
  const [isProcessingPhoto, setIsProcessingPhoto] = React.useState(false);

  const titleValue = watch('title');
  const bodyValue = watch('body');

  useAssessmentPrefill({
    params,
    setValue,
    setAttachments,
    setSourceAssessmentId,
    translatedHint,
  });

  const handlePhotoPress = React.useCallback(() => {
    const opts = { t, setIsProcessing: setIsProcessingPhoto, setAttachments };
    Alert.alert(
      t('harvest.photo.alerts.photo_options_title'),
      t('harvest.photo.choose_source'),
      [
        {
          text: t('harvest.photo.actions.take_photo'),
          onPress: () => executePhotoAction({ ...opts, source: 'camera' }),
        },
        {
          text: t('harvest.photo.actions.choose_from_library'),
          onPress: () => executePhotoAction({ ...opts, source: 'library' }),
        },
        { text: t('harvest.photo.cancel'), style: 'cancel' },
      ]
    );
  }, [t]);

  // Determine if we're in help mode from URL params
  const isHelpMode = params.mode === 'help';

  const onSubmit = React.useCallback(
    (data: FormType) => {
      addPost(
        {
          ...data,
          attachments,
          sourceAssessmentId,
          strain: selectedStrain,
          category: isHelpMode ? COMMUNITY_HELP_CATEGORY : undefined,
        },
        {
          onSuccess: () => {
            showMessage({
              message: t('communityPost.postAdded'),
              type: 'success',
            });
            router.back();
          },
          onError: (error) => {
            console.error('Failed to create post:', error);
            showErrorMessage(error?.message || t('communityPost.postAddError'));
          },
        }
      );
    },
    [
      addPost,
      attachments,
      isHelpMode,
      router,
      selectedStrain,
      sourceAssessmentId,
      t,
    ]
  );

  const handleClose = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-primary-900 dark:bg-primary-800">
        <CreatePostHeader insets={insets} onClose={handleClose} />
        <View className="flex-1 bg-primary-900 dark:bg-primary-800">
          <PostFormContent
            titleValue={titleValue}
            bodyValue={bodyValue}
            setValue={setValue}
            selectedStrain={selectedStrain}
            setSelectedStrain={setSelectedStrain}
            imageUri={attachments[0]?.uri}
            isProcessingPhoto={isProcessingPhoto}
            onPhotoPress={handlePhotoPress}
            isPending={isPending}
            onSubmit={handleSubmit(onSubmit)}
            bottomInset={grossHeight}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
});
