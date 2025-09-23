import * as ImageManipulator from 'expo-image-manipulator';

export type ExifStripResult = {
  uri: string;
  didStrip: boolean;
};

/**
 * Best-effort EXIF and GPS stripping by re-encoding the image.
 * Note: The result is a new file. If manipulation fails, falls back to original uri.
 */
export async function stripExifAndGeolocation(
  uri: string
): Promise<ExifStripResult> {
  try {
    // Force a re-encode to JPEG which typically drops metadata across platforms.
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ rotate: 0 }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    if (result?.uri && typeof result.uri === 'string') {
      return { uri: result.uri, didStrip: true };
    }
  } catch {
    // fall through to return original uri
  }
  return { uri, didStrip: false };
}
