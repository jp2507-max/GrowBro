/**
 * Legal Documents Screen
 * Route: /settings/legal
 * Requirements: 8.1, 8.3
 */

import { useRouter } from 'expo-router';
import React from 'react';

import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { OfflineBadge } from '@/components/settings/offline-badge';
import {
  colors,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { FileText, Scale, Shield } from '@/components/ui/icons';
import { translate } from '@/lib';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';

export default function LegalScreen() {
  const router = useRouter();
  const { isInternetReachable } = useNetworkStatus();
  const isOffline = !isInternetReachable;

  const iconColor = colors.primary[600];

  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4 pt-4">
          <Text className="mb-1 text-xl font-bold">
            {translate('settings.legal.title')}
          </Text>
          <Text className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            {translate('settings.legal.description')}
          </Text>

          {/* Legal Documents */}
          <ItemsContainer title="settings.legal.documents">
            <Item
              text="settings.legal.terms"
              icon={<FileText color={iconColor} />}
              onPress={() => router.push('/settings/legal/terms')}
            />
            <Item
              text="settings.legal.privacy_policy"
              icon={<Shield color={iconColor} />}
              onPress={() => router.push('/settings/legal/privacy')}
            />
            <Item
              text="settings.legal.cannabis_policy"
              icon={<Scale color={iconColor} />}
              onPress={() => router.push('/settings/legal/cannabis')}
            />
          </ItemsContainer>

          {/* Open Source */}
          <ItemsContainer title="settings.legal.open_source">
            <Item
              text="settings.legal.licenses"
              icon={<FileText color={iconColor} />}
              onPress={() => router.push('/settings/legal/licenses')}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
            />
          </ItemsContainer>
        </View>
      </ScrollView>
    </>
  );
}
