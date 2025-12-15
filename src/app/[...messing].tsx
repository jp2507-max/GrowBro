import { Link, Stack } from 'expo-router';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: translate('notFound.title') }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-2xl font-bold" tx="notFound.body" />

        <Link href="/" className="mt-4">
          <Text
            className="text-primary-600 underline dark:text-primary-400"
            tx="notFound.goHomeCta"
          />
        </Link>
      </View>
    </>
  );
}
