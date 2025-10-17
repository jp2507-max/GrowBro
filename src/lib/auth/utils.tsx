import { getItem, removeItem, setItem } from '@/lib/storage';

const TOKEN = 'token';

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
