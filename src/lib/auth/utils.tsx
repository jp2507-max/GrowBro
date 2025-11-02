import * as Crypto from 'expo-crypto';

import { getItem, removeItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

const TOKEN = 'token';

/**
 * Derives a stable session key from a refresh token.
 * Uses SHA-256 hash to create a consistent identifier.
 *
 * @param refreshToken - The refresh token to hash
 * @returns SHA-256 hash of the refresh token
 */
export async function deriveSessionKey(
  refreshToken: string | undefined
): Promise<string> {
  if (!refreshToken) return '';

  // Use SHA-256 to create a stable, non-reversible identifier
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    refreshToken
  );
  return hash;
}

export type TokenType = {
  access: string;
  refresh: string;
};

/**
 * Generates a stable hash from a string input
 * @param input The string to hash
 * @returns A stable hash string
 */
export function generateStableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return `session:${Math.abs(hash)}`;
}

/**
 * Gets a stable session identifier from the current token
 * @returns A stable session identifier or null if no token exists
 */
export function getStableSessionId(): string | null {
  const token = getToken();
  if (!token?.refresh) {
    return null;
  }
  return generateStableHash(token.refresh);
}

export const getToken = () => getItem<TokenType>(TOKEN);
export const removeToken = () => removeItem(TOKEN);
export const setToken = (value: TokenType) => setItem<TokenType>(TOKEN, value);

/**
 * Checks if a session has been revoked remotely by its refresh token.
 * This ensures that session revocation from other devices forces sign-out.
 *
 * @param refreshToken - The refresh token to check
 * @returns True if the session has been revoked, false otherwise
 */
export async function checkSessionRevocation(
  refreshToken: string
): Promise<boolean> {
  try {
    // Derive session key from refresh token
    const sessionKey = await deriveSessionKey(refreshToken);
    if (!sessionKey) {
      return false;
    }

    // Check if this session key is revoked in user_sessions table
    const { data, error } = await supabase
      .from('user_sessions')
      .select('revoked_at')
      .eq('session_key', sessionKey)
      .maybeSingle();

    if (error) {
      console.error('Session revocation check error:', error);
      // Don't block user on error - assume session is valid
      return false;
    }

    // Session is revoked if data exists and revoked_at is not null
    return !!data?.revoked_at;
  } catch (error) {
    console.error('Session revocation check exception:', error);
    // Don't block user on error - assume session is valid
    return false;
  }
}
