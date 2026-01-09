import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useEffect } from 'react';
import { useForm, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
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
const HEADER_PADDING_TOP = 12;

type CreatePostHeaderProps = {
  insets: { top: number };
};

function CreatePostHeader({
  insets,
}: CreatePostHeaderProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View
      className="z-0 bg-primary-900 px-6 pb-20 dark:bg-primary-800"
      style={{ paddingTop: insets.top + HEADER_PADDING_TOP }}
    >
      <Text className="text-3xl font-bold tracking-tight text-white">
        {t('feed.add_post.title')}
      </Text>
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
      <TouchableOpacity
        onPress={handlePress}
        disabled={isProcessing}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={
          imageUri ? t('plants.form.edit_photo') : t('plants.form.add_photo')
        }
        accessibilityHint={t('harvest.photo.choose_source')}
      >
        <View className="relative">
          <View
            className={`aspect-video w-full items-center justify-center overflow-hidden rounded-2xl ${
              imageUri
                ? 'border border-primary-300 bg-neutral-100 dark:border-primary-700 dark:bg-charcoal-800'
                : 'border border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-white/5'
            }`}
          >
            {isProcessing ? (
              <View className="items-center justify-center">
                <ActivityIndicator size="large" />
                <Text className="mt-2 text-sm text-neutral-500">
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
              <View className="items-center justify-center">
                <Camera
                  size={32}
                  className="text-primary-800 dark:text-primary-300"
                />
                <Text className="mt-3 font-medium text-primary-900/70 dark:text-primary-100/70">
                  {translateDynamic('feed.add_post.add_photo') ||
                    'Foto hinzufügen'}
                </Text>
              </View>
            )}
          </View>

          {/* Edit badge when image exists */}
          {imageUri && !isProcessing && (
            <View className="absolute -bottom-2 -right-2 size-10 items-center justify-center rounded-full border-2 border-white bg-primary-600 dark:border-charcoal-950">
              <Camera size={18} className="text-white" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// MicroLabel
// ---------------------------------------------------------------------------
function MicroLabel({ children }: { children: string }): React.ReactElement {
  return (
    <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-primary-900/60 dark:text-primary-100/60">
      {children}
    </Text>
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

      <View className="mb-4">
        <MicroLabel>{t('feed.add_post.title_label')}</MicroLabel>
        <Input
          value={titleValue}
          onChangeText={(text) => setValue('title', text)}
          placeholder={t('feed.add_post.title_placeholder')}
          testID="title"
          className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900"
        />
      </View>

      <View className="mb-4">
        <MicroLabel>{t('feed.add_post.content_label')}</MicroLabel>
        <Input
          value={bodyValue}
          onChangeText={(text) => setValue('body', text)}
          placeholder={t('feed.add_post.content_placeholder')}
          multiline
          textAlignVertical="top"
          testID="body-input"
          className="min-h-[120px] rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900"
        />
      </View>

      <View className="mb-4">
        <MicroLabel>{t('feed.add_post.strain_label')}</MicroLabel>
        <StrainPicker
          value={selectedStrain}
          onSelect={setSelectedStrain}
          testID="strain-picker"
        />
      </View>

      <Button
        className="mt-8 h-auto w-full rounded-2xl bg-terracotta-500 py-4 shadow-lg shadow-terracotta-500/40 active:bg-terracotta-600"
        textClassName="text-white text-lg font-semibold"
        label={t('feed.add_post.publish_button')}
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <CreatePostHeader insets={insets} />
        <View className="-mt-10 flex-1 rounded-t-[35px] bg-neutral-50 dark:bg-charcoal-950">
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
            bottomInset={insets.bottom}
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
