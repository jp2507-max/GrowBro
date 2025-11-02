/**
 * Mock for minimatch library
 * Used in tests for deep link path matching
 */

export function minimatch(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*') // Replace * with .*
    .replace(/\?/g, '.'); // Replace ? with .

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export default { minimatch };
