import HmacSHA256 from 'crypto-js/hmac-sha256';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

import { getOrCreateDeviceSecret } from '@/lib/assessment/device-secret';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

async function ensureImageWithinSize(imageUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(imageUri);

  if (!info.exists || !('size' in info) || info.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `Image too large or does not exist: max ${MAX_IMAGE_SIZE_BYTES} bytes`
    );
  }
}

export async function computeIntegritySha256(
  imageUri: string
): Promise<string> {
  try {
    await ensureImageWithinSize(imageUri);

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );
    return digest;
  } catch (error) {
    console.error('Failed to compute integrity hash:', error);
    throw new Error('Failed to compute integrity hash');
  }
}

export async function computeFilenameKey(imageUri: string): Promise<string> {
  const secret = await getOrCreateDeviceSecret();

  try {
    await ensureImageWithinSize(imageUri);

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const hmac = HmacSHA256(base64, secret);
    return hmac.toString();
  } catch (error) {
    console.error('Failed to compute filename key:', error);
    throw new Error('Failed to compute filename key');
  }
}
