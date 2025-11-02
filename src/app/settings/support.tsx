/**
 * Support Screen
 * Route: /settings/support
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { Linking } from 'react-native';

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
import {
  Bug,
  Feedback as FeedbackIcon,
  HelpCircle,
  Mail,
  Shield,
} from '@/components/ui/icons';
import { translate } from '@/lib';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';

const HELP_CENTER_URL = 'https://growbro.app/help';
const SUPPORT_EMAIL = 'support@growbro.app';
const COMMUNITY_GUIDELINES_URL = 'https://growbro.app/community-guidelines';

export default function SupportScreen() {
  const router = useRouter();
  const { isInternetReachable } = useNetworkStatus();
  const isOffline = !isInternetReachable;

  const iconColor = colors.primary[600];

  const handleHelpCenter = async () => {
    try {
      const canOpen = await Linking.canOpenURL(HELP_CENTER_URL);
      if (canOpen) {
        await Linking.openURL(HELP_CENTER_URL);
      }
    } catch (error) {
      console.error('Failed to open help center:', error);
    }
  };

  const handleContactSupport = async () => {
    try {
      const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        translate('settings.support.contact.subject')
      )}&body=${encodeURIComponent(
        translate('settings.support.contact.body_template')
      )}`;

      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      }
    } catch (error) {
      console.error('Failed to open email client:', error);
    }
  };

  const handleCommunityGuidelines = async () => {
    try {
      const canOpen = await Linking.canOpenURL(COMMUNITY_GUIDELINES_URL);
      if (canOpen) {
        await Linking.openURL(COMMUNITY_GUIDELINES_URL);
      }
    } catch (error) {
      console.error('Failed to open community guidelines:', error);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4 pt-4">
          <Text className="mb-1 text-xl font-bold">
            {translate('settings.support.title')}
          </Text>
          <Text className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            {translate('settings.support.description')}
          </Text>

          {/* Help Resources */}
          <ItemsContainer title="settings.support.help_resources">
            <Item
              text="settings.support.help_center"
              icon={<HelpCircle color={iconColor} />}
              onPress={handleHelpCenter}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
              disabled={isOffline}
            />
            <Item
              text="settings.support.community_guidelines"
              icon={<Shield color={iconColor} />}
              onPress={handleCommunityGuidelines}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
              disabled={isOffline}
            />
          </ItemsContainer>

          {/* Contact & Feedback */}
          <ItemsContainer title="settings.support.contact_feedback">
            <Item
              text="settings.support.contact_support"
              icon={<Mail color={iconColor} />}
              onPress={handleContactSupport}
            />
            <Item
              text="settings.support.report_bug"
              icon={<Bug color={iconColor} />}
              onPress={() => router.push('/settings/support/report-bug')}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
              disabled={isOffline}
            />
            <Item
              text="settings.support.send_feedback"
              icon={<FeedbackIcon color={iconColor} />}
              onPress={() => router.push('/settings/support/feedback')}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
              disabled={isOffline}
            />
          </ItemsContainer>
        </View>
      </ScrollView>
    </>
  );
}
