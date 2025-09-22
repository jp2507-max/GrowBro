import { client } from '@/api/common';
import { categorizeError } from '@/lib/error-handling';

export type ReportPayload = { contentId: string | number; reason: string };
export type SimpleUserPayload = { userId: string | number };
export type DeletePayload = { contentId: string | number };

export async function apiReportContent(payload: ReportPayload): Promise<void> {
  const endpoint = '/moderation/report';
  const contextId = `contentId: ${payload.contentId}`;

  try {
    const response = await client.post(endpoint, payload);

    // Validate response
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Failed to report content (${contextId}): HTTP ${response.status}`
      );
      console.error(`Moderation API Error [${endpoint}]`, {
        contextId,
        payload,
        status: response.status,
        data: response.data,
      });
      throw error;
    }
  } catch (error) {
    const categorizedError = categorizeError(error);
    console.error(`Moderation API Error [${endpoint}]`, {
      contextId,
      payload,
      error: categorizedError,
      originalError: error,
    });

    // Throw user-friendly error message
    if (categorizedError.category === 'permission') {
      throw new Error('You do not have permission to report this content.');
    } else if (categorizedError.category === 'rate_limit') {
      throw new Error('Too many reports submitted. Please try again later.');
    } else if (categorizedError.category === 'network') {
      throw new Error(
        'Network error while reporting content. Please check your connection.'
      );
    } else {
      throw new Error('Failed to report content. Please try again.');
    }
  }
}

export async function apiBlockUser(payload: SimpleUserPayload): Promise<void> {
  const endpoint = '/moderation/block';
  const contextId = `userId: ${payload.userId}`;

  try {
    const response = await client.post(endpoint, payload);

    // Validate response
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Failed to block user (${contextId}): HTTP ${response.status}`
      );
      console.error(`Moderation API Error [${endpoint}]`, {
        contextId,
        payload,
        status: response.status,
        data: response.data,
      });
      throw error;
    }
  } catch (error) {
    const categorizedError = categorizeError(error);
    console.error(`Moderation API Error [${endpoint}]`, {
      contextId,
      payload,
      error: categorizedError,
      originalError: error,
    });

    // Throw user-friendly error message
    if (categorizedError.category === 'permission') {
      throw new Error('You do not have permission to block this user.');
    } else if (categorizedError.category === 'rate_limit') {
      throw new Error('Too many block requests. Please try again later.');
    } else if (categorizedError.category === 'conflict') {
      throw new Error('This user is already blocked.');
    } else if (categorizedError.category === 'network') {
      throw new Error(
        'Network error while blocking user. Please check your connection.'
      );
    } else {
      throw new Error('Failed to block user. Please try again.');
    }
  }
}

export async function apiMuteUser(payload: SimpleUserPayload): Promise<void> {
  const endpoint = '/moderation/mute';
  const contextId = `userId: ${payload.userId}`;

  try {
    const response = await client.post(endpoint, payload);

    // Validate response
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Failed to mute user (${contextId}): HTTP ${response.status}`
      );
      console.error(`Moderation API Error [${endpoint}]`, {
        contextId,
        payload,
        status: response.status,
        data: response.data,
      });
      throw error;
    }
  } catch (error) {
    const categorizedError = categorizeError(error);
    console.error(`Moderation API Error [${endpoint}]`, {
      contextId,
      payload,
      error: categorizedError,
      originalError: error,
    });

    // Throw user-friendly error message
    if (categorizedError.category === 'permission') {
      throw new Error('You do not have permission to mute this user.');
    } else if (categorizedError.category === 'rate_limit') {
      throw new Error('Too many mute requests. Please try again later.');
    } else if (categorizedError.category === 'conflict') {
      throw new Error('This user is already muted.');
    } else if (categorizedError.category === 'network') {
      throw new Error(
        'Network error while muting user. Please check your connection.'
      );
    } else {
      throw new Error('Failed to mute user. Please try again.');
    }
  }
}

export async function apiDeleteOwnContent(
  payload: DeletePayload
): Promise<void> {
  const endpoint = '/moderation/delete';
  const contextId = `contentId: ${payload.contentId}`;

  try {
    const response = await client.post(endpoint, payload);

    // Validate response
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        `Failed to delete content (${contextId}): HTTP ${response.status}`
      );
      console.error(`Moderation API Error [${endpoint}]`, {
        contextId,
        payload,
        status: response.status,
        data: response.data,
      });
      throw error;
    }
  } catch (error) {
    const categorizedError = categorizeError(error);
    console.error(`Moderation API Error [${endpoint}]`, {
      contextId,
      payload,
      error: categorizedError,
      originalError: error,
    });

    // Throw user-friendly error message
    if (categorizedError.category === 'permission') {
      throw new Error('You do not have permission to delete this content.');
    } else if (categorizedError.category === 'rate_limit') {
      throw new Error('Too many delete requests. Please try again later.');
    } else if (categorizedError.category === 'conflict') {
      throw new Error('This content has already been deleted.');
    } else if (categorizedError.category === 'network') {
      throw new Error(
        'Network error while deleting content. Please check your connection.'
      );
    } else {
      throw new Error('Failed to delete content. Please try again.');
    }
  }
}
