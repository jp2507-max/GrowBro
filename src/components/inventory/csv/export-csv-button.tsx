/**
 * CSV Export Button Component
 *
 * Exports inventory data to RFC 4180 compliant CSV files (items.csv, batches.csv, movements.csv).
 * Handles file system permissions, export progress, and user feedback.
 *
 * Requirements: 5.1, 5.2
 */

// SDK 54 hybrid approach: Paths for directory URIs, legacy API for async operations
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Button } from '@/components/ui';
import { exportToCSV } from '@/lib/inventory/csv-export-service';

/**
 * Get the cache directory URI using the new Paths API.
 * Includes defensive validation to fail loudly if the URI is unavailable.
 */
function getCacheDirectoryUri(): string {
  const uri = Paths?.cache?.uri;
  if (!uri) {
    throw new Error(
      '[FileSystem] Cache directory unavailable. Ensure expo-file-system is properly linked.'
    );
  }
  return uri;
}

interface ExportCSVButtonProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'lg' | 'sm';
  className?: string;
  testID?: string;
}

export function ExportCSVButton({
  variant = 'outline',
  size = 'default',
  className,
  testID = 'export-csv-button',
}: ExportCSVButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = React.useCallback(async () => {
    setIsExporting(true);

    try {
      // Export to CSV
      const result = await exportToCSV({});

      // Get cache directory using Paths API
      const cacheDir = getCacheDirectoryUri();

      // Create temporary directory for CSV files
      const tempDir = `${cacheDir}csv_export_${Date.now()}/`;
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      // Write CSV files to temporary directory
      const files = [result.items, result.batches, result.movements];

      const filePaths: string[] = [];
      for (const file of files) {
        const filePath = `${tempDir}${file.filename}`;
        await FileSystem.writeAsStringAsync(filePath, file.content);
        filePaths.push(filePath);
      }

      // Share files based on platform
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          // Share first file with option to share all
          await Sharing.shareAsync(filePaths[0], {
            mimeType: 'text/csv',
            dialogTitle: t('inventory.csv.export_title'),
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          Alert.alert(
            t('inventory.csv.export_error_title'),
            t('inventory.csv.sharing_unavailable')
          );
        }
      }

      showMessage({
        message: t('inventory.csv.export_success_title'),
        description: t('inventory.csv.export_success_description', {
          itemCount: result.items.rowCount,
          batchCount: result.batches.rowCount,
          movementCount: result.movements.rowCount,
        }),
        type: 'success',
        duration: 4000,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      showMessage({
        message: t('inventory.csv.export_error_title'),
        description: errorMessage,
        type: 'danger',
        duration: 5000,
      });

      console.error('CSV export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  return (
    <Button
      label={t('inventory.csv.export_button')}
      onPress={handleExport}
      loading={isExporting}
      disabled={isExporting}
      variant={variant}
      size={size}
      className={className}
      testID={testID}
    />
  );
}
