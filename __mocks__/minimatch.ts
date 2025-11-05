/**
 * Mock for minimatch library
 * Used in tests for deep link path matching
 */

export function minimatch(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // First replace wildcards with placeholders, then escape special chars, then convert placeholders to regex
  const regexPattern = pattern
    .replace(/\*/g, '__STAR__') // Replace * with placeholder
    .replace(/\?/g, '__QMARK__') // Replace ? with placeholder
    .replace(/[.+^${}()|[\]\\\/]/g, '\\$&') // Escape regex special characters
    .replace(/__STAR__/g, '.*') // Convert placeholder back to .*
    .replace(/__QMARK__/g, '.'); // Convert placeholder back to .

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

export default { minimatch };
