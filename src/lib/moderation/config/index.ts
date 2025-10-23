/**
 * Configuration Module
 *
 * Exports configuration management, credential management, and
 * environment-specific settings for the moderation system.
 */

export {
  type Credential,
  CredentialManager,
  type CredentialType,
  type CredentialValidation,
  getCredentialManager,
  resetCredentialManager,
} from './credential-manager';
export {
  createModerationConfig,
  type Environment,
  getModerationConfig,
  type ModerationConfig,
  resetModerationConfig,
  validateModerationConfig,
} from './moderation-config';
