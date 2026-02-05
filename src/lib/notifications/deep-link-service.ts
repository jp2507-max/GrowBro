import { type Href, router } from 'expo-router';

import {
  DeepLinkValidator,
  type ValidateResult,
} from '@/lib/deep-link-validator';
import {
  isProtectedDeepLinkPath,
  stashPendingDeepLink,
} from '@/lib/navigation/deep-link-gate';

type HandleOptions = {
  ensureAuthenticated?: () => Promise<boolean>;
  stashRedirect?: (path: string) => Promise<void> | void;
  onInvalid?: (reason: string) => void;
  source?: 'notifications' | 'default';
};

type HandleResult = { ok: true; path: string } | { ok: false; reason: string };

const validator = new DeepLinkValidator();

export const DeepLinkService = {
  validate(url: string): ValidateResult {
    return validator.validateURLWithReason(url);
  },

  async handle(url: string, options?: HandleOptions): Promise<HandleResult> {
    const validation = validator.validateURLWithReason(url);
    if (!validation.ok) {
      options?.onInvalid?.(validation.reason);
      return { ok: false, reason: validation.reason };
    }

    const resolvedPath = resolvePath(url);
    const stashPath = buildStashPath(resolvedPath, options?.source);
    const requiresAuth = isProtectedDeepLinkPath(resolvedPath);

    if (requiresAuth && options?.ensureAuthenticated) {
      const authed = await options.ensureAuthenticated();
      if (!authed) {
        stashPendingDeepLink(stashPath);
        await options.stashRedirect?.(stashPath);
        return { ok: false, reason: 'auth-required' };
      }
    }

    if (options?.source === 'notifications') {
      navigateFromNotifications(resolvedPath);
      return { ok: true, path: resolvedPath };
    }

    router.push(resolvedPath as Href);
    return { ok: true, path: resolvedPath };
  },
};

function navigateFromNotifications(resolvedPath: string): void {
  if (resolvedPath.startsWith('/notifications')) {
    router.push(resolvedPath as Href);
    return;
  }
  router.push('/notifications');
  router.push(resolvedPath as Href);
}

function buildStashPath(
  resolvedPath: string,
  source?: HandleOptions['source']
): string {
  if (source !== 'notifications') return resolvedPath;
  if (resolvedPath.startsWith('/notifications')) {
    return resolvedPath;
  }
  return `/notifications?redirect=${encodeURIComponent(resolvedPath)}`;
}

function resolvePath(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === 'growbro:') {
    const host = parsed.hostname ?? '';
    const pathname = parsed.pathname.replace(/^\/*/, '');
    const combined = pathname ? `${host}/${pathname}` : host;
    const path = combined.startsWith('/') ? combined : `/${combined}`;

    // Handle post deep links with optional comment scrolling
    // Format: growbro://post/:id or growbro://post/:id/comment/:commentId
    const postMatch = path.match(/^\/post\/([^/]+)(?:\/comment\/([^/]+))?/);
    if (postMatch) {
      const [, postId, commentId] = postMatch;
      if (commentId) {
        return `/post/${encodeURIComponent(postId)}?commentId=${encodeURIComponent(commentId)}`;
      }
      return `/post/${encodeURIComponent(postId)}`;
    }

    return path;
  }
  return parsed.pathname + parsed.search + parsed.hash;
}
