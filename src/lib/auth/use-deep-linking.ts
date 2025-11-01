/**
 * Deep linking hook for authentication flows
 *
 * Handles deep links on cold start (getInitialURL) and warm start (addEventListener).
 * Integrates with auth state and pending deep link stashing for protected routes.
 */

import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';

import { handleDeepLink } from './deep-link-handler';

/**
 * Hook to handle deep links for authentication flows
 *
 * Automatically processes deep links on app start and while app is running.
 * Should be called once in the root layout component.
 *
 * @example
 * export default function RootLayout() {
 *   useDeepLinking();
 *   return <Stack />;
 * }
 */
export function useDeepLinking(): void {
  const initialUrlProcessed = useRef(false);

  useEffect(() => {
    // Handle initial URL (cold start)
    const handleInitialUrl = async () => {
      try {
        const url = await Linking.getInitialURL();

        if (url && !initialUrlProcessed.current) {
          initialUrlProcessed.current = true;
          await handleDeepLink(url);
        }
      } catch (error) {
        console.error('Error handling initial URL:', error);
      }
    };

    handleInitialUrl();

    // Handle URL changes (warm start - app is already running)
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url) {
        handleDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
