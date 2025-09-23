import { Env } from '@env';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { type ReactElement } from 'react';
import { Linking } from 'react-native';

import { DevDiagnosticsItem } from '@/components/settings/dev-diagnostics-item';
import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { LanguageItem } from '@/components/settings/language-item';
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
import { provideWebDeletionUrl } from '@/lib/privacy/deletion-manager';

const privacyPolicyUrl = 'https://growbro.app/privacy';
const privacyPolicyLabel = privacyPolicyUrl.replace(/^https?:\/\//, '');

function SupportLinks({ iconColor }: { iconColor: string }): ReactElement {
  return (
    <ItemsContainer title="settings.support_us">
      <Item
        text="settings.share"
        icon={<Share color={iconColor} />}
        onPress={() => {}}
      />
      <Item
        text="settings.rate"
        icon={<Rate color={iconColor} />}
        onPress={() => {}}
      />
      <Item
        text="settings.support"
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

function PrivacySettings({ router }: { router: any }): ReactElement {
  const deletionUrl = provideWebDeletionUrl();
  const deletionLabel = deletionUrl
    ? deletionUrl.replace(/^https?:\/\//, '')
    : '';

  return (
    <ItemsContainer title="settings.privacy_section">
      <Item
        text="settings.privacy_and_data"
        onPress={() => router.push('/(app)/settings/privacy-and-data')}
      />
      {deletionUrl && (
        <Item
          text="settings.web_deletion"
          value={deletionLabel}
          onPress={() => {
            void Linking.openURL(deletionUrl);
          }}
        />
      )}
      <Item
        text="settings.privacy_policy"
        value={privacyPolicyLabel}
        onPress={() => {
          void Linking.openURL(privacyPolicyUrl);
        }}
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
  const { colorScheme } = useColorScheme();
  const iconColor =
    colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[500];

  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4 pt-16 ">
          <Text className="text-xl font-bold">
            {translate('settings.title')}
          </Text>
          <GeneralSettings />

          <SyncPreferences />

          <PrivacySettings router={router} />

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
