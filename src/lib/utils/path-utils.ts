/**
 * URL-safe path utilities for Expo/React Native
 *
 * Replaces Node's path module with forward-slash based operations
 * that work in the JavaScript runtime without Node dependencies.
 */

/**
 * Joins path segments using forward slashes, normalizing the result
 * @param segments Path segments to join
 * @returns Normalized forward-slash path
 */
export function joinPath(...segments: string[]): string {
  // Filter out empty segments and normalize slashes
  const filteredSegments = segments
    .filter((segment) => segment && segment.trim() !== '')
    .map((segment) => segment.replace(/^[\/\\]+|[\/\\]+$/g, ''));

  if (filteredSegments.length === 0) {
    return '';
  }

  // Join with forward slashes
  const path = filteredSegments.join('/');

  // Ensure single leading slash if any segment had one and path doesn't already start with one
  const hasLeadingSlash = segments.some(
    (segment) => segment.startsWith('/') || segment.startsWith('\\')
  );

  return hasLeadingSlash && !path.startsWith('/') && !path.startsWith('\\')
    ? '/' + path
    : path;
}

/**
 * Gets the directory name of a path (everything before the last slash)
 * @param path The path to get the directory from
 * @returns The directory portion of the path
 */
export function dirname(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  // Normalize path separators to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');

  // Remove trailing slashes except for root
  const trimmedPath = normalizedPath.replace(/\/+$/, '');

  // If no slashes remain, return current directory
  if (!trimmedPath.includes('/')) {
    return '.';
  }

  // Get everything before the last slash
  const lastSlashIndex = trimmedPath.lastIndexOf('/');
  if (lastSlashIndex === 0) {
    return '/';
  }

  return trimmedPath.substring(0, lastSlashIndex);
}

/**
 * Gets the base name of a path (everything after the last slash)
 * @param path The path to get the base name from
 * @param ext Optional extension to remove from the result
 * @returns The base name portion of the path
 */
export function basename(path: string, ext?: string): string {
  if (!path) {
    return '';
  }

  // Normalize path separators to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');

  // Remove trailing slashes
  const trimmedPath = normalizedPath.replace(/\/+$/, '');

  // Get everything after the last slash
  const lastSlashIndex = trimmedPath.lastIndexOf('/');
  const base =
    lastSlashIndex >= 0
      ? trimmedPath.substring(lastSlashIndex + 1)
      : trimmedPath;

  // Remove extension if specified
  if (ext && base.endsWith(ext)) {
    return base.substring(0, base.length - ext.length);
  }

  return base;
}

/**
 * Gets the file extension from a path
 * @param path The path to get the extension from
 * @returns The file extension including the dot, or empty string if no extension
 */
export function extname(path: string): string {
  if (!path) {
    return '';
  }

  const base = basename(path);
  const lastDotIndex = base.lastIndexOf('.');

  if (lastDotIndex <= 0) {
    return '';
  }

  return base.substring(lastDotIndex);
}

/**
 * Resolves a relative path against a base path
 * @param basePath The base path
 * @param relativePath The relative path to resolve
 * @returns The resolved absolute path
 */
export function resolvePath(basePath: string, relativePath: string): string {
  if (!relativePath) {
    return basePath;
  }

  if (relativePath.startsWith('/')) {
    // Already absolute
    return relativePath;
  }

  // Handle relative paths
  const base = basePath || '/';
  const parts = base.split('/').filter((p) => p);
  const relativeParts = relativePath.split('/').filter((p) => p);

  for (const part of relativeParts) {
    if (part === '..') {
      if (parts.length > 0) {
        parts.pop();
      }
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return '/' + parts.join('/');
}

/**
 * Normalizes a path by resolving '.' and '..' segments and normalizing slashes
 * @param path The path to normalize
 * @returns The normalized path
 */
export function normalizePath(path: string): string {
  if (!path) {
    return '';
  }

  // Replace backslashes with forward slashes
  const normalized = path.replace(/\\/g, '/');

  // Split into segments
  const parts = normalized.split('/').filter(Boolean);

  // Handle leading slash
  const hasLeadingSlash = normalized.startsWith('/');

  // Resolve '.' and '..' segments
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else if (!hasLeadingSlash) {
        resolved.push(part);
      }
    } else if (part !== '.') {
      resolved.push(part);
    }
  }

  // Reconstruct path
  let result = resolved.join('/');
  if (hasLeadingSlash) {
    result = '/' + result;
  }

  // Handle empty result
  if (!result) {
    return hasLeadingSlash ? '/' : '.';
  }

  return result;
}

/**
 * Checks if a path is absolute (starts with '/')
 * @param path The path to check
 * @returns True if the path is absolute
 */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

/**
 * Converts a path to use forward slashes consistently
 * @param path The path to convert
 * @returns Path with forward slashes
 */
export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}
