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
  // Find first non-empty segment
  const firstIndex = segments.findIndex((s) => s && s.trim() !== '');
  if (firstIndex === -1) return '';
  const firstSegment = segments[firstIndex];

  // URI-aware handling (robust against odd slash grouping)
  let schemeOnlyMatch = firstSegment.match(/^([A-Za-z][A-Za-z0-9+.-]*:)/);
  // Don't treat single-letter schemes like "C:" as URIs (Windows drive letters)
  if (
    schemeOnlyMatch &&
    schemeOnlyMatch[1].length === 2 &&
    /^[A-Za-z]:$/.test(schemeOnlyMatch[1])
  ) {
    schemeOnlyMatch = null;
  }
  if (schemeOnlyMatch) {
    const scheme = schemeOnlyMatch[1];
    const afterScheme = firstSegment.slice(scheme.length);
    const slashPrefix = afterScheme.match(/^\/+/)?.[0] ?? '';
    const slashCount = slashPrefix.length;
    const restFirst = afterScheme.slice(slashCount);

    const remaining = segments.slice(firstIndex + 1);
    const parts: string[] = [];
    if (restFirst) parts.push(restFirst);
    for (const seg of remaining) {
      if (!seg || seg.trim() === '') continue;
      parts.push(seg);
    }
    const normalizedParts = parts
      .map((p) => p.replace(/^[\/\\]+|[\/\\]+$/g, ''))
      .filter((p) => p.length > 0);

    // Preserve exact number of slashes after scheme
    if (normalizedParts.length === 0) return scheme + slashPrefix;
    // Special-case: file:// style authorities (e.g., file://server/share)
    if (scheme.toLowerCase().startsWith('file:') && slashPrefix.length === 2) {
      const [host, ...restParts] = normalizedParts;
      if (host && restParts.length > 0) {
        return scheme + '//' + host + '/' + restParts.join('/');
      }
    }
    return scheme + slashPrefix + normalizedParts.join('/');
  }

  // Non-URI: normalize and join, keeping absolute leading slash
  const cleaned = segments
    .filter((s) => s && s.trim() !== '')
    .map((s) => s.replace(/^[\/\\]+|[\/\\]+$/g, ''));
  if (cleaned.length === 0) return '';
  const joined = cleaned.join('/');
  const hasLeadingSlash = segments.some(
    (s) => s.startsWith('/') || s.startsWith('\\')
  );
  return hasLeadingSlash && !joined.startsWith('/') ? '/' + joined : joined;
}

/**
 * Gets the directory name of a path (everything before the last slash)
 * @param path The path to get the directory from
 * @returns The directory portion of the path
 */
export function dirname(path: string): string {
  if (!path || path === '/') return '/';

  let schemeMatch = path.match(/^([A-Za-z][A-Za-z0-9+.-]*:)(\/*)(.*)$/);
  // Don't treat single-letter schemes like "C:" as URIs (Windows drive letters)
  if (
    schemeMatch &&
    schemeMatch[1].length === 2 &&
    /^[A-Za-z]:$/.test(schemeMatch[1])
  ) {
    schemeMatch = null;
  }
  if (schemeMatch)
    return _dirnameUriImpl(
      schemeMatch[1],
      schemeMatch[2] || '',
      schemeMatch[3]
    );

  // Standard path handling for non-URI paths (kept concise)
  const normalizedPath = path.replace(/\\/g, '/');
  const trimmedPath = normalizedPath.replace(/\/\/+$/, '');
  if (!trimmedPath.includes('/')) return '.';
  const lastSlashIndex = trimmedPath.lastIndexOf('/');
  if (lastSlashIndex === 0) return '/';
  return trimmedPath.substring(0, lastSlashIndex);
}

// Internal helper for URI dirname logic
function _dirnameUriImpl(
  schemePrefix: string,
  slashes: string,
  rest: string
): string {
  const slashCount = slashes.length;
  const normalizedRest = (rest || '').replace(/\\/g, '/');

  // Triple-slash-or-more → absolute path with empty authority (e.g., file:///path)
  if (slashCount >= 3) {
    if (!normalizedRest || normalizedRest === '/') return schemePrefix + '///';
    const endsWithSlash = normalizedRest.endsWith('/');
    const trimmedEnd = endsWithSlash
      ? normalizedRest.slice(0, -1)
      : normalizedRest;
    if (trimmedEnd === '' || trimmedEnd === '/') return schemePrefix + '///';
    if (endsWithSlash) {
      // Directory path ending with slash → dirname is the directory itself
      return schemePrefix + '///' + trimmedEnd.replace(/^\/+/, '');
    }
    const cleaned = trimmedEnd.replace(/^\/+|\/+$/g, '');
    if (!cleaned.includes('/')) return schemePrefix + '///';
    const parent = cleaned.substring(0, cleaned.lastIndexOf('/'));
    return schemePrefix + '///' + parent;
  }

  // Double-slash → authority-based URI (e.g., https://host/path, file://server/share)
  if (slashCount === 2) {
    if (!normalizedRest) return schemePrefix + '///';
    const endsWithSlash = normalizedRest.endsWith('/');
    const trimmedEnd = endsWithSlash
      ? normalizedRest.slice(0, -1)
      : normalizedRest;
    if (trimmedEnd === '') return schemePrefix + '///';
    if (!trimmedEnd.includes('/')) {
      // Only authority present
      return schemePrefix + '//' + trimmedEnd + '/';
    }
    const lastSlash = trimmedEnd.lastIndexOf('/');
    const parent = trimmedEnd.substring(0, lastSlash);
    if (endsWithSlash) {
      // Directory path ending with slash → dirname is the directory itself
      return schemePrefix + '//' + trimmedEnd;
    }
    if (!parent.includes('/')) {
      // host/path → directory is host
      return schemePrefix + '//' + parent;
    }
    return schemePrefix + '//' + parent;
  }

  // Single-slash after scheme (rare, e.g., file:/path)
  if (slashCount === 1) {
    const normalized = normalizedRest.replace(/^\/+|\/+$/g, '');
    if (!normalized) return schemePrefix + '/';
    if (!normalized.includes('/')) return schemePrefix + '/';
    const parent = normalized.substring(0, normalized.lastIndexOf('/'));
    return schemePrefix + '/' + parent;
  }

  // No slashes after scheme
  return schemePrefix + '/';
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
