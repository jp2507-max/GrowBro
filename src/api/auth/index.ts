/**
 * Authentication API exports
 *
 * Provides React Query hooks for authentication operations:
 * - Email/password sign in and sign up
 * - OAuth authentication (Apple, Google)
 * - Password reset
 * - Email verification
 * - Sign out (local and global)
 */

// Sign In / Sign Up
export { useSignIn } from './use-sign-in';
export { useSignUp, validatePassword } from './use-sign-up';

// OAuth
export {
  useExchangeOAuthCode,
  useSignInWithIdToken,
  useSignInWithOAuth,
} from './use-oauth';

// Password Reset
export {
  useConfirmPasswordReset,
  useResetPassword,
} from './use-password-reset';

// Password Change
export type { ChangePasswordVariables } from './use-change-password';
export { useChangePassword } from './use-change-password';

// Email Verification
export {
  useResendVerificationEmail,
  useVerifyEmail,
} from './use-email-verification';

// Sign Out
export { useSignOut, useSignOutGlobal } from './use-sign-out';

// Account Deletion
export { useDeleteAccount } from './use-delete-account';
export {
  checkPendingDeletion,
  useCancelAccountDeletion,
  useRequestAccountDeletion,
} from './use-request-account-deletion';

// Session Management
export {
  useCheckSessionRevocation,
  useRevokeAllOtherSessions,
  useRevokeSession,
  useSessions,
} from './use-sessions';

// Utility functions
export { deriveSessionKey } from '@/lib/auth/utils';

// Error handling
export {
  extractErrorMessage,
  getLockoutMinutes,
  isAccountLocked,
  mapAuthError,
} from './error-mapper';

// Types
export type {
  AuthErrorResponse,
  ConfirmPasswordResetVariables,
  ExchangeOAuthCodeVariables,
  OAuthProvider,
  OAuthResponse,
  OAuthVariables,
  ResendVerificationVariables,
  ResetPasswordVariables,
  SignInResponse,
  SignInVariables,
  SignInWithIdTokenVariables,
  SignUpResponse,
  SignUpVariables,
  UserSession,
  VerifyEmailVariables,
} from './types';
