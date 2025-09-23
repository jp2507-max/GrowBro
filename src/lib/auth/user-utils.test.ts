import {
  AuthenticationError,
  getAuthenticatedUserId,
  getOptionalAuthenticatedUserId,
  validateAuthenticatedUserId,
} from '@/lib/auth/user-utils';
import { supabase } from '@/lib/supabase';

// Mock the supabase module
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

const mockGetUser = supabase.auth.getUser as jest.MockedFunction<
  typeof supabase.auth.getUser
>;

// eslint-disable-next-line max-lines-per-function
describe('Auth Utils', function () {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthenticatedUserId', () => {
    test('returns user ID when authenticated', async () => {
      const userId = 'user-123';
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      } as any);

      const result = await getAuthenticatedUserId();
      expect(result).toBe(userId);
    });

    test('throws AuthenticationError when auth error occurs', async () => {
      const error = { message: 'Auth failed' };
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error,
      } as any);

      await expect(getAuthenticatedUserId()).rejects.toThrow(
        AuthenticationError
      );
      await expect(getAuthenticatedUserId()).rejects.toThrow(
        'Authentication error: Auth failed'
      );
    });

    test('throws AuthenticationError when no user found', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      await expect(getAuthenticatedUserId()).rejects.toThrow(
        AuthenticationError
      );
      await expect(getAuthenticatedUserId()).rejects.toThrow(
        'No authenticated user found'
      );
    });

    test('throws AuthenticationError when user has no ID', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: {} },
        error: null,
      } as any);

      await expect(getAuthenticatedUserId()).rejects.toThrow(
        AuthenticationError
      );
      await expect(getAuthenticatedUserId()).rejects.toThrow(
        'No authenticated user found'
      );
    });
  });

  describe('getOptionalAuthenticatedUserId', () => {
    test('returns user ID when authenticated', async () => {
      const userId = 'user-123';
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      } as any);

      const result = await getOptionalAuthenticatedUserId();
      expect(result).toBe(userId);
    });

    test('returns null when authentication fails', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth failed' },
      } as any);

      const result = await getOptionalAuthenticatedUserId();
      expect(result).toBeNull();
    });

    test('returns null when no user found', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      const result = await getOptionalAuthenticatedUserId();
      expect(result).toBeNull();
    });
  });

  describe('validateAuthenticatedUserId', () => {
    test('returns userId when it matches authenticated user', async () => {
      const userId = 'user-123';
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      } as any);

      const result = await validateAuthenticatedUserId(userId);
      expect(result).toBe(userId);
    });

    test('throws AuthenticationError when userId is null', async () => {
      await expect(validateAuthenticatedUserId(null)).rejects.toThrow(
        AuthenticationError
      );
      await expect(validateAuthenticatedUserId(null)).rejects.toThrow(
        'User ID is required'
      );
    });

    test('throws AuthenticationError when userId is undefined', async () => {
      await expect(validateAuthenticatedUserId(undefined)).rejects.toThrow(
        AuthenticationError
      );
      await expect(validateAuthenticatedUserId(undefined)).rejects.toThrow(
        'User ID is required'
      );
    });

    test('throws AuthenticationError when userId is empty string', async () => {
      await expect(validateAuthenticatedUserId('')).rejects.toThrow(
        AuthenticationError
      );
      await expect(validateAuthenticatedUserId('')).rejects.toThrow(
        'User ID is required'
      );
    });

    test('throws AuthenticationError when userId does not match authenticated user', async () => {
      const authenticatedUserId = 'user-123';
      const providedUserId = 'user-456';

      mockGetUser.mockResolvedValue({
        data: { user: { id: authenticatedUserId } },
        error: null,
      } as any);

      await expect(validateAuthenticatedUserId(providedUserId)).rejects.toThrow(
        AuthenticationError
      );
      await expect(validateAuthenticatedUserId(providedUserId)).rejects.toThrow(
        'Provided user ID does not match authenticated user'
      );
    });

    test('throws AuthenticationError when authentication fails during validation', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth failed' },
      } as any);

      await expect(validateAuthenticatedUserId('user-123')).rejects.toThrow(
        AuthenticationError
      );
      await expect(validateAuthenticatedUserId('user-123')).rejects.toThrow(
        'Authentication error: Auth failed'
      );
    });
  });

  describe('AuthenticationError', () => {
    test('creates error with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('User not authenticated');
      expect(error.name).toBe('AuthenticationError');
    });

    test('creates error with custom message', () => {
      const customMessage = 'Custom auth error';
      const error = new AuthenticationError(customMessage);
      expect(error.message).toBe(customMessage);
      expect(error.name).toBe('AuthenticationError');
    });
  });
});
