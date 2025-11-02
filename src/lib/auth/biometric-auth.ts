/**
 * Biometric Authentication Service
 *
 * Provides utilities for biometric authentication using expo-local-authentication.
 * Handles device capability checks, permission requests, and secure token storage.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_TOKEN_KEY = 'biometric_auth_token';
const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

export interface BiometricCapability {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

export interface BiometricAuthResult {
  success: boolean;
  error?: 'not_available' | 'not_enrolled' | 'cancelled' | 'failed';
  biometricType?: 'face' | 'fingerprint' | 'iris';
}

/**
 * Check device biometric capability
 */
export async function checkBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes =
    await LocalAuthentication.supportedAuthenticationTypesAsync();

  return {
    isAvailable: hasHardware && isEnrolled,
    hasHardware,
    isEnrolled,
    supportedTypes,
  };
}

/**
 * Get human-readable biometric type
 */
export function getBiometricType(
  types: LocalAuthentication.AuthenticationType[]
): 'face' | 'fingerprint' | 'iris' | undefined {
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return 'face';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris';
  }
  return undefined;
}

/**
 * Get user-friendly biometric authentication label for UI
 * Returns a localized string based on available biometric types
 */
export function getBiometricLabel(
  types: LocalAuthentication.AuthenticationType[]
): string {
  const biometricType = getBiometricType(types);

  switch (biometricType) {
    case 'face':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris Scanner';
    default:
      return 'Biometric Authentication';
  }
}

/**
 * Authenticate with biometrics
 */
export async function authenticateWithBiometrics(): Promise<BiometricAuthResult> {
  try {
    const capability = await checkBiometricCapability();

    if (!capability.hasHardware) {
      return { success: false, error: 'not_available' };
    }

    if (!capability.isEnrolled) {
      return { success: false, error: 'not_enrolled' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });

    if (result.success) {
      const biometricType = getBiometricType(capability.supportedTypes);
      return { success: true, biometricType };
    }

    return { success: false, error: 'failed' };
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return { success: false, error: 'failed' };
  }
}

/**
 * Enable biometric login
 * Generates and stores a secure token for future authentication
 */
export async function enableBiometricLogin(): Promise<BiometricAuthResult> {
  try {
    // First, verify biometrics work
    const authResult = await authenticateWithBiometrics();
    if (!authResult.success) {
      return authResult;
    }

    // Generate a secure token
    const token = generateSecureToken();

    // Store the token securely
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

    return authResult;
  } catch (error) {
    console.error('Failed to enable biometric login:', error);
    return { success: false, error: 'failed' };
  }
}

/**
 * Disable biometric login
 * Removes stored tokens
 */
export async function disableBiometricLogin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  } catch (error) {
    console.error('Failed to disable biometric login:', error);
    throw error;
  }
}

/**
 * Check if biometric login is enabled
 */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('Failed to check biometric status:', error);
    return false;
  }
}

/**
 * Get stored biometric token
 */
export async function getBiometricToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get biometric token:', error);
    return null;
  }
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}
