/**
 * CSV Export Button Component
 *
 * Exports inventory data to RFC 4180 compliant CSV files (items.csv, batches.csv, movements.csv).
 * Handles file system permissions, export progress, and user feedback.
 *
 * Requirements: 5.1, 5.2
 */

// SDK 54 hybrid approach: Paths for directory URIs, legacy API for async operations
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Button } from '@/components/ui';
import { getCacheDirectoryUri } from '@/lib/fs/paths';
import { exportToCSV } from '@/lib/inventory/csv-export-service';
import type { CSVExportResult } from '@/lib/inventory/types/csv';

// getCacheDirectoryUri() moved to shared module '@/lib/fs/paths'

interface ExportCSVButtonProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'lg' | 'sm';
  className?: string;
  testID?: string;
}

async function shareCSVFiles(
  filePaths: string[],
  dialogTitle: string,
  sharingUnavailableMessage: string
): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Export Error', sharingUnavailableMessage);
    return;
  }

  for (const filePath of filePaths) {
    try {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle,
        UTI: 'public.comma-separated-values-text',
      });
      await new Promise((res) => setTimeout(res, 250));
    } catch (shareError) {
      console.warn('Failed to share CSV file:', filePath, shareError);
    }
  }
}

async function writeCSVFilesToDisk(
  result: CSVExportResult,
  tempDir: string
): Promise<string[]> {
  const files = [result.items, result.batches, result.movements];
  const filePaths: string[] = [];

  for (const file of files) {
    const filePath = `${tempDir}${file.filename}`;
    await FileSystem.writeAsStringAsync(filePath, file.content);
    filePaths.push(filePath);
  }

  return filePaths;
}

async function cleanupTempDir(tempDir: string | null): Promise<void> {
  if (!tempDir) return;
  try {
    const info = await FileSystem.getInfoAsync(tempDir);
    if (info.exists) {
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
    }
  } catch (cleanupError) {
    console.warn('[CSV Export] Failed to remove temp files:', cleanupError);
  }
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
    let tempDir: string | null = null;

    try {
      const result = await exportToCSV({});
      const cacheDir = getCacheDirectoryUri();
      tempDir = `${cacheDir}csv_export_${Date.now()}/`;
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

      const filePaths = await writeCSVFilesToDisk(result, tempDir);
      await shareCSVFiles(
        filePaths,
        t('inventory.csv.export_title'),
        t('inventory.csv.sharing_unavailable')
      );

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
      await cleanupTempDir(tempDir);
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
