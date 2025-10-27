import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { AdaptiveCameraCapture } from '@/components/assessment/adaptive-camera-capture';
import { PermissionDenied } from '@/components/assessment/permission-denied';
import { PhotoPreview } from '@/components/assessment/photo-preview';
import { showErrorMessage, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { runInference } from '@/lib/assessment';
import {
  logAssessmentCreated,
  logInferenceCompleted,
  logInferenceFailure,
} from '@/lib/assessment/assessment-telemetry-service';
import { setAssessmentSession } from '@/lib/assessment/current-assessment-store';
import {
  generateThumbnail,
  stripExifData,
} from '@/lib/assessment/image-processing';
import { storeImage, storeThumbnail } from '@/lib/assessment/image-storage';
import { useCameraPermission } from '@/lib/assessment/use-camera-permission';
import { translateDynamic } from '@/lib/i18n/utils';
import type {
  AssessmentPlantContext,
  AssessmentResult,
  CapturedPhoto,
  GuidanceMode,
  InferenceError,
} from '@/types/assessment';

type PersistedPhotoParams = {
  photo: CapturedPhoto;
  assessmentId: string;
};

async function persistPhoto({
  photo,
  assessmentId,
}: PersistedPhotoParams): Promise<CapturedPhoto> {
  const processed = await stripExifData(photo.uri);
  const { filenameKey, storedUri } = await storeImage(
    processed.uri,
    assessmentId
  );
  const thumbnailUri = await generateThumbnail(processed.uri);

  await storeThumbnail({
    thumbnailUri,
    assessmentId,
    filenameKey,
  });

  return {
    ...photo,
    uri: storedUri,
  };
}

type AssessmentPipelineParams = {
  photos: CapturedPhoto[];
  assessmentId: string;
  plantContext: AssessmentPlantContext;
};

async function runAssessmentPipeline({
  photos,
  assessmentId,
  plantContext,
}: AssessmentPipelineParams): Promise<AssessmentResult> {
  await logAssessmentCreated({
    assessmentId,
    mode: 'device',
    photoCount: photos.length,
  });

  try {
    const result = await runInference(photos, {
      mode: 'auto',
      plantContext,
      assessmentId,
    });

    await logInferenceCompleted(assessmentId, result);
    return result;
  } catch (error) {
    const inferenceError = error as InferenceError;

    await logInferenceFailure({
      assessmentId,
      error: inferenceError,
      mode: inferenceError.fallbackToCloud ? 'cloud' : 'device',
    });

    throw inferenceError;
  }
}

const MAX_PHOTOS = 3;

function useAssessmentSession() {
  const params = useLocalSearchParams();
  const assessmentIdRef = useRef<string | null>(null);
  if (!assessmentIdRef.current) {
    assessmentIdRef.current = uuidv4();
  }
  const assessmentId = assessmentIdRef.current!;

  const plantIdParam = params.plantId;
  const plantId =
    typeof plantIdParam === 'string' && plantIdParam.length > 0
      ? plantIdParam
      : 'unknown';
  const plantContext = useMemo(() => ({ id: plantId }), [plantId]);

  return { assessmentId, plantContext };
}

export default function AssessmentCaptureScreen() {
  const router = useRouter();
  const { status, isLoading, requestPermission } = useCameraPermission();
  const { assessmentId, plantContext } = useAssessmentSession();

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<CapturedPhoto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const guidanceMode: GuidanceMode = 'leaf-top';

  const finalizeAssessment = useCallback(
    async (photos: CapturedPhoto[]) => {
      try {
        const result = await runAssessmentPipeline({
          photos,
          assessmentId,
          plantContext,
        });

        setAssessmentSession(assessmentId, {
          result,
          plantContext,
          photos,
          createdAt: Date.now(),
        });

        setCapturedPhotos([]);

        router.push({
          pathname: '/assessment/result',
          params: { assessmentId },
        });
      } catch (error) {
        console.error('Assessment inference failed:', error);
        setCapturedPhotos([]);
        showErrorMessage(translateDynamic('assessment.errors.analysisFailed'));
      }
    },
    [assessmentId, plantContext, router]
  );

  const handlePhotoCapture = useCallback((photo: CapturedPhoto) => {
    setCurrentPhoto(photo);
  }, []);

  const handleRetake = useCallback(() => {
    setCurrentPhoto(null);
  }, []);

  const handleAccept = useCallback(async () => {
    if (!currentPhoto) return;

    setIsProcessing(true);
    try {
      const persistedPhoto = await persistPhoto({
        photo: currentPhoto,
        assessmentId,
      });

      const updatedPhotos = [...capturedPhotos, persistedPhoto];
      setCapturedPhotos(updatedPhotos);
      setCurrentPhoto(null);

      if (updatedPhotos.length >= MAX_PHOTOS) {
        await finalizeAssessment(updatedPhotos);
      }
    } catch (error) {
      console.error('Failed to store photo:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [assessmentId, capturedPhotos, currentPhoto, finalizeAssessment]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleCameraError = useCallback((error: Error) => {
    console.error('Camera error:', error);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  if (status === 'denied' || status === 'restricted') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PermissionDenied onRetry={requestPermission} onCancel={handleCancel} />
      </>
    );
  }

  if (status !== 'granted') {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  if (currentPhoto) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PhotoPreview
          photo={currentPhoto}
          onRetake={handleRetake}
          onAccept={handleAccept}
          isLastPhoto={capturedPhotos.length + 1 >= MAX_PHOTOS}
        />
      </>
    );
  }

  if (isProcessing) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AdaptiveCameraCapture
        onPhotoCapture={handlePhotoCapture}
        guidanceMode={guidanceMode}
        photoCount={capturedPhotos.length}
        maxPhotos={MAX_PHOTOS}
        onError={handleCameraError}
      />
    </>
  );
}
