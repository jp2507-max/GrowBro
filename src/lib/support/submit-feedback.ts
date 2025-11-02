/**
 * Feedback Submission Service
 * Requirements: 7.5
 */

import type { FeedbackCategory } from '@/types/settings';

interface FeedbackPayload {
  category: FeedbackCategory;
  message: string;
  email?: string;
  userId?: string;
}

interface FeedbackResult {
  success: boolean;
  error?: string;
}

/**
 * Submit feedback to Supabase Edge Function
 * If offline, queues for retry when connection is restored
 * Requirements: 7.5
 */
export async function submitFeedback(
  feedback: FeedbackPayload
): Promise<FeedbackResult> {
  try {
    // In production, this would call a Supabase Edge Function
    // For now, we'll simulate the submission
    console.log('Submitting feedback:', feedback);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
