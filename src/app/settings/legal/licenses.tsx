/**
 * Open Source Licenses Screen
 * Route: /settings/legal/licenses
 * Requirements: 8.6, 8.8
 */

import React, { useState } from 'react';
import { TextInput } from 'react-native';

import {
  colors,
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import licensesData from '@/data/licenses.json';
import { translate } from '@/lib';

interface License {
  name: string;
  version: string;
  license: string;
  licenseText: string;
  repository: string;
  homepage: string;
}

const ALL_LICENSES: License[] = licensesData.packages as License[];

export default function LicensesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

  const filteredLicenses = ALL_LICENSES.filter(
    (license) =>
      license.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.license.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show license detail view
  if (selectedLicense) {
    return (
      <>
        <FocusAwareStatusBar />
        <View className="flex-1">
          <View className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedLicense(null)}
              className="flex-row items-center"
            >
              <Text className="text-primary-600 dark:text-primary-400">
                ← {translate('common.back')}
              </Text>
            </Pressable>
            <Text className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {selectedLicense.name}
            </Text>
            <Text className="text-xs text-neutral-600 dark:text-neutral-400">
              {translate('settings.legal.licenses.version_label')}:{' '}
              {selectedLicense.version} • {selectedLicense.license}
            </Text>
          </View>

          <ScrollView className="flex-1 p-4">
            <Text className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
              {selectedLicense.licenseText}
            </Text>

            {selectedLicense.repository && (
              <View className="mt-4">
                <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {translate('settings.legal.licenses.repository')}:
                </Text>
                <Text className="mt-1 text-xs text-primary-600 dark:text-primary-400">
                  {selectedLicense.repository}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </>
    );
  }

  const licenseTypes = Array.from(
    new Set(ALL_LICENSES.map((l) => l.license))
  ).sort();

  return (
    <>
      <FocusAwareStatusBar />

      <View className="flex-1">
        {/* Search Bar */}
        <View className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
          <TextInput
            accessibilityLabel={translate('settings.legal.licenses.search')}
            accessibilityRole="search"
            placeholder={translate('settings.legal.licenses.search')}
            placeholderTextColor={colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <Text className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            {translate('settings.legal.licenses.count', {
              count: filteredLicenses.length,
            })}
          </Text>
        </View>

        {/* License Types */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 px-4 py-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setSearchQuery('')}
              className="rounded-full border border-primary-600 bg-primary-50 px-4 py-2 dark:bg-primary-900/30"
            >
              <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                {translate('settings.legal.licenses.all')}
              </Text>
            </Pressable>
            {licenseTypes.map((type) => (
              <Pressable
                accessibilityRole="button"
                key={type}
                onPress={() => setSearchQuery(type)}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 dark:border-neutral-600 dark:bg-neutral-800"
              >
                <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* License List */}
        <ScrollView className="flex-1">
          <View className="px-4 pb-8">
            {filteredLicenses.map((license, index) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${license.name} version ${license.version}, ${license.license} license`}
                key={`${license.name}-${index}`}
                onPress={() => setSelectedLicense(license)}
                className="mb-2 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {license.name}
                    </Text>
                    <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {translate('settings.legal.licenses.version_label')}:{' '}
                      {license.version}
                    </Text>
                  </View>
                  <View className="rounded-full border border-primary-600 bg-primary-50 px-3 py-1 dark:bg-primary-900/30">
                    <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                      {license.license}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {filteredLicenses.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-neutral-600 dark:text-neutral-400">
                  {translate('settings.legal.licenses.no_results')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Build Note */}
        <View className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
          <Text className="text-center text-xs text-neutral-600 dark:text-neutral-400">
            {translate('settings.legal.licenses.note')}
          </Text>
        </View>
      </View>
    </>
  );
}
