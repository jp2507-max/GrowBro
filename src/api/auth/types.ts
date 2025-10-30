/**
 * Type definitions for authentication API
 */

import type { Session, User } from '@supabase/supabase-js';

// Sign In
export interface SignInVariables {
  email: string;
  password: string;
  appVersion?: string;
}

export interface SignInResponse {
  session: Session;
  user: User;
}

// Sign Up
export interface SignUpVariables {
  email: string;
  password: string;
}

export interface SignUpResponse {
  session: Session | null;
  user: User | null;
}

// OAuth
export type OAuthProvider = 'apple' | 'google';

export interface OAuthVariables {
  provider: OAuthProvider;
}

export interface OAuthResponse {
  provider: OAuthProvider;
  url: string;
}

export interface ExchangeOAuthCodeVariables {
  code: string;
}

export interface SignInWithIdTokenVariables {
  provider: OAuthProvider;
  idToken: string;
  nonce?: string;
}

// Password Reset
export interface ResetPasswordVariables {
  email: string;
}

export interface ConfirmPasswordResetVariables {
  tokenHash?: string;
  newPassword: string;
}

// Email Verification
export interface VerifyEmailVariables {
  tokenHash: string;
  type: 'signup' | 'email_change';
}

export interface ResendVerificationVariables {
  email: string;
}

// Error Response
export interface AuthErrorResponse {
  error: string;
  code: string;
  metadata?: Record<string, any>;
}

// Session Management
export interface UserSession {
  id: string;
  user_id: string;
  session_key: string;
  device_name: string;
  device_os: string;
  app_version: string;
  ip_address_truncated: string;
  last_active_at: string;
  created_at: string;
  revoked_at: string | null;
}
