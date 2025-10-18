import { router } from 'expo-router';

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
    const requiresAuth = isProtectedDeepLinkPath(resolvedPath);

    if (requiresAuth && options?.ensureAuthenticated) {
      const authed = await options.ensureAuthenticated();
      if (!authed) {
        stashPendingDeepLink(resolvedPath);
        await options.stashRedirect?.(resolvedPath);
        return { ok: false, reason: 'auth-required' };
      }
    }

    router.push(resolvedPath);
    return { ok: true, path: resolvedPath };
  },
};

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
        return `/post/${postId}?commentId=${commentId}`;
      }
      return `/post/${postId}`;
    }

    return path;
  }
  return parsed.pathname + parsed.search + parsed.hash;
}
