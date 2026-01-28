import { Link } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { translate } from '@/lib/i18n';

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 p-6 dark:bg-charcoal-950">
      <Text className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
        {translate('errors.page_not_found.title')}
      </Text>
      <Text className="mb-6 text-center text-neutral-600 dark:text-neutral-400">
        {translate('errors.page_not_found.description')}
      </Text>
      <Link href="/" asChild>
        <Text className="text-primary-800 dark:text-primary-300">
          {translate('common.go_home')}
        </Text>
      </Link>
    </View>
  );
}
