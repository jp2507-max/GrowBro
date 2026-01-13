import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert } from 'react-native';

import { ItemsContainer } from '@/components/settings/items-container';
import { Button, Checkbox, Input, Text, View } from '@/components/ui';
import { translate, type TxKeyPath } from '@/lib';
import { setConstraints } from '@/lib/sync/background-sync';
import { useSyncPrefs } from '@/lib/sync/preferences';
import { database } from '@/lib/watermelon';

export function SyncPreferences(): React.ReactElement {
  const router = useRouter();
  const { hydrate, stalenessHours, setStalenessHours } = useSyncPrefs();

  // Hydrate persisted preferences from MMKV storage on mount
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  useBindSyncConstraints();
  const onResetLocal = useResetLocal();

  return (
    <ItemsContainer title="settings.sync.title">
      <View className="px-4 py-2">
        <PreferencesToggles />
        <View className="py-2">
          <Input
            label={translate('settings.sync.staleness_hours')}
            keyboardType="number-pad"
            value={String(stalenessHours)}
            onChangeText={(t) => {
              if (t.trim() === '') return;

              const n = parseInt(t, 10);
              if (Number.isNaN(n)) return;

              const clamped = Math.max(0, Math.min(Math.floor(n), 168)); // 0-168 hours (1 week)
              setStalenessHours(clamped);
            }}
            testID="sync-staleness"
          />
        </View>
        <View className="pt-2">
          <Button
            label={translate('settings.sync.reset_local')}
            onPress={onResetLocal}
          />
        </View>
        {__DEV__ ? (
          <View className="pt-2">
            <Button
              label={translate('diagnostics.title')}
              variant="outline"
              onPress={() => router.push('/sync-diagnostics')}
              accessibilityLabel={translate('diagnostics.title')}
              accessibilityHint={translate('sync.offline_banner_action_hint')}
              testID="sync-open-diagnostics"
            />
          </View>
        ) : null}
      </View>
    </ItemsContainer>
  );
}

function PreferencesToggles(): React.ReactElement {
  const {
    autoSyncEnabled,
    backgroundSyncEnabled,
    requiresWifi,
    requiresCharging,
    setAutoSyncEnabled,
    setBackgroundSyncEnabled,
    setRequiresWifi,
    setRequiresCharging,
  } = useSyncPrefs();
  return (
    <>
      <PrefRow labelTx="settings.sync.auto_sync">
        <Checkbox
          checked={autoSyncEnabled}
          onChange={(v) => setAutoSyncEnabled(v)}
          testID="sync-auto"
          accessibilityLabel={translate('settings.sync.auto_sync')}
          accessibilityHint={translate('accessibility.common.toggle_hint')}
        />
      </PrefRow>
      <PrefRow labelTx="settings.sync.background">
        <Checkbox
          checked={backgroundSyncEnabled}
          onChange={(v) => setBackgroundSyncEnabled(v)}
          testID="sync-bg"
          accessibilityLabel={translate('settings.sync.background')}
          accessibilityHint={translate('accessibility.common.toggle_hint')}
        />
      </PrefRow>
      <PrefRow labelTx="settings.sync.wifi_only">
        <Checkbox
          checked={requiresWifi}
          onChange={(v) => setRequiresWifi(v)}
          testID="sync-wifi"
          accessibilityLabel={translate('settings.sync.wifi_only')}
          accessibilityHint={translate('accessibility.common.toggle_hint')}
        />
      </PrefRow>
      <PrefRow labelTx="settings.sync.charging_only">
        <Checkbox
          checked={requiresCharging}
          onChange={(v) => setRequiresCharging(v)}
          testID="sync-charging"
          accessibilityLabel={translate('settings.sync.charging_only')}
          accessibilityHint={translate('accessibility.common.toggle_hint')}
        />
      </PrefRow>
    </>
  );
}

function useBindSyncConstraints(): void {
  const { requiresWifi, requiresCharging } = useSyncPrefs();
  React.useEffect(() => {
    setConstraints({
      requiresWifi,
      requiresCharging,
      minimumIntervalMinutes: 15,
    });
  }, [requiresWifi, requiresCharging]);
}

function useResetLocal(): () => void {
  return React.useCallback(() => {
    Alert.alert(
      translate('settings.sync.reset_local_title'),
      translate('settings.sync.reset_local_body'),
      [
        {
          text: translate('common.ok'),
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                await database.unsafeResetDatabase();
              });
            } catch (e) {
              console.warn('Reset local cache failed', e);
            }
          },
        },
        { text: translate('common.cancel'), style: 'cancel' as const },
      ]
    );
  }, []);
}

function PrefRow({
  labelTx,
  children,
}: {
  labelTx: TxKeyPath;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text tx={labelTx} />
      {children}
    </View>
  );
}
