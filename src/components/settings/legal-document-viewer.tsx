/**
 * Legal Document Viewer Component
 * Renders markdown legal documents with offline support
 * Requirements: 8.2, 8.10
 */

import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-native-markdown-display';

import { OfflineBadge } from '@/components/settings/offline-badge';
import {
  ActivityIndicator,
  colors,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { translate } from '@/lib';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import i18n from '@/lib/i18n';
import {
  getLastSyncTimestamp,
  getLegalDocument,
} from '@/lib/legal/legal-documents-service';
import type { LegalDocument, LegalDocumentType } from '@/types/settings';

interface LegalDocumentViewerProps {
  documentType: LegalDocumentType;
}

// eslint-disable-next-line max-lines-per-function -- Complex document rendering with markdown styles
export function LegalDocumentViewer({
  documentType,
}: LegalDocumentViewerProps) {
  const { colorScheme } = useColorScheme();
  const { isInternetReachable } = useNetworkStatus();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<string | undefined>();

  const languageCode = i18n.language || 'en';
  const locale = languageCode === 'de' ? 'de' : 'en';

  useEffect(() => {
    async function loadDocument() {
      setLoading(true);
      try {
        const doc = await getLegalDocument(documentType, locale);
        setDocument(doc);
        const timestamp = getLastSyncTimestamp();
        setLastSynced(timestamp);
      } catch (error) {
        console.error('Failed to load legal document:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadDocument();
  }, [documentType, languageCode, locale]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!document) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-center text-neutral-600 dark:text-neutral-400">
          {translate('settings.legal.document_not_available')}
        </Text>
      </View>
    );
  }

  const content = document.content[locale];
  const isDark = colorScheme === 'dark';

  const markdownStyles = {
    body: {
      color: isDark ? colors.neutral[100] : colors.neutral[900],
      fontSize: 15,
      lineHeight: 24,
    },
    heading1: {
      color: isDark ? colors.neutral[50] : colors.neutral[900],
      fontSize: 24,
      fontWeight: 'bold' as const,
      marginTop: 24,
      marginBottom: 16,
    },
    heading2: {
      color: isDark ? colors.neutral[100] : colors.neutral[800],
      fontSize: 20,
      fontWeight: 'bold' as const,
      marginTop: 20,
      marginBottom: 12,
    },
    heading3: {
      color: isDark ? colors.neutral[200] : colors.neutral[700],
      fontSize: 18,
      fontWeight: '600' as const,
      marginTop: 16,
      marginBottom: 8,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 12,
      color: isDark ? colors.neutral[300] : colors.neutral[700],
    },
    listItem: {
      marginBottom: 8,
      color: isDark ? colors.neutral[300] : colors.neutral[700],
    },
    link: {
      color: colors.primary[600],
      textDecorationLine: 'underline' as const,
    },
    strong: {
      fontWeight: 'bold' as const,
      color: isDark ? colors.neutral[100] : colors.neutral[900],
    },
    em: {
      fontStyle: 'italic' as const,
    },
    blockquote: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
      borderLeftColor: colors.primary[600],
      borderLeftWidth: 4,
      paddingLeft: 16,
      paddingVertical: 8,
      marginVertical: 12,
    },
    code_inline: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
      color: colors.primary[600],
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
      padding: 12,
      borderRadius: 8,
      marginVertical: 12,
      fontFamily: 'monospace',
    },
  };

  const formattedDate = lastSynced
    ? DateTime.fromISO(lastSynced).toLocaleString(DateTime.DATE_MED)
    : DateTime.fromISO(document.lastUpdated).toLocaleString(DateTime.DATE_MED);

  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView className="flex-1">
        <View className="px-4 pt-4">
          {/* Header with version and sync info */}
          <View className="mb-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {translate('settings.legal.version')}
                </Text>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {document.version}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {translate('settings.legal.last_updated')}
                </Text>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {formattedDate}
                </Text>
              </View>
            </View>

            {!isInternetReachable && (
              <View className="mt-3 flex-row items-center">
                <OfflineBadge />
                <Text className="ml-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {translate('settings.legal.may_be_outdated')}
                </Text>
              </View>
            )}
          </View>

          {/* Document content */}
          <View className="pb-8">
            <Markdown style={markdownStyles}>{content}</Markdown>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
