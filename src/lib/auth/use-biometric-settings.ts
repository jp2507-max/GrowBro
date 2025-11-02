/**
 * Biometric Settings Store
 *
 * Manages biometric authentication state using Zustand.
 */

import { create } from 'zustand';

import {
  checkBiometricCapability,
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricType,
  isBiometricLoginEnabled,
} from './biometric-auth';

export interface BiometricSettingsState {
  isEnabled: boolean;
  isAvailable: boolean;
  biometricType: 'face' | 'fingerprint' | 'iris' | undefined;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

// Helper function to handle initialization logic
async function initializeBiometricState(
  set: (state: Partial<BiometricSettingsState>) => void
): Promise<void> {
  set({ isLoading: true, error: null });
  try {
    const [enabled, capability] = await Promise.all([
      isBiometricLoginEnabled(),
      checkBiometricCapability(),
    ]);

    const biometricType = getBiometricType(capability.supportedTypes);

    set({
      isEnabled: enabled,
      isAvailable: capability.isAvailable,
      biometricType,
      isLoading: false,
    });
  } catch (error) {
    console.error('Failed to initialize biometric settings:', error);
    set({
      isLoading: false,
      error: 'Failed to initialize biometric settings',
    });
  }
}

// Helper function to handle enable logic
async function enableBiometric(
  set: (state: Partial<BiometricSettingsState>) => void
): Promise<boolean> {
  set({ isLoading: true, error: null });
  try {
    const result = await enableBiometricLogin();

    if (result.success) {
      set({
        isEnabled: true,
        biometricType: result.biometricType,
        isLoading: false,
      });
      return true;
    }

    let errorMessage = 'Failed to enable biometric login';
    if (result.error === 'not_available') {
      errorMessage = 'auth.security.biometric_not_available';
    } else if (result.error === 'not_enrolled') {
      errorMessage = 'auth.security.biometric_not_enrolled';
    } else if (result.error === 'cancelled') {
      errorMessage = 'Biometric authentication was cancelled';
    }

    set({ isLoading: false, error: errorMessage });
    return false;
  } catch (error) {
    console.error('Failed to enable biometric login:', error);
    set({
      isLoading: false,
      error: 'auth.security.biometric_enable_error',
    });
    return false;
  }
}

// Helper function to handle disable logic
async function disableBiometric(
  set: (state: Partial<BiometricSettingsState>) => void
): Promise<boolean> {
  set({ isLoading: true, error: null });
  try {
    await disableBiometricLogin();
    set({
      isEnabled: false,
      biometricType: undefined,
      isLoading: false,
    });
    return true;
  } catch (error) {
    console.error('Failed to disable biometric login:', error);
    set({
      isLoading: false,
      error: 'auth.security.biometric_disable_error',
    });
    return false;
  }
}

export const useBiometricSettings = create<BiometricSettingsState>(
  (set, get) => ({
    isEnabled: false,
    isAvailable: false,
    biometricType: undefined,
    isLoading: false,
    error: null,

    initialize: () => initializeBiometricState(set),
    enable: () => enableBiometric(set),
    disable: () => disableBiometric(set),
    refresh: async () => {
      await get().initialize();
    },
  })
);
