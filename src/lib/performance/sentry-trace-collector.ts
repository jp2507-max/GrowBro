/**
 * Sentry Trace URL Collector
 * Captures and emits Sentry transaction URLs for CI artifact collection
 */

import * as Sentry from '@sentry/react-native';

import { logSentryTransactionUrl } from './ci-export';

/**
 * Sentry trace URL storage for CI collection
 */
const traceUrls: string[] = [];

/**
 * Generate Sentry transaction URL from transaction data
 */
export function generateSentryTransactionUrl(
  transactionId: string,
  projectSlug?: string,
  orgSlug?: string
): string {
  const org = orgSlug || process.env.SENTRY_ORG || 'unknown';
  const project = projectSlug || process.env.SENTRY_PROJECT || 'unknown';

  return `https://sentry.io/organizations/${org}/performance/${project}:${transactionId}/`;
}

/**
 * Capture Sentry trace URL from a transaction
 * Emits URL to console for CI collection
 */
export function captureSentryTraceUrl(
  transactionId: string,
  transactionName?: string
): void {
  const url = generateSentryTransactionUrl(transactionId);

  // Store URL
  traceUrls.push(url);

  // Emit to console for CI collection
  logSentryTransactionUrl(url);

  // Also log with transaction name for context
  if (transactionName) {
    console.log(`[SENTRY_TRANSACTION] ${transactionName} -> ${url}`);
  }
}

/**
 * Get all captured Sentry trace URLs
 */
export function getSentryTraceUrls(): string[] {
  return [...traceUrls];
}

/**
 * Clear captured trace URLs
 */
export function clearSentryTraceUrls(): void {
  traceUrls.length = 0;
}

/**
 * Hook into Sentry to capture transaction URLs
 * Call this during app initialization after Sentry.init()
 */
export function enableSentryTraceUrlCapture(): void {
  // Add a beforeSendTransaction hook to capture transaction IDs
  Sentry.addEventProcessor((event) => {
    if (event.type === 'transaction' && event.event_id) {
      const transactionName = event.transaction || 'unknown';
      captureSentryTraceUrl(event.event_id, transactionName);
    }
    return event;
  });
}

/**
 * Export all captured trace URLs to a file (for CI)
 * This should be called at the end of a test run
 */
export async function exportSentryTraceUrlsToFile(
  filePath: string
): Promise<void> {
  // This function is primarily for Node.js/CI environments
  // In React Native, we rely on console logging for CI collection
  const urls = getSentryTraceUrls();

  if (urls.length === 0) {
    console.warn('[SENTRY_TRACE_EXPORT] No trace URLs to export');
    return;
  }

  console.log(
    `[SENTRY_TRACE_EXPORT] Exporting ${urls.length} trace URLs to ${filePath}`
  );

  // In React Native, we can't directly write to files
  // Instead, emit all URLs to console for CI collection
  for (const url of urls) {
    logSentryTransactionUrl(url);
  }
}
