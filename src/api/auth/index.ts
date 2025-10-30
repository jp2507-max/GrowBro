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

// Email Verification
export {
  useResendVerificationEmail,
  useVerifyEmail,
} from './use-email-verification';

// Sign Out
export { useSignOut, useSignOutGlobal } from './use-sign-out';

// Session Management
export {
  deriveSessionKey,
  useCheckSessionRevocation,
  useRevokeAllOtherSessions,
  useRevokeSession,
  useSessions,
} from './use-sessions';

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
