/**
 * Mock for minimatch library
 * Used in tests for deep link path matching
 */

export function minimatch(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // First convert glob wildcards to regex, then escape remaining special characters
  const regexPattern = pattern
    .replace(/\*/g, '.*') // Replace * with .*
    .replace(/\?/g, '.') // Replace ? with .
    .replace(/[.+^${}()|[\]\\\/]/g, '\\$&'); // Escape remaining regex special characters

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export default { minimatch };
