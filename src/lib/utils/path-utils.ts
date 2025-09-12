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
  return _joinPathImpl(segments);
}

// Internal implementation for joinPath (kept unexported so exported
// `joinPath` stays small for linting rules).
function _joinPathImpl(segments: string[]): string {
  // Filter out empty segments and normalize slashes, preserving URI schemes
  const processedSegments = segments
    .filter((segment) => segment && segment.trim() !== '')
    .map((segment) => {
      // Parse URI scheme prefix (e.g., file://, http://, https://)
      const schemeMatch = segment.match(/^([a-zA-Z]+:(?:\/\/?))(.*)$/);
      if (schemeMatch) {
        const [, scheme, pathPart] = schemeMatch;
        // Only trim slashes from the path portion, preserve scheme
        const trimmedPath = pathPart.replace(/^[\/\\]+|[\/\\]+$/g, '');
        return scheme + trimmedPath;
      }
      // No scheme, apply normal trimming
      return segment.replace(/^[\/\\]+|[\/\\]+$/g, '');
    });

  if (processedSegments.length === 0) {
    return '';
  }

  // Join with forward slashes
  const joined = processedSegments.join('/');

  // Preserve original triple-slash URI forms (e.g. "file:///")
  const firstSegment = segments.find((s) => s && s.trim() !== '');
  if (firstSegment) {
    const tripleMatch = firstSegment.match(/^([a-zA-Z]+:)(\/\/{3,})(.*)$/);
    if (tripleMatch) {
      const [, schemeBase, slashes] = tripleMatch;
      const rest = joined.replace(new RegExp('^' + schemeBase + '\\/+'), '');
      return schemeBase + slashes + (rest ? rest : '');
    }
  }

  // Parse scheme from first segment and handle scheme/leading-slash combinations
  const firstSchemeMatch = firstSegment
    ? firstSegment.match(/^([a-zA-Z]+:(?:\/\/?))(.*)$/)
    : null;
  if (firstSchemeMatch) {
    const [, scheme, pathPart] = firstSchemeMatch;
    const schemeEndsWithSlash = scheme.endsWith('/');
    const pathPartHasLeadingSlash = pathPart.startsWith('/');

    if (schemeEndsWithSlash) {
      return (
        scheme + joined.replace(new RegExp('^' + scheme), '').replace(/^\//, '')
      );
    } else if (pathPartHasLeadingSlash) {
      return (
        scheme +
        '/' +
        joined.replace(new RegExp('^' + scheme), '').replace(/^\//, '')
      );
    } else {
      return scheme + joined.replace(new RegExp('^' + scheme), '');
    }
  }

  const hasLeadingSlash = segments.some(
    (segment) => segment.startsWith('/') || segment.startsWith('\\')
  );

  return hasLeadingSlash && !joined.startsWith('/') && !joined.startsWith('\\')
    ? '/' + joined
    : joined;
}

/**
 * Gets the directory name of a path (everything before the last slash)
 * @param path The path to get the directory from
 * @returns The directory portion of the path
 */
export function dirname(path: string): string {
  if (!path || path === '/') return '/';

  const schemeMatch = path.match(/^([a-zA-Z]+:(?:\/\/?))(.*)$/);
  if (schemeMatch) return _dirnameUriImpl(schemeMatch[1], schemeMatch[2]);

  // Standard path handling for non-URI paths (kept concise)
  const normalizedPath = path.replace(/\\/g, '/');
  const trimmedPath = normalizedPath.replace(/\/\/+$/, '');
  if (!trimmedPath.includes('/')) return '.';
  const lastSlashIndex = trimmedPath.lastIndexOf('/');
  if (lastSlashIndex === 0) return '/';
  return trimmedPath.substring(0, lastSlashIndex);
}

// Internal helper for URI dirname logic
function _dirnameUriImpl(scheme: string, pathPart: string): string {
  if (!pathPart || pathPart === '/') return scheme + '/';

  const normalizedPath = pathPart.replace(/\\/g, '/');
  const endsWithSlash = normalizedPath.endsWith('/');
  const pathToProcess = endsWithSlash
    ? normalizedPath.slice(0, -1)
    : normalizedPath;

  if (!pathToProcess.includes('/')) {
    return scheme + (pathPart.startsWith('/') ? '/' : '');
  }
  const lastSlashIndex = pathToProcess.lastIndexOf('/');
  if (lastSlashIndex === 0) return scheme + '/';
  const parent = pathToProcess.substring(0, lastSlashIndex);
  if (!parent.includes('/')) return scheme + parent + '/';
  return scheme + parent;
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
    // When relativePath is empty, normalize basePath to an absolute path
    const normalizedBase = normalizePath(basePath);
    if (isAbsolute(normalizedBase)) {
      return normalizedBase;
    }
    // If basePath is relative, resolve it relative to root
    return resolvePath('/', basePath);
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
