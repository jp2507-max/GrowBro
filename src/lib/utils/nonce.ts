import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytesAsync,
} from 'expo-crypto';

const DEFAULT_NONCE_LENGTH = 32;

export async function createNonce(
  length: number = DEFAULT_NONCE_LENGTH
): Promise<string> {
  const byteLength = Math.max(1, Math.floor(length));
  const randomBytes = await getRandomBytesAsync(byteLength);

  return Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export async function createNoncePair(
  length: number = DEFAULT_NONCE_LENGTH
): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = await createNonce(length);
  const hashedNonce = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  return { rawNonce, hashedNonce };
}
