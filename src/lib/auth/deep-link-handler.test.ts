/**
 * Unit tests for deep link handler
 *
 * Tests URL parsing, email verification, password reset, redirect validation,
 * and error handling for authentication deep links.
 */

import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { showMessage } from 'react-native-flash-message';

import { useAuth } from '@/lib/auth';
import {
  handleDeepLink,
  handleEmailVerification,
  handleOAuthCallback,
  handlePasswordReset,
  parseDeepLink,
  validateRedirect,
} from '@/lib/auth/deep-link-handler';
import {
  isProtectedDeepLinkPath,
  stashPendingDeepLink,
} from '@/lib/navigation/deep-link-gate';
import * as privacyConsent from '@/lib/privacy-consent';
import { supabase } from '@/lib/supabase';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: jest.fn(),
      getUser: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: {
    getState: jest.fn(),
  },
}));

jest.mock('@/lib/navigation/deep-link-gate', () => ({
  isProtectedDeepLinkPath: jest.fn(),
  stashPendingDeepLink: jest.fn(),
}));

jest.mock('@/lib/navigation/deep-link-allowlist', () => ({
  isAllowedAuthHost: jest.fn((host: string) =>
    ['auth', 'verify-email', 'reset-password'].includes(host)
  ),
  isAllowedRedirect: jest.fn((path: string) => {
    // Mock implementation that matches test expectations
    const allowedPaths = [
      '/settings/profile',
      '/plants/123',
      '/feed',
      '/settings',
    ];
    return allowedPaths.includes(path);
  }),
  sanitizeDeepLinkUrl: jest.fn((url: string) => url),
}));

jest.mock('minimatch', () => ({
  minimatch: jest.fn((path: string, pattern: string) => {
    // Simple mock implementation - check if pattern ends with /* and path starts with pattern without /*
    if (pattern.endsWith('/*')) {
      const basePattern = pattern.slice(0, -2);
      return path.startsWith(basePattern);
    }
    return path === pattern;
  }),
}));

jest.mock('@/lib/privacy-consent', () => ({
  hasConsent: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('@/lib/auth/redirect-uri', () => ({
  isCustomSchemeLink: jest.fn((url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol.startsWith('growbro');
    } catch {
      return false;
    }
  }),
  isUniversalLink: jest.fn((url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname === 'growbro.app';
    } catch {
      return false;
    }
  }),
  UNIVERSAL_LINK_DOMAIN: 'growbro.app',
}));

describe('parseDeepLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parses valid email verification link', () => {
    const url = 'growbro://verify-email?token_hash=abc123&type=signup';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('verify-email');
    expect(result?.path).toBe('');
    expect(result?.params.get('token_hash')).toBe('abc123');
    expect(result?.params.get('type')).toBe('signup');
  });

  test('parses valid password reset link', () => {
    const url = 'growbro://reset-password?token_hash=xyz789';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('reset-password');
    expect(result?.path).toBe('');
    expect(result?.params.get('token_hash')).toBe('xyz789');
  });

  test('parses OAuth callback link', () => {
    const url = 'growbro://auth?code=oauth123';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('auth');
    expect(result?.path).toBe('');
    expect(result?.params.get('code')).toBe('oauth123');
  });

  test('parses navigation deep link with path', () => {
    const url = 'growbro://(app)/settings/profile?param=value';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('(app)');
    expect(result?.path).toBe('/settings/profile');
    expect(result?.params.get('param')).toBe('value');
  });

  test('returns null for invalid URL', () => {
    const url = 'not-a-url';
    const result = parseDeepLink(url);

    expect(result).toBeNull();
  });

  test('logs error to Sentry if consent granted', () => {
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(true);

    const url = 'invalid://url';
    parseDeepLink(url);

    expect(Sentry.captureException).toHaveBeenCalled();
  });

  test('does not log error to Sentry if consent not granted', () => {
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(false);

    const url = 'invalid://url';
    parseDeepLink(url);

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  // Universal Link tests
  test('parses Universal Link for email verification', () => {
    const url = 'https://growbro.app/verify-email?token_hash=abc123&type=email';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('verify-email');
    expect(result?.path).toBe('');
    expect(result?.params.get('token_hash')).toBe('abc123');
  });

  test('parses Universal Link for password reset', () => {
    const url = 'https://growbro.app/reset-password?token_hash=xyz789';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('reset-password');
    expect(result?.path).toBe('');
    expect(result?.params.get('token_hash')).toBe('xyz789');
  });

  test('parses Universal Link for OAuth callback', () => {
    const url = 'https://growbro.app/auth/callback?code=oauth123';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('auth');
    expect(result?.path).toBe('/callback');
    expect(result?.params.get('code')).toBe('oauth123');
  });

  test('parses growbro-dev scheme for development', () => {
    const url = 'growbro-dev://verify-email?token_hash=abc123';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('verify-email');
    expect(result?.params.get('token_hash')).toBe('abc123');
  });

  test('parses growbro-staging scheme for staging', () => {
    const url = 'growbro-staging://reset-password?token_hash=xyz789';
    const result = parseDeepLink(url);

    expect(result).toBeTruthy();
    expect(result?.host).toBe('reset-password');
    expect(result?.params.get('token_hash')).toBe('xyz789');
  });
});

describe('handleEmailVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(false);
  });

  test('verifies email, refetches user data, and shows success message', async () => {
    const mockUpdateUser = jest.fn();
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: {
          id: '123',
          email: 'user@example.com',
          email_confirmed_at: '2024-01-01T00:00:00.000Z',
        },
      },
      error: null,
    });
    (useAuth.getState as jest.Mock).mockReturnValue({
      user: { id: '123', email: 'user@example.com' },
      updateUser: mockUpdateUser,
    });

    const result = await handleEmailVerification('valid-token', 'signup');

    expect(result).toBe(true);
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'valid-token',
    });
    expect(supabase.auth.getUser).toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalledWith({
      id: '123',
      email: 'user@example.com',
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
    });
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
      })
    );
  });

  test('continues on getUser error after successful verification', async () => {
    const mockUpdateUser = jest.fn();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Failed to get user' },
    });
    (useAuth.getState as jest.Mock).mockReturnValue({
      user: { id: '123', email: 'user@example.com' },
      updateUser: mockUpdateUser,
    });

    const result = await handleEmailVerification('valid-token', 'signup');

    expect(result).toBe(true);
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'valid-token',
    });
    expect(supabase.auth.getUser).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to refetch user after email verification:',
      { message: 'Failed to get user' }
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
      })
    );

    consoleWarnSpy.mockRestore();
  });

  test('shows error for invalid token', async () => {
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid token' },
    });

    const result = await handleEmailVerification('invalid-token', 'signup');

    expect(result).toBe(false);
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
  });

  test('shows error for missing token', async () => {
    const result = await handleEmailVerification('', 'signup');

    expect(result).toBe(false);
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  test('logs error to Sentry if consent granted', async () => {
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(true);
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid token' },
    });

    const result = await handleEmailVerification('invalid-token', 'signup');

    expect(result).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

describe('handlePasswordReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(false);
  });

  test('verifies token and navigates to confirmation screen', async () => {
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({ error: null });

    await handlePasswordReset('valid-token');

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'recovery',
      token_hash: 'valid-token',
    });
    expect(router.push).toHaveBeenCalledWith('/reset-password-confirm');
  });

  test('shows error and navigates back for invalid token', async () => {
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid token' },
    });

    await handlePasswordReset('invalid-token');

    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
    expect(router.replace).toHaveBeenCalledWith('/reset-password');
  });

  test('shows error for missing token', async () => {
    await handlePasswordReset('');

    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });
});

describe('handleOAuthCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(false);
  });

  test('exchanges code for session and navigates to app', async () => {
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      error: null,
    });

    await handleOAuthCallback('oauth-code');

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      'oauth-code'
    );
    expect(router.replace).toHaveBeenCalledWith('/(app)');
  });

  test('shows error and navigates to login on failure', async () => {
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid code' },
    });

    await handleOAuthCallback('invalid-code');

    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  test('shows error for missing code', async () => {
    await handleOAuthCallback('');

    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('validateRedirect', () => {
  test('accepts allowed paths', () => {
    expect(validateRedirect('/settings/profile')).toBe(true);
    expect(validateRedirect('/plants/123')).toBe(true);
    expect(validateRedirect('/feed')).toBe(true);
  });

  test('rejects disallowed paths', () => {
    expect(validateRedirect('/admin')).toBe(false);
    expect(validateRedirect('/api/secret')).toBe(false);
  });

  test('rejects null/empty redirects', () => {
    expect(validateRedirect(null)).toBe(false);
    expect(validateRedirect('')).toBe(false);
  });
});

describe('handleDeepLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(false);
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: '123', email: 'user@example.com' } },
      error: null,
    });
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      error: null,
    });
    (useAuth.getState as jest.Mock).mockReturnValue({
      status: 'signIn',
      user: { id: '123', email: 'user@example.com' },
      updateUser: jest.fn(),
    });
  });

  test('handles email verification link', async () => {
    const url = 'growbro://verify-email?token_hash=abc123&type=signup';

    await handleDeepLink(url);

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'abc123',
    });
  });

  test('handles password reset link', async () => {
    const url = 'growbro://reset-password?token_hash=xyz789';

    await handleDeepLink(url);

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'recovery',
      token_hash: 'xyz789',
    });
  });

  test('handles OAuth callback', async () => {
    const url = 'growbro://auth?code=oauth123';

    await handleDeepLink(url);

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      'oauth123'
    );
  });

  test('rejects disallowed hosts', async () => {
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(true);

    const url = 'growbro://malicious-host?token=abc';

    await handleDeepLink(url);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Disallowed deep link host',
      expect.any(Object)
    );
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
  });

  test('rejects invalid redirect parameter', async () => {
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(true);

    const url = 'growbro://verify-email?token_hash=abc&redirect=/admin';

    await handleDeepLink(url);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Invalid redirect parameter',
      expect.any(Object)
    );
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'danger',
      })
    );
  });

  test('accepts valid redirect parameter', async () => {
    const url =
      'growbro://verify-email?token_hash=abc123&type=signup&redirect=/settings';

    await handleDeepLink(url);

    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  test('stashes pending link for protected routes when not signed in', async () => {
    (useAuth.getState as jest.Mock).mockReturnValue({
      status: 'signOut',
    });
    (isProtectedDeepLinkPath as jest.Mock).mockReturnValue(true);

    const url = 'growbro://plants';

    await handleDeepLink(url);

    expect(stashPendingDeepLink).toHaveBeenCalledWith('/plants');
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  test('navigates to protected route when signed in', async () => {
    (useAuth.getState as jest.Mock).mockReturnValue({
      status: 'signIn',
    });
    (isProtectedDeepLinkPath as jest.Mock).mockReturnValue(true);

    const url = 'growbro://plants';

    await handleDeepLink(url);

    expect(router.push).toHaveBeenCalledWith('/plants');
  });

  test('logs sanitized URL on parsing error', async () => {
    (privacyConsent.hasConsent as jest.Mock).mockReturnValue(true);

    const url = 'not-a-url';

    await handleDeepLink(url);

    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
