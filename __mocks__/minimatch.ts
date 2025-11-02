/**
 * Mock for minimatch library
 * Used in tests for deep link path matching
 */

export function minimatch(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // First escape all regex special characters, then convert glob wildcards
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\\/]/g, '\\$&') // Escape regex special characters
    .replace(/\\\*/g, '.*') // Replace escaped * with .*
    .replace(/\\\?/g, '.'); // Replace escaped ? with .

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export default { minimatch };
