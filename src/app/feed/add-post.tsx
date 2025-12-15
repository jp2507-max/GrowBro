import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useEffect } from 'react';
import { useForm, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { z } from 'zod';

import { type AttachmentInput, useAddPost } from '@/api';
import {
  Button,
  ControlledInput,
  Image,
  showErrorMessage,
  Text,
  View,
} from '@/components/ui';
import { generateCommunityPostPrefill } from '@/lib/assessment/community-post-prefill';
import { getAssessmentSession } from '@/lib/assessment/current-assessment-store';
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

type PhotoAttachmentSectionProps = {
  attachments: AttachmentInput[];
  onCapturePhoto: () => void;
  onSelectPhoto: () => void;
  onRemovePhoto: () => void;
};

function PhotoAttachmentSection({
  attachments,
  onCapturePhoto,
  onSelectPhoto,
  onRemovePhoto,
}: PhotoAttachmentSectionProps): React.JSX.Element {
  return (
    <View className="mt-4">
      {attachments.length === 0 ? (
        <View className="flex-row gap-3">
          <Button
            onPress={onCapturePhoto}
            variant="outline"
            size="sm"
            className="flex-1"
            testID="capture-photo-button"
          >
            <Text className="text-sm">
              {translateDynamic('feed.addPost.capturePhoto')}
            </Text>
          </Button>
          <Button
            onPress={onSelectPhoto}
            variant="outline"
            size="sm"
            className="flex-1"
            testID="select-photo-button"
          >
            <Text className="text-sm">
              {translateDynamic('feed.addPost.selectPhoto')}
            </Text>
          </Button>
        </View>
      ) : (
        <View>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              {translateDynamic('feed.prefilledImages')}
            </Text>
            <Button
              variant="link"
              size="sm"
              onPress={onRemovePhoto}
              testID="remove-photo-button"
              accessibilityLabel={translateDynamic('feed.addPost.removePhoto')}
              accessibilityHint={translateDynamic(
                'feed.addPost.removePhotoHint'
              )}
              textClassName="text-danger-600"
              className="my-0 px-0"
            >
              <Text className="text-sm text-danger-600">
                {translateDynamic('feed.addPost.removePhoto')}
              </Text>
            </Button>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {attachments.map((image, index) => (
              <Image
                key={image.filename}
                accessibilityIgnoresInvertColors
                accessibilityLabel={
                  image.filename ||
                  translateDynamic('feed.attachmentImageFallback')
                }
                accessibilityHint={translateDynamic('feed.attachmentImageHint')}
                accessibilityRole="image"
                testID={`attachment-image-${image.filename || index}`}
                className="mr-3 rounded-xl"
                source={{ uri: image.uri }}
                style={styles.attachmentImage}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function AddPost(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const translatedHint = translateDynamic('assessment.community.ctaHint');
  const { control, handleSubmit, setValue } = useForm<FormType>({
    resolver: zodResolver(schema),
  });
  const { mutate: addPost, isPending } = useAddPost();

  const [attachments, setAttachments] = React.useState<AttachmentInput[]>([]);
  const [sourceAssessmentId, setSourceAssessmentId] = React.useState<string>();

  useAssessmentPrefill({
    params,
    setValue,
    setAttachments,
    setSourceAssessmentId,
    translatedHint,
  });

  const handleCapturePhoto = React.useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showErrorMessage(t('harvest.photo.errors.camera_permission_denied'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
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
      console.error('Failed to capture photo:', error);
      showErrorMessage(t('harvest.photo.errors.capture_failed'));
    }
  }, [t]);

  const handleSelectPhoto = React.useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
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
      console.error('Failed to select photo:', error);
      showErrorMessage(t('harvest.photo.errors.selection_failed'));
    }
  }, [t]);

  const handleRemovePhoto = React.useCallback(() => {
    setAttachments([]);
  }, []);

  const onSubmit = (data: FormType) => {
    const payload = {
      ...data,
      attachments,
      sourceAssessmentId,
    };
    addPost(payload, {
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
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: translateDynamic('feed.addPost.title'),
          headerBackTitle: translateDynamic('feed.title'),
        }}
      />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        testID="add-post-scroll"
      >
        <View className="p-4">
          <ControlledInput
            name="title"
            label={translateDynamic('feed.addPost.titleLabel')}
            control={control}
            testID="title"
          />
          <ControlledInput
            name="body"
            label={translateDynamic('feed.addPost.contentLabel')}
            control={control}
            multiline
            testID="body-input"
          />

          <PhotoAttachmentSection
            attachments={attachments}
            onCapturePhoto={handleCapturePhoto}
            onSelectPhoto={handleSelectPhoto}
            onRemovePhoto={handleRemovePhoto}
          />

          <Button
            className="mt-6"
            label={t('feed.addPost')}
            loading={isPending}
            onPress={handleSubmit(onSubmit)}
            testID="add-post-button"
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  attachmentImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
});
