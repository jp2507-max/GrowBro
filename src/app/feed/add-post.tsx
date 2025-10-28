import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useEffect } from 'react';
import { useForm, type UseFormSetValue } from 'react-hook-form';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { z } from 'zod';

import { type AttachmentInput, useAddPost } from '@/api';
import {
  Button,
  ControlledInput,
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
};

function appendAssessmentHint(body: string): string {
  return `${body}

---
${translateDynamic('assessment.community.ctaHint')}`;
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
}: PrefillHookOptions) {
  const [applied, setApplied] = React.useState(false);

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

    const applyPrefill = async () => {
      if (hasPrefillParams) {
        const title = titleParam as string;
        const bodyWithHint = appendAssessmentHint(bodyParam as string);

        setValue('title', title as FormType['title']);
        setValue('body', bodyWithHint as FormType['body']);

        const parsedImages = parsePrefillImages(imagesParam);
        if (parsedImages?.length) {
          setAttachments(parsedImages);
        }

        if (assessmentId) {
          setSourceAssessmentId(assessmentId);
        }

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

      const bodyWithHint = appendAssessmentHint(prefill.body);

      setValue('title', prefill.title as FormType['title']);
      setValue('body', bodyWithHint as FormType['body']);
      setAttachments(prefill.images);
      setSourceAssessmentId(assessmentId);
      setApplied(true);
    };

    void applyPrefill();
  }, [applied, params, setAttachments, setSourceAssessmentId, setValue]);
}

export default function AddPost() {
  const params = useLocalSearchParams();
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
  });

  const onSubmit = (data: FormType) => {
    const payload = {
      ...data,
      attachments,
      sourceAssessmentId,
    };
    addPost(payload, {
      onSuccess: () => {
        showMessage({
          message: 'Post added successfully',
          type: 'success',
        });
        // here you can navigate to the post list and refresh the list data
        //queryClient.invalidateQueries(usePosts.getKey());
      },
      onError: () => {
        showErrorMessage('Error adding post');
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

          {attachments.length > 0 && (
            <View className="mt-4">
              <Text className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                Prefilled images
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {attachments.map((image) => (
                  <Image
                    key={image.filename}
                    accessibilityIgnoresInvertColors
                    className="mr-3 rounded-xl"
                    source={{ uri: image.uri }}
                    style={styles.attachmentImage}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          <Button
            className="mt-6"
            label="Add Post"
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
