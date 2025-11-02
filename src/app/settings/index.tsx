import { Env } from '@env';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { type ReactElement } from 'react';
import { Linking } from 'react-native';

import { DevDiagnosticsItem } from '@/components/settings/dev-diagnostics-item';
import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { LanguageItem } from '@/components/settings/language-item';
import { OfflineBadge } from '@/components/settings/offline-badge';
import { ProfileHeader } from '@/components/settings/profile-header';
import { SectionStatus } from '@/components/settings/section-status';
import { SyncPreferences } from '@/components/settings/sync-preferences';
import { ThemeItem } from '@/components/settings/theme-item';
import {
  colors,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Github, Rate, Share, Support, Website } from '@/components/ui/icons';
import { translate, useAuth } from '@/lib';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { usePrivacySummary } from '@/lib/hooks/use-privacy-summary';
import { useProfileStatistics } from '@/lib/hooks/use-profile-statistics';
import { provideWebDeletionUrl } from '@/lib/privacy/deletion-manager';

const privacyPolicyUrl = 'https://growbro.app/privacy';
const privacyPolicyLabel = privacyPolicyUrl.replace(/^https?:\/\//, '');

function SupportLinks({ iconColor }: { iconColor: string }): ReactElement {
  return (
    <ItemsContainer title="settings.support_us">
      <Item
        text="settings.more"
        icon={<Share color={iconColor} />}
        onPress={() => {}}
      />
      <Item
        text="settings.rate"
        icon={<Rate color={iconColor} />}
        onPress={() => {}}
      />
      <Item
        text="settings.support_us"
        icon={<Support color={iconColor} />}
        onPress={() => {}}
      />
    </ItemsContainer>
  );
}

function GeneralSettings(): ReactElement {
  return (
    <ItemsContainer title="settings.general">
      <LanguageItem />
      <ThemeItem />
    </ItemsContainer>
  );
}

function PrivacySettings({
  router,
  isOffline,
  privacyStatus,
}: {
  router: any;
  isOffline: boolean;
  privacyStatus: string;
}): ReactElement {
  const deletionUrl = provideWebDeletionUrl();
  const deletionLabel = deletionUrl
    ? deletionUrl.replace(/^https?:\/\//, '')
    : '';

  return (
    <ItemsContainer title="settings.privacy_section">
      <Item
        text="settings.security"
        onPress={() => router.push('/settings/security')}
      />
      <Item
        text="settings.privacy_and_data"
        onPress={() => router.push('/settings/privacy-and-data')}
        rightElement={<SectionStatus label={privacyStatus} />}
      />
      <Item
        text="settings.notifications.label"
        onPress={() => router.push('/settings/notifications')}
      />
      {deletionUrl && (
        <Item
          text="settings.web_deletion"
          value={deletionLabel}
          onPress={() => {
            void Linking.openURL(deletionUrl);
          }}
          rightElement={isOffline ? <OfflineBadge /> : undefined}
          disabled={isOffline}
        />
      )}
      <Item
        text="settings.privacy_policy"
        value={privacyPolicyLabel}
        onPress={() => {
          void Linking.openURL(privacyPolicyUrl);
        }}
        rightElement={isOffline ? <OfflineBadge /> : undefined}
        disabled={isOffline}
      />
    </ItemsContainer>
  );
}

function AboutSection(): ReactElement {
  return (
    <ItemsContainer title="settings.about">
      <Item text="settings.app_name" value={Env.NAME} />
      <Item text="settings.version" value={Env.VERSION} />
    </ItemsContainer>
  );
}

function LinksSection({ iconColor }: { iconColor: string }): ReactElement {
  return (
    <ItemsContainer title="settings.links">
      <Item text="settings.terms" onPress={() => {}} />
      <Item
        text="settings.github"
        icon={<Github color={iconColor} />}
        onPress={() => {}}
      />
      <Item
        text="settings.website"
        icon={<Website color={iconColor} />}
        onPress={() => {}}
      />
    </ItemsContainer>
  );
}

export default function Settings() {
  const router = useRouter();
  const signOut = useAuth.use.signOut();
  const user = useAuth.use.user();
  const { colorScheme } = useColorScheme();
  const iconColor =
    colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[500];

  // Fetch user data and summaries
  const userId = user?.id || '';
  const { isInternetReachable } = useNetworkStatus();
  const isOffline = !isInternetReachable;

  const profileStats = useProfileStatistics(userId);
  const privacySummary = usePrivacySummary();

  // Format status labels
  const privacyStatus =
    privacySummary.status === 'all_on'
      ? translate('settings.status.all_on')
      : privacySummary.status === 'all_off'
        ? translate('settings.status.all_off')
        : translate('settings.status.partial');

  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4 pt-16 ">
          <Text className="text-xl font-bold">
            {translate('settings.title')}
          </Text>

          {/* Profile Section */}
          {user && (
            <View className="mt-4">
              <ProfileHeader
                userId={userId}
                displayName={user.user_metadata?.display_name}
                avatarUrl={user.user_metadata?.avatar_url}
                statistics={profileStats.isLoading ? undefined : profileStats}
                isLoading={profileStats.isLoading}
              />
            </View>
          )}

          <GeneralSettings />

          <SyncPreferences />

          <PrivacySettings
            router={router}
            isOffline={isOffline}
            privacyStatus={privacyStatus}
          />

          <AboutSection />

          <SupportLinks iconColor={iconColor} />

          <LinksSection iconColor={iconColor} />

          <View className="my-8">
            <ItemsContainer>
              <Item text="settings.logout" onPress={signOut} />
            </ItemsContainer>
          </View>

          <DevDiagnosticsItem />
        </View>
      </ScrollView>
    </>
  );
}
