import { create } from 'zustand';

import { createSelectors } from '@/lib/utils';

// Public routes stay accessible when no authenticated user is present.
const PUBLIC_PATHS = new Set(['/login', '/onboarding', '/age-gate']);
const PUBLIC_PREFIXES = ['legal', 'privacy'];

type DeferredDeepLinkState = {
  pendingPath: string | null;
  stash: (path: string) => void;
  consume: () => string | null;
  clear: () => void;
};

export function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

const _useDeferredDeepLink = create<DeferredDeepLinkState>((set, get) => ({
  pendingPath: null,
  stash: (path) => {
    const normalized = normalizePath(path);
    set({ pendingPath: normalized });
  },
  consume: () => {
    const next = get().pendingPath;
    if (next == null) {
      return null;
    }
    set({ pendingPath: null });
    return next;
  },
  clear: () => set({ pendingPath: null }),
}));

export const useDeferredDeepLink = createSelectors(_useDeferredDeepLink);

export function stashPendingDeepLink(path: string): void {
  _useDeferredDeepLink.getState().stash(path);
}

export function consumePendingDeepLink(): string | null {
  return _useDeferredDeepLink.getState().consume();
}

export function clearPendingDeepLink(): void {
  _useDeferredDeepLink.getState().clear();
}

export function peekPendingDeepLink(): string | null {
  return _useDeferredDeepLink.getState().pendingPath;
}

export function isProtectedDeepLinkPath(path: string): boolean {
  const normalized = normalizePath(path);
  if (PUBLIC_PATHS.has(normalized)) {
    return false;
  }

  const stripped = normalized.split('?')[0];
  for (const prefix of PUBLIC_PREFIXES) {
    if (stripped === `/${prefix}` || stripped.startsWith(`/${prefix}/`)) {
      return false;
    }
  }

  return true;
}
