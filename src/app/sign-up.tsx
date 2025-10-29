import { useRouter } from 'expo-router';
import React from 'react';

import { SignUpForm } from '@/components/auth';
import { FocusAwareStatusBar } from '@/components/ui';
import { consumePendingDeepLink } from '@/lib';

export default function SignUp() {
  const router = useRouter();

  const handleSuccess = () => {
    // After successful signup, redirect to login or check for pending deep link
    const pendingPath = consumePendingDeepLink();
    if (pendingPath) {
      router.replace(pendingPath);
      return;
    }
    // Navigate to login screen
    router.replace('/login');
  };

  return (
    <>
      <FocusAwareStatusBar />
      <SignUpForm onSuccess={handleSuccess} />
    </>
  );
}
