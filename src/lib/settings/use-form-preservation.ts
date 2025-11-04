/**
 * React hook for form preservation across re-auth flows
 *
 * Requirement: 12.5
 */

import { useCallback, useEffect } from 'react';

import type { PreservedFormState } from './form-preservation';
import {
  clearPreservedState,
  preserveFormState,
  restoreFormState,
} from './form-preservation';

interface UseFormPreservationOptions<T> {
  screenName: string;
  onRestore?: (state: PreservedFormState<T>) => void;
  autoRestore?: boolean;
}

interface UseFormPreservationReturn<T> {
  preserve: (
    formData: T,
    options?: {
      validationState?: Record<string, string | undefined>;
      dirtyFields?: string[];
    }
  ) => void;
  restore: () => PreservedFormState<T> | null;
  clear: () => void;
}

/**
 * Hook for managing form state preservation across re-auth
 *
 * @example
 * ```tsx
 * const { preserve, restore } = useFormPreservation({
 *   screenName: 'profile-edit',
 *   onRestore: (state) => {
 *     form.reset(state.formData);
 *   },
 * });
 *
 * // Before re-auth
 * const handleSecureAction = () => {
 *   preserve(form.getValues());
 *   navigateToReAuth();
 * };
 *
 * // After successful re-auth
 * useEffect(() => {
 *   const restored = restore();
 *   if (restored) {
 *     form.reset(restored.formData);
 *   }
 * }, []);
 * ```
 */
export function useFormPreservation<T = Record<string, unknown>>(
  options: UseFormPreservationOptions<T>
): UseFormPreservationReturn<T> {
  const { screenName, onRestore, autoRestore = true } = options;

  // Auto-restore on mount
  useEffect(() => {
    if (autoRestore) {
      const restored = restoreFormState<T>(screenName);
      if (restored) {
        onRestore?.(restored);
      }
    }
  }, [screenName, onRestore, autoRestore]);

  // Clear on unmount
  useEffect(() => {
    return () => {
      // Only clear if user navigates away without completing the flow
      // Don't clear immediately to allow restoration on re-mount
    };
  }, []);

  const preserve = useCallback(
    (
      formData: T,
      preserveOptions?: {
        validationState?: Record<string, string | undefined>;
        dirtyFields?: string[];
      }
    ) => {
      preserveFormState(screenName, formData, preserveOptions);
    },
    [screenName]
  );

  const restore = useCallback(() => {
    return restoreFormState<T>(screenName);
  }, [screenName]);

  const clear = useCallback(() => {
    clearPreservedState(screenName);
  }, [screenName]);

  return {
    preserve,
    restore,
    clear,
  };
}
