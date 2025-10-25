import { Platform } from 'react-native';

import type { ExecutionProvider } from '@/types/assessment';

import { getExecutionProvidersForPlatform } from './model-config';

/**
 * Execution Provider Configuration
 * Manages ONNX Runtime execution providers (XNNPACK, NNAPI, CoreML)
 */

export type ExecutionProviderConfig = {
  name: ExecutionProvider;
  available: boolean;
  priority: number;
};

/**
 * Check if execution provider is available on current platform
 */
export function isExecutionProviderAvailable(
  provider: ExecutionProvider
): boolean {
  const platform = Platform.OS;

  switch (provider) {
    case 'xnnpack':
      // XNNPACK availability depends on platform and build configuration
      // - Android: Generally available in prebuilt packages
      // - iOS: Only available if explicitly enabled at build time
      // Since we can't detect runtime availability, assume available on Android
      // but conservatively return false on iOS to avoid runtime failures
      return platform === 'android';

    case 'cpu':
      // CPU fallback is always available
      return true;

    case 'nnapi':
      // NNAPI is Android-only
      return platform === 'android';

    case 'coreml':
      // CoreML is iOS-only
      return platform === 'ios';

    default:
      return false;
  }
}

/**
 * Get available execution providers for current platform
 * Returns providers in order of preference
 */
export function getAvailableExecutionProviders(): ExecutionProviderConfig[] {
  const preferredProviders = getExecutionProvidersForPlatform();

  return preferredProviders
    .map((provider, index) => ({
      name: provider,
      available: isExecutionProviderAvailable(provider),
      priority: index, // Lower number = higher priority
    }))
    .filter((config) => config.available);
}

/**
 * Get best available execution provider
 * Returns the highest priority available provider
 */
export function getBestExecutionProvider(): ExecutionProvider {
  const available = getAvailableExecutionProviders();

  if (available.length === 0) {
    // Fallback to CPU if nothing else is available
    return 'cpu';
  }

  // Return highest priority (lowest priority number)
  return available[0].name;
}

/**
 * Create ONNX Runtime session options with execution providers
 * Note: Actual ONNX Runtime integration will use these configurations
 */
export function createSessionOptions(preferredProvider?: ExecutionProvider): {
  executionProviders: ExecutionProvider[];
  graphOptimizationLevel: 'all' | 'extended' | 'basic' | 'disabled';
} {
  const available = getAvailableExecutionProviders();

  // If preferred provider is specified and available, prioritize it
  let providers: ExecutionProvider[];
  if (preferredProvider && isExecutionProviderAvailable(preferredProvider)) {
    providers = [
      preferredProvider,
      ...available
        .filter((p) => p.name !== preferredProvider)
        .map((p) => p.name),
    ];
  } else {
    providers = available.map((p) => p.name);
  }

  // Ensure CPU fallback is always included
  if (!providers.includes('cpu')) {
    providers.push('cpu');
  }

  return {
    executionProviders: providers,
    graphOptimizationLevel: 'all', // Enable all optimizations
  };
}

/**
 * Log execution provider information for telemetry
 */
export function logExecutionProviderInfo(
  activeProvider: ExecutionProvider
): void {
  const available = getAvailableExecutionProviders();

  console.log('[ExecutionProviders] Active provider:', activeProvider);
  console.log(
    '[ExecutionProviders] Available providers:',
    available.map((p) => p.name).join(', ')
  );
  console.log('[ExecutionProviders] Platform:', Platform.OS);
}

/**
 * Get execution provider display name for UI
 */
export function getExecutionProviderDisplayName(
  provider: ExecutionProvider
): string {
  switch (provider) {
    case 'xnnpack':
      return 'XNNPACK (CPU)';
    case 'nnapi':
      return 'NNAPI (Android Neural Networks)';
    case 'coreml':
      return 'CoreML (Apple Neural Engine)';
    case 'cpu':
      return 'CPU';
  }
}
