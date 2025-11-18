/**
 * CSV Import Button Component
 *
 * Handles CSV file selection, validation, and import with dry-run preview.
 * Implements RFC 4180 parsing and idempotent upserts by external_key.
 *
 * Requirements: 5.2, 5.3, 5.4
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'react-native-flash-message';

import { Button } from '@/components/ui';
import { previewCSVImport } from '@/lib/inventory/csv-import-service';

interface ImportCSVButtonProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'lg' | 'sm';
  className?: string;
  testID?: string;
}

export function ImportCSVButton({
  variant = 'default',
  size = 'default',
  className,
  testID = 'import-csv-button',
}: ImportCSVButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = React.useState(false);

  const handleImport = React.useCallback(async () => {
    setIsImporting(true);

    try {
      // Pick CSV file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsImporting(false);
        return;
      }

      const asset = result.assets[0];
      const fileUri = asset.uri;

      // Read file content
      const content = await FileSystem.readAsStringAsync(fileUri);

      // Determine file type from name
      const fileName = asset.name.toLowerCase();
      const files: {
        items?: string;
        batches?: string;
        movements?: string;
      } = {};

      if (fileName.includes('batch')) {
        files.batches = content;
      } else if (fileName.includes('movement')) {
        files.movements = content;
      } else {
        files.items = content;
      }

      // Preview import
      const preview = await previewCSVImport(files);

      // Navigate to preview screen with preview data
      router.push({
        pathname: '/(app)/inventory/csv-import-preview',
        params: {
          fileName: asset.name,
          previewData: JSON.stringify(preview),
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      showMessage({
        message: t('inventory.csv.import_error_title'),
        description: errorMessage,
        type: 'danger',
        duration: 5000,
      });

      console.error('CSV import failed:', error);
    } finally {
      setIsImporting(false);
    }
  }, [t]);

  return (
    <Button
      label={t('inventory.csv.import_button')}
      onPress={handleImport}
      loading={isImporting}
      disabled={isImporting}
      variant={variant}
      size={size}
      className={className}
      testID={testID}
    />
  );
}
