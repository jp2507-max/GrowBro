import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SECRET_KEY = 'assessment_filename_secret';

export async function getOrCreateDeviceSecret(): Promise<string> {
  try {
    let secret = await SecureStore.getItemAsync(SECRET_KEY);

    if (!secret) {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      secret = Array.from(randomBytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

      await SecureStore.setItemAsync(SECRET_KEY, secret);
    }

    return secret;
  } catch (error) {
    console.error('Failed to get/create device secret:', error);
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error));
  }
}
