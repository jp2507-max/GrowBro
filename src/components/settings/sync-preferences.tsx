import * as React from 'react';
import { Alert } from 'react-native';

import { ItemsContainer } from '@/components/settings/items-container';
import { Button, Checkbox, Input, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { setConstraints } from '@/lib/sync/background-sync';
import { useSyncPrefs } from '@/lib/sync/preferences';
import { database } from '@/lib/watermelon';

export function SyncPreferences(): JSX.Element {
  useBindSyncConstraints();
  const { stalenessHours, setStalenessHours } = useSyncPrefs();
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
            onChangeText={(t) => setStalenessHours(Number(t))}
            testID="sync-staleness"
          />
        </View>
        <View className="pt-2">
          <Button
            label={translate('settings.sync.reset_local')}
            onPress={onResetLocal}
          />
        </View>
      </View>
    </ItemsContainer>
  );
}

function PreferencesToggles(): JSX.Element {
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
        />
      </PrefRow>
      <PrefRow labelTx="settings.sync.background">
        <Checkbox
          checked={backgroundSyncEnabled}
          onChange={(v) => setBackgroundSyncEnabled(v)}
          testID="sync-bg"
        />
      </PrefRow>
      <PrefRow labelTx="settings.sync.wifi_only">
        <Checkbox
          checked={requiresWifi}
          onChange={(v) => setRequiresWifi(v)}
          testID="sync-wifi"
        />
      </PrefRow>
      <PrefRow labelTx="settings.sync.charging_only">
        <Checkbox
          checked={requiresCharging}
          onChange={(v) => setRequiresCharging(v)}
          testID="sync-charging"
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
      translate('settings.reset_local_title'),
      translate('settings.reset_local_body'),
      [
        {
          text: translate('common.ok'),
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                // @ts-expect-error: Watermelon provides unsafeResetDatabase
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
  labelTx: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text tx={labelTx} />
      {children}
    </View>
  );
}
