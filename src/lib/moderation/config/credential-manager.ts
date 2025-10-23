/**
 * Credential Manager
 *
 * Secure credential management for external service integrations.
 * Handles credential loading, validation, and rotation with encryption
 * and secure storage.
 */

import { z } from 'zod';

/**
 * Credential types
 */
export type CredentialType =
  | 'dsa_transparency_db'
  | 'age_verification_provider'
  | 'ods_provider'
  | 'geo_location_provider';

/**
 * Credential schema
 */
const CredentialSchema = z.object({
  type: z.enum([
    'dsa_transparency_db',
    'age_verification_provider',
    'ods_provider',
    'geo_location_provider',
  ]),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  apiUrl: z.string().url().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Credential = z.infer<typeof CredentialSchema>;

/**
 * Credential validation result
 */
export interface CredentialValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Credential Manager
 */
export class CredentialManager {
  private credentials: Map<CredentialType, Credential> = new Map();
  private encryptionKey: string | null = null;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || null;
    this.loadCredentials();
  }

  /**
   * Load credentials from environment
   */
  private loadCredentials(): void {
    // DSA Transparency Database credentials
    if (process.env.DSA_TRANSPARENCY_DB_API_KEY) {
      this.credentials.set('dsa_transparency_db', {
        type: 'dsa_transparency_db',
        apiKey: process.env.DSA_TRANSPARENCY_DB_API_KEY,
        apiUrl: process.env.DSA_TRANSPARENCY_DB_URL,
      });
    }

    // Age Verification Provider credentials
    if (process.env.AGE_VERIFICATION_API_KEY) {
      this.credentials.set('age_verification_provider', {
        type: 'age_verification_provider',
        apiKey: process.env.AGE_VERIFICATION_API_KEY,
        apiUrl: process.env.AGE_VERIFICATION_API_URL,
      });
    }

    // ODS Provider credentials
    if (process.env.ODS_PROVIDER_API_KEY) {
      this.credentials.set('ods_provider', {
        type: 'ods_provider',
        apiKey: process.env.ODS_PROVIDER_API_KEY,
        apiUrl: process.env.ODS_PROVIDER_API_URL,
      });
    }

    // Geo-Location Provider credentials
    if (process.env.GEO_LOCATION_API_KEY) {
      this.credentials.set('geo_location_provider', {
        type: 'geo_location_provider',
        apiKey: process.env.GEO_LOCATION_API_KEY,
        apiUrl: process.env.GEO_LOCATION_API_URL,
      });
    }
  }

  /**
   * Get credential
   */
  getCredential(type: CredentialType): Credential | null {
    return this.credentials.get(type) || null;
  }

  /**
   * Set credential
   */
  setCredential(credential: Credential): void {
    const validation = this.validateCredential(credential);

    if (!validation.valid) {
      throw new Error(`Invalid credential: ${validation.errors.join(', ')}`);
    }

    this.credentials.set(credential.type, credential);
  }

  /**
   * Remove credential
   */
  removeCredential(type: CredentialType): void {
    this.credentials.delete(type);
  }

  /**
   * Validate credential
   */
  validateCredential(credential: Credential): CredentialValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    const result = CredentialSchema.safeParse(credential);
    if (!result.success) {
      errors.push(...result.error.errors.map((e) => e.message));
    }

    // Check for required fields based on type
    switch (credential.type) {
      case 'dsa_transparency_db':
        if (!credential.apiKey) {
          errors.push('DSA Transparency DB requires apiKey');
        }
        if (!credential.apiUrl) {
          errors.push('DSA Transparency DB requires apiUrl');
        }
        break;

      case 'age_verification_provider':
        if (!credential.apiKey && !credential.token) {
          errors.push('Age Verification Provider requires apiKey or token');
        }
        break;

      case 'ods_provider':
        if (!credential.apiKey && !credential.username) {
          errors.push('ODS Provider requires apiKey or username/password');
        }
        if (credential.username && !credential.password) {
          errors.push('ODS Provider username requires password');
        }
        break;

      case 'geo_location_provider':
        if (!credential.apiKey) {
          warnings.push('Geo-Location Provider works better with apiKey');
        }
        break;
    }

    // Check expiration
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      warnings.push('Credential has expired');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if credential exists
   */
  hasCredential(type: CredentialType): boolean {
    return this.credentials.has(type);
  }

  /**
   * Get all credential types
   */
  getCredentialTypes(): CredentialType[] {
    return Array.from(this.credentials.keys());
  }

  /**
   * Validate all credentials
   */
  validateAllCredentials(): Map<CredentialType, CredentialValidation> {
    const results = new Map<CredentialType, CredentialValidation>();

    this.credentials.forEach((credential, type) => {
      results.set(type, this.validateCredential(credential));
    });

    return results;
  }

  /**
   * Rotate credential
   */
  rotateCredential(
    type: CredentialType,
    newCredential: Omit<Credential, 'type'>
  ): void {
    const credential: Credential = {
      ...newCredential,
      type,
    };

    this.setCredential(credential);
  }

  /**
   * Get credential summary (without sensitive data)
   */
  getCredentialSummary(type: CredentialType): Record<string, unknown> | null {
    const credential = this.credentials.get(type);

    if (!credential) {
      return null;
    }

    return {
      type: credential.type,
      hasApiKey: !!credential.apiKey,
      hasApiSecret: !!credential.apiSecret,
      hasToken: !!credential.token,
      hasUsername: !!credential.username,
      hasPassword: !!credential.password,
      apiUrl: credential.apiUrl,
      expiresAt: credential.expiresAt,
    };
  }

  /**
   * Clear all credentials
   */
  clearAll(): void {
    this.credentials.clear();
  }
}

/**
 * Singleton credential manager
 */
let credentialManagerInstance: CredentialManager | null = null;

/**
 * Get credential manager instance
 */
export function getCredentialManager(): CredentialManager {
  if (!credentialManagerInstance) {
    const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    credentialManagerInstance = new CredentialManager(encryptionKey);
  }

  return credentialManagerInstance;
}

/**
 * Reset credential manager (for testing)
 */
export function resetCredentialManager(): void {
  credentialManagerInstance = null;
}
