import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { fromByteArray } from 'react-native-quick-base64';

/**
 * Photo encryption utilities using OS keystore
 *
 * Requirements:
 * - Task 6: Encrypt photos at rest using OS keystore-backed keys
 * - Decrypt only for display/upload
 * - Graceful fallback if encryption fails
 */

const ENCRYPTION_KEY_NAME = 'harvest_photo_encryption_key';

/**
 * Get or generate encryption key from secure store
 *
 * @returns Base64 encryption key
 */
async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    // Try to retrieve existing key
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);

    if (!key) {
      // Generate new 256-bit key
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      // Use react-native-quick-base64 for reliable encoding
      key = fromByteArray(randomBytes);

      // Store in secure keystore
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
    }

    return key;
  } catch (error) {
    console.error('Failed to get/create encryption key:', error);
    throw error;
  }
}

/**
 * Encrypt file content (stub implementation)
 *
 * Note: Full encryption would require a native module or crypto library.
 * This is a simplified version showing the architecture.
 *
 * @param sourceUri - Source file URI
 * @returns Encrypted file URI or original URI on failure
 */
export async function encryptFile(sourceUri: string): Promise<string> {
  try {
    // Get encryption key
    await getOrCreateEncryptionKey();

    // TODO: Actual encryption would require:
    // 1. Read file as bytes
    // 2. Encrypt using AES-256-GCM with key from keystore
    // 3. Write encrypted bytes to new file
    // 4. Return encrypted file URI

    // For now, return original URI (graceful fallback)
    console.warn('Photo encryption not yet implemented, storing unencrypted');
    return sourceUri;
  } catch (error) {
    console.error('Encryption failed, falling back to unencrypted:', error);
    return sourceUri;
  }
}

/**
 * Decrypt file content (stub implementation)
 *
 * @param encryptedUri - Encrypted file URI
 * @returns Decrypted file URI or original URI on failure
 */
export async function decryptFile(encryptedUri: string): Promise<string> {
  try {
    // Get encryption key
    await getOrCreateEncryptionKey();

    // TODO: Actual decryption would require:
    // 1. Read encrypted file as bytes
    // 2. Decrypt using AES-256-GCM with key from keystore
    // 3. Write decrypted bytes to temp file
    // 4. Return decrypted file URI

    // For now, return original URI (assume no encryption)
    return encryptedUri;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedUri;
  }
}

/**
 * Check if encryption is available
 *
 * @returns True if encryption is supported
 */
export async function isEncryptionAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}
