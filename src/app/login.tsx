import { useRouter } from 'expo-router';
import React from 'react';

import { LoginForm } from '@/components/auth/login-form';
import { FocusAwareStatusBar } from '@/components/ui';
import { consumePendingDeepLink, useAuth } from '@/lib';

export default function Login() {
  const router = useRouter();
  const authStatus = useAuth.use.status();

  // Navigate to app when auth status changes to signIn
  React.useEffect(() => {
    if (authStatus === 'signIn') {
      const pendingPath = consumePendingDeepLink();
      if (pendingPath) {
        router.replace(pendingPath);
        return;
      }
      router.replace('/');
    }
  }, [authStatus, router]);

  // onSuccess no longer handles navigation - auth state change does
  const handleSuccess = React.useCallback(() => {
    // Navigation is handled by the useEffect above
    // This callback is kept for any immediate post-login cleanup if needed
  }, []);

  return (
    <>
      <FocusAwareStatusBar />
      <LoginForm onSuccess={handleSuccess} />
    </>
  );
}
