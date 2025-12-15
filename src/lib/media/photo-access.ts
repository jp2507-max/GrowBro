import * as ImagePicker from 'expo-image-picker';

export type PhotoAccessResult = {
  granted: boolean;
  selection?: { uri: string }[];
  reselectionSupported: boolean;
};

// Contract
// - Uses the platform photo picker (PHPicker on iOS, Photo Picker on Android)
// - Does NOT request full library permission; simply presents the picker
// - granted=true only if user selected at least one asset
// - Always sets reselectionSupported=true (we can re-open picker any time)
export async function requestSelectedPhotos(): Promise<PhotoAccessResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled) {
    return { granted: false, reselectionSupported: true };
  }

  const selection = (result.assets ?? []).map((a) => ({ uri: a.uri }));
  const granted = selection.length > 0;
  return { granted, selection, reselectionSupported: true };
}

export function showReselectionUI(): void {
  // Fire-and-forget re-open of the picker; callers who need results should use requestSelectedPhotos()
  void ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
}
