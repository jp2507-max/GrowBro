import { useRouter } from 'expo-router';
import React from 'react';

import { LoginForm } from '@/components/auth/login-form';
import { FocusAwareStatusBar } from '@/components/ui';
import { consumePendingDeepLink } from '@/lib';

export default function Login() {
  const router = useRouter();

  const handleSuccess = () => {
    // After successful login, check for pending deep link or go to home
    const pendingPath = consumePendingDeepLink();
    if (pendingPath) {
      router.replace(pendingPath);
      return;
    }
    router.replace('/');
  };

  return (
    <>
      <FocusAwareStatusBar />
      <LoginForm onSuccess={handleSuccess} />
    </>
  );
}
