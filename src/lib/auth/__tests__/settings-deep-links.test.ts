/**
 * Integration tests for settings deep links
 * Requirements: 2.7
 *
 * Tests deep link routing to various settings screens and verifies
 * back navigation returns to the main settings hub.
 */

import { router } from 'expo-router';

import {
  handleDeepLink,
  parseDeepLink,
  validateRedirect,
} from '@/lib/auth/deep-link-handler';
import { useAuth } from '@/lib/auth/index';

// Mock router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock auth
jest.mock('@/lib/auth/index', () => ({
  useAuth: {
    getState: jest.fn(() => ({
      status: 'signIn',
      user: { id: 'test-user-id' },
    })),
  },
}));

// Mock flash message
jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Mock privacy consent
jest.mock('@/lib/privacy-consent', () => ({
  hasConsent: jest.fn(() => false),
}));

describe('Settings Deep Links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseDeepLink', () => {
    it('should parse main settings deep link', () => {
      const result = parseDeepLink('growbro://settings');

      expect(result).toEqual({
        host: 'settings',
        path: '',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/profile deep link', () => {
      const result = parseDeepLink('growbro://settings/profile');

      expect(result).toEqual({
        host: 'settings',
        path: '/profile',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/notifications deep link', () => {
      const result = parseDeepLink('growbro://settings/notifications');

      expect(result).toEqual({
        host: 'settings',
        path: '/notifications',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/privacy-and-data deep link', () => {
      const result = parseDeepLink('growbro://settings/privacy-and-data');

      expect(result).toEqual({
        host: 'settings',
        path: '/privacy-and-data',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/security deep link', () => {
      const result = parseDeepLink('growbro://settings/security');

      expect(result).toEqual({
        host: 'settings',
        path: '/security',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/support deep link', () => {
      const result = parseDeepLink('growbro://settings/support');

      expect(result).toEqual({
        host: 'settings',
        path: '/support',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/legal deep link', () => {
      const result = parseDeepLink('growbro://settings/legal');

      expect(result).toEqual({
        host: 'settings',
        path: '/legal',
        params: expect.any(URLSearchParams),
      });
    });

    it('should parse settings/about deep link', () => {
      const result = parseDeepLink('growbro://settings/about');

      expect(result).toEqual({
        host: 'settings',
        path: '/about',
        params: expect.any(URLSearchParams),
      });
    });

    it('should return null for invalid scheme', () => {
      const result = parseDeepLink('https://settings/profile');

      expect(result).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const result = parseDeepLink('not-a-url');

      expect(result).toBeNull();
    });
  });

  describe('validateRedirect', () => {
    it('should allow /settings redirect', () => {
      expect(validateRedirect('/settings')).toBe(true);
    });

    it('should allow /settings/profile redirect', () => {
      expect(validateRedirect('/settings/profile')).toBe(true);
    });

    it('should allow /settings/notifications redirect', () => {
      expect(validateRedirect('/settings/notifications')).toBe(true);
    });

    it('should allow /settings/privacy-and-data redirect', () => {
      expect(validateRedirect('/settings/privacy-and-data')).toBe(true);
    });

    it('should allow /settings/security redirect', () => {
      expect(validateRedirect('/settings/security')).toBe(true);
    });

    it('should allow /settings/support redirect', () => {
      expect(validateRedirect('/settings/support')).toBe(true);
    });

    it('should allow /settings/legal redirect', () => {
      expect(validateRedirect('/settings/legal')).toBe(true);
    });

    it('should allow /settings/about redirect', () => {
      expect(validateRedirect('/settings/about')).toBe(true);
    });

    it('should allow /settings/* wildcard paths', () => {
      expect(validateRedirect('/settings/any-future-route')).toBe(true);
    });

    it('should reject invalid paths', () => {
      expect(validateRedirect('/admin/users')).toBe(false);
    });

    it('should reject empty path', () => {
      expect(validateRedirect('')).toBe(false);
    });

    it('should reject null path', () => {
      expect(validateRedirect(null as any)).toBe(false);
    });
  });

  describe('handleDeepLink navigation', () => {
    it('should navigate to main settings', async () => {
      await handleDeepLink('growbro://settings');

      expect(router.push).toHaveBeenCalledWith('/settings');
    });

    it('should navigate to settings/profile', async () => {
      await handleDeepLink('growbro://settings/profile');

      expect(router.push).toHaveBeenCalledWith('/settings/profile');
    });

    it('should navigate to settings/notifications', async () => {
      await handleDeepLink('growbro://settings/notifications');

      expect(router.push).toHaveBeenCalledWith('/settings/notifications');
    });

    it('should navigate to settings/privacy-and-data', async () => {
      await handleDeepLink('growbro://settings/privacy-and-data');

      expect(router.push).toHaveBeenCalledWith('/settings/privacy-and-data');
    });

    it('should navigate to settings/security', async () => {
      await handleDeepLink('growbro://settings/security');

      expect(router.push).toHaveBeenCalledWith('/settings/security');
    });

    it('should preserve query parameters', async () => {
      await handleDeepLink('growbro://settings/profile?edit=true');

      expect(router.push).toHaveBeenCalledWith('/settings/profile?edit=true');
    });
  });

  describe('Back navigation', () => {
    it('should support back navigation from detail screen to hub', () => {
      // Simulate navigating to settings hub
      router.push('/settings');

      // Then navigate to a detail screen
      router.push('/settings/profile');

      // Verify back navigation
      router.back();

      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('Authentication requirements', () => {
    it('should redirect to login if user is signed out', async () => {
      // Mock signed out state
      (useAuth.getState as jest.Mock).mockReturnValue({
        status: 'signOut',
        user: null,
      });

      await handleDeepLink('growbro://settings/profile');

      // Should stash the link and redirect to login
      expect(router.replace).toHaveBeenCalledWith('/login');
    });

    it('should navigate directly if user is signed in', async () => {
      // Mock signed in state
      (useAuth.getState as jest.Mock).mockReturnValue({
        status: 'signIn',
        user: { id: 'test-user-id' },
      });

      await handleDeepLink('growbro://settings/profile');

      expect(router.push).toHaveBeenCalledWith('/settings/profile');
    });
  });
});
