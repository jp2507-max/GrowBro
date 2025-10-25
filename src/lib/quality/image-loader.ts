import * as FileSystem from 'expo-file-system';
import jpeg from 'jpeg-js';
import { toByteArray } from 'react-native-quick-base64';

import type { ImageLumaData } from './types';

function createLumaBuffer(
  pixels: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const luma = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const value = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[p] = value > 255 ? 255 : value < 0 ? 0 : value;
  }

  return luma;
}

export async function readImageLumaData(uri: string): Promise<ImageLumaData> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const bytes = toByteArray(base64);
    const decoded = jpeg.decode(bytes, { useTArray: true });

    if (!decoded || !decoded.width || !decoded.height || !decoded.data) {
      throw new Error('Invalid JPEG decode response');
    }

    const pixels =
      decoded.data instanceof Uint8Array
        ? decoded.data
        : new Uint8Array(decoded.data);
    const luma = createLumaBuffer(pixels, decoded.width, decoded.height);

    return {
      width: decoded.width,
      height: decoded.height,
      luma,
      pixels,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load image data: ${reason}`);
  }
}
