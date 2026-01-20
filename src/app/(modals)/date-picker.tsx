import { Stack, useRouter } from 'expo-router';
import * as React from 'react';

export default function DatePickerFormSheet(): React.ReactElement {
  const router = useRouter();
  React.useEffect(() => {
    router.back();
  }, [router]);

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          headerShown: false,
        }}
      />
    </>
  );
}
