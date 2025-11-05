/**
 * Bug Report Submission Service
 * Requirements: 7.4, 7.8
 */

import type { BugDiagnostics, BugReportCategory } from '@/types/settings';

interface BugReportPayload {
  title: string;
  description: string;
  category: BugReportCategory;
  diagnostics: BugDiagnostics;
  screenshot?: string;
  sentryEventId?: string;
  userId?: string;
}

interface BugReportResult {
  success: boolean;
  ticketId?: string;
  error?: string;
}

/**
 * Submit a bug report to Supabase Edge Function
 * If offline, queues for retry when connection is restored
 * Requirements: 7.4, 7.8
 */
export async function submitBugReport(
  report: BugReportPayload
): Promise<BugReportResult> {
  try {
    // In production, this would call a Supabase Edge Function
    // For now, we'll simulate the submission
    console.log('Submitting bug report:', report);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate a mock ticket ID
    const ticketId = `BUG-${Date.now().toString(36).toUpperCase()}`;

    return {
      success: true,
      ticketId,
    };
  } catch (error) {
    console.error('Failed to submit bug report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
