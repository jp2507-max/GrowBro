import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AdaptiveCameraCapture } from '@/components/assessment/adaptive-camera-capture';
import { PermissionDenied } from '@/components/assessment/permission-denied';
import { PhotoPreview } from '@/components/assessment/photo-preview';
import { View } from '@/components/ui';
import { generateThumbnail } from '@/lib/assessment/image-processing';
import { storeImage, storeThumbnail } from '@/lib/assessment/image-storage';
import { useCameraPermission } from '@/lib/assessment/use-camera-permission';
import type { CapturedPhoto, GuidanceMode } from '@/types/assessment';

export default function AssessmentCaptureScreen() {
  const router = useRouter();
  const { status, isLoading, requestPermission } = useCameraPermission();

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<CapturedPhoto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const maxPhotos = 3;
  const guidanceMode: GuidanceMode = 'leaf-top'; // TODO: Make this configurable

  const handlePhotoCapture = async (photo: CapturedPhoto) => {
    setCurrentPhoto(photo);
  };

  const handleRetake = () => {
    setCurrentPhoto(null);
  };

  const handleAccept = async () => {
    if (!currentPhoto) return;

    setIsProcessing(true);
    try {
      // Store the photo with content-addressable filename
      const assessmentId = 'temp_' + Date.now(); // TODO: Get actual assessment ID
      const { filenameKey, storedUri } = await storeImage(
        currentPhoto.uri,
        assessmentId
      );

      // Generate and store thumbnail
      const thumbnailUri = await generateThumbnail(currentPhoto.uri);
      await storeThumbnail({
        thumbnailUri,
        assessmentId,
        filenameKey,
      });

      // Add to captured photos
      const photoWithStorage: CapturedPhoto = {
        ...currentPhoto,
        uri: storedUri,
      };

      const updatedPhotos = [...capturedPhotos, photoWithStorage];
      setCapturedPhotos(updatedPhotos);
      setCurrentPhoto(null);

      // If we've captured all photos, navigate to results
      if (updatedPhotos.length >= maxPhotos) {
        // TODO: Navigate to assessment results screen
        // For now, just go back
        router.back();
      }
    } catch (error) {
      console.error('Failed to store photo:', error);
      // TODO: Show error message
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Permission denied state
  if (status === 'denied' || status === 'restricted') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PermissionDenied onRetry={requestPermission} onCancel={handleCancel} />
      </>
    );
  }

  // Permission not granted yet
  if (status !== 'granted') {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Show photo preview if we have a current photo
  if (currentPhoto) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PhotoPreview
          photo={currentPhoto}
          onRetake={handleRetake}
          onAccept={handleAccept}
          isLastPhoto={capturedPhotos.length + 1 >= maxPhotos}
        />
      </>
    );
  }

  // Show processing overlay
  if (isProcessing) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Show camera capture
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AdaptiveCameraCapture
        onPhotoCapture={handlePhotoCapture}
        guidanceMode={guidanceMode}
        photoCount={capturedPhotos.length}
        maxPhotos={maxPhotos}
      />
    </>
  );
}
