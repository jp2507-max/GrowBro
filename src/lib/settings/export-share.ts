/**
 * Export Share Sheet Integration
 * Presents data exports via platform share sheet
 *
 * Requirement: 5.6
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { generatePrivacyExportJson } from '@/lib/privacy/export-service';

/**
 * Generate filename with expiry date
 */
function generateExportFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]!.replace(/-/g, '');

  // Calculate expiry date (7 days from now)
  const expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiryStr = expiryDate.toISOString().split('T')[0]!.replace(/-/g, '');

  return `growbro-export-${dateStr}-expires-${expiryStr}.json`;
}

/**
 * Write export data to temporary file
 */
async function writeExportToFile(
  data: string,
  filename: string
): Promise<string> {
  // Use Paths.cache directory
  const file = new FileSystem.File(FileSystem.Paths.cache, filename);
  await file.write(data);
  return file.uri;
}

/**
 * Check if sharing is available on this platform
 */
async function isSharingAvailable(): Promise<boolean> {
  return await Sharing.isAvailableAsync();
}

export interface ExportShareResult {
  success: boolean;
  error?: string;
}

/**
 * Present data export via platform share sheet
 *
 * @returns Result indicating success or failure
 */
export async function presentExportViaShareSheet(): Promise<ExportShareResult> {
  try {
    // Check if sharing is available
    if (!(await isSharingAvailable())) {
      return {
        success: false,
        error: 'Sharing is not available on this device',
      };
    }

    // Generate export data
    const exportJson = await generatePrivacyExportJson();

    // Check size (warn if >10MB)
    const sizeBytes = new Blob([exportJson]).size;
    const sizeMB = sizeBytes / (1024 * 1024);

    if (sizeMB > 10) {
      console.warn(`[ExportShare] Large export: ${sizeMB.toFixed(2)}MB`);
      // TODO: Consider chunking or compression for large exports
    }

    // Generate filename with expiry date
    const filename = generateExportFilename();

    // Write to temporary file
    const fileUri = await writeExportToFile(exportJson, filename);

    // Present share sheet
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Your GrowBro Data',
      UTI: 'public.json', // iOS UTI for JSON files
    });

    // Clean up temporary file after a delay
    // Give the system time to read the file before deleting
    setTimeout(async () => {
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (error) {
        console.error('[ExportShare] Failed to clean up temp file:', error);
      }
    }, 5000);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[ExportShare] Failed to present share sheet:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get estimated export size in MB
 * Useful for showing progress indicators
 */
export async function getEstimatedExportSize(): Promise<number> {
  try {
    const exportJson = await generatePrivacyExportJson();
    const sizeBytes = new Blob([exportJson]).size;
    return sizeBytes / (1024 * 1024);
  } catch {
    return 0;
  }
}

/**
 * Format expiry notice for display
 */
export function formatExpiryNotice(daysUntilExpiry: number = 7): string {
  const expiryDate = new Date(
    Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000
  );
  return `Export expires on ${expiryDate.toLocaleDateString()}`;
}
