import { supabase } from '@/lib/supabase';

export class AuthenticationError extends Error {
  constructor(message: string = 'User not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Gets the authenticated user ID from the current session
 * @returns The user ID if authenticated
 * @throws AuthenticationError if user is not authenticated
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new AuthenticationError(`Authentication error: ${error.message}`);
  }

  if (!data?.user?.id) {
    throw new AuthenticationError('No authenticated user found');
  }

  return data.user.id;
}

/**
 * Gets the authenticated user ID from the current session, returns null if not authenticated
 * @returns The user ID if authenticated, null otherwise
 */
export async function getOptionalAuthenticatedUserId(): Promise<string | null> {
  try {
    return await getAuthenticatedUserId();
  } catch {
    return null;
  }
}

/**
 * Validates that a user ID is provided and represents an authenticated user
 * @param userId The user ID to validate
 * @throws AuthenticationError if userId is invalid or user is not authenticated
 */
export async function validateAuthenticatedUserId(
  userId: string | null | undefined
): Promise<string> {
  if (!userId) {
    throw new AuthenticationError('User ID is required');
  }

  // Get current authenticated user to ensure the provided userId matches
  const authenticatedUserId = await getAuthenticatedUserId();

  if (userId !== authenticatedUserId) {
    throw new AuthenticationError(
      'Provided user ID does not match authenticated user'
    );
  }

  return userId;
}
