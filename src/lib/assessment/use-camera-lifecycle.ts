import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Hook to manage camera lifecycle based on app state
 * Pauses camera when app goes to background, resumes when returning to foreground
 */
export function useCameraLifecycle() {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setIsActive(true);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsActive(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return { isActive };
}
