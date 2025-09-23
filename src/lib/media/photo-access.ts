export type PhotoAccessResult = {
  granted: boolean;
  selection?: { uri: string }[];
  reselectionSupported: boolean;
};

export async function requestSelectedPhotos(): Promise<PhotoAccessResult> {
  // Prefer Android Photo Picker. With Expo 54, Expo ImagePicker uses the platform picker.
  // To keep dependencies stable, we return a conservative stub indicating no pre-grant.
  return { granted: false, selection: [], reselectionSupported: true };
}

export function showReselectionUI(): void {
  // Expose a hook for UI to present re-selection or open settings.
}
