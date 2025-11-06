/**
 * Storage auditor for encryption verification and security compliance
 * Validates that sensitive data is properly encrypted and not stored in plain text
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MMKV } from 'react-native-mmkv';

import {
  ENCRYPTION_SENTINEL_KEY,
  ENCRYPTION_SENTINEL_VALUE,
  KEY_DOMAIN_MAP,
  STORAGE_DOMAINS,
} from './constants';
import { keyManager } from './key-manager';
import {
  getAllInstances,
  getInitializedDomains,
  isSecureStorageInitialized,
} from './secure-storage';
import type {
  StorageAuditor,
  StorageAuditReport,
  StorageAuditResult,
} from './types';

// Simple logger using console
const log = {
  debug: (msg: string, ...args: any[]) =>
    console.log(`[StorageAuditor] ${msg}`, ...args),
  info: (msg: string, ...args: any[]) =>
    console.info(`[StorageAuditor] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) =>
    console.warn(`[StorageAuditor] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) =>
    console.error(`[StorageAuditor] ${msg}`, ...args),
};

// ==================== Sentinel Verification ====================

/**
 * Check sentinel key in all MMKV instances to verify encryption
 * If sentinel value doesn't match, encryption may have failed
 *
 * @returns Promise<boolean> - true if all sentinels are valid
 */
async function checkSentinel(): Promise<boolean> {
  const instances = getAllInstances();
  let allValid = true;

  for (const [domain, instance] of instances) {
    const sentinelValue = instance.getString(ENCRYPTION_SENTINEL_KEY);

    if (sentinelValue !== ENCRYPTION_SENTINEL_VALUE) {
      log.error(`Sentinel verification failed for domain: ${domain}`, {
        expected: ENCRYPTION_SENTINEL_VALUE,
        actual: sentinelValue,
      });
      allValid = false;
    }
  }

  return allValid;
}

// ==================== Unencrypted Storage Scan ====================

/**
 * Scan for sensitive keys in AsyncStorage (unencrypted)
 * This should never happen if the app is properly configured
 *
 * @returns Promise<string[]> - List of sensitive keys found in AsyncStorage
 */
async function scanAsyncStorage(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const sensitiveKeys: string[] = [];

    // Check for keys that should be in encrypted storage
    for (const key of allKeys) {
      // Check if key matches any known sensitive pattern
      const isSensitive =
        key.includes('auth') ||
        key.includes('token') ||
        key.includes('session') ||
        key.includes('password') ||
        key.includes('secret') ||
        key.includes('user:preferences') ||
        key.includes('sync:');

      if (isSensitive) {
        sensitiveKeys.push(key);
        log.warn(`Found sensitive key in AsyncStorage: ${key}`);
      }
    }

    return sensitiveKeys;
  } catch (error) {
    log.error('Failed to scan AsyncStorage', error);
    return [];
  }
}

/**
 * Create a temporary unencrypted MMKV instance to check for leaks
 * If sensitive keys are found, encryption has failed
 *
 * @returns Promise<string[]> - List of sensitive keys found without encryption
 */
async function scanUnencryptedMMKV(): Promise<string[]> {
  try {
    const domains = Object.values(STORAGE_DOMAINS);
    const leakedKeys: string[] = [];

    for (const domain of domains) {
      // Create unencrypted instance with same ID to check if data is accessible without encryption
      // Note: This may conflict with existing encrypted instances, but we need to detect leaks
      const unencryptedInstance = new MMKV({
        id: domain,
      });

      const keys = unencryptedInstance.getAllKeys();

      // Check if any keys exist (should be empty if encryption is working)
      if (keys.length > 0) {
        log.error(
          `Found keys accessible without encryption for domain: ${domain}`,
          {
            keys,
          }
        );
        leakedKeys.push(...keys.map((k) => `${domain}:${k}`));
      }

      // Clean up the temporary unencrypted instance
      unencryptedInstance.clearAll();
    }

    return leakedKeys;
  } catch (error) {
    log.error('Failed to scan unencrypted MMKV', error);
    return [];
  }
}

// ==================== Key Domain Mapping Validation ====================

/**
 * Validate that keys are stored in the correct domain
 * Detects domain drift if keys are in wrong storage instance
 *
 * @returns Promise<string[]> - List of keys found in wrong domain
 */
async function validateKeyDomainMapping(): Promise<string[]> {
  const instances = getAllInstances();
  const driftedKeys: string[] = [];

  for (const [domain, instance] of instances) {
    const keys = instance.getAllKeys();

    for (const key of keys) {
      // Skip sentinel key
      if (key === ENCRYPTION_SENTINEL_KEY) {
        continue;
      }

      // Check if key should be in this domain
      const expectedDomain = KEY_DOMAIN_MAP[key];

      if (expectedDomain && expectedDomain !== domain) {
        log.warn(`Key in wrong domain: ${key}`, {
          currentDomain: domain,
          expectedDomain,
        });
        driftedKeys.push(
          `${key} (expected: ${expectedDomain}, found: ${domain})`
        );
      }
    }
  }

  return driftedKeys;
}

// ==================== Encryption Mode Detection ====================

/**
 * Determine encryption mode (hardware vs software)
 * Checks metadata for all domains and returns overall status
 *
 * @returns Promise<'hardware' | 'software' | 'unknown'>
 */
async function detectEncryptionMode(): Promise<
  'hardware' | 'software' | 'unknown'
> {
  try {
    const domains = Object.values(STORAGE_DOMAINS);
    let hasHardware = false;
    let hasSoftware = false;

    for (const domain of domains) {
      const keyId = `mmkv.${domain}`;
      const metadata = await keyManager.getKeyMetadata(keyId);

      if (!metadata) {
        continue;
      }

      if (metadata.isHardwareBacked) {
        hasHardware = true;
      } else {
        hasSoftware = true;
      }
    }

    // If mixed, report software (most conservative)
    if (hasSoftware) {
      return 'software';
    }

    if (hasHardware) {
      return 'hardware';
    }

    return 'unknown';
  } catch (error) {
    log.error('Failed to detect encryption mode', error);
    return 'unknown';
  }
}

// ==================== Key Age Calculation ====================

/**
 * Get oldest key age across all domains
 *
 * @returns Promise<number | undefined> - Age in days, or undefined if no metadata
 */
async function getOldestKeyAge(): Promise<number | undefined> {
  try {
    const domains = Object.values(STORAGE_DOMAINS);
    let oldestAge: number | undefined;

    for (const domain of domains) {
      const keyId = `mmkv.${domain}`;
      const metadata = await keyManager.getKeyMetadata(keyId);

      if (!metadata) {
        continue;
      }

      const ageMs = Date.now() - metadata.createdAt;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

      if (oldestAge === undefined || ageDays > oldestAge) {
        oldestAge = ageDays;
      }
    }

    return oldestAge;
  } catch (error) {
    log.error('Failed to calculate key age', error);
    return undefined;
  }
}

// ==================== Audit Execution ====================

/**
 * Verify encryption status across all storage domains
 *
 * @returns Promise<StorageAuditResult>
 */
async function verifyEncryption(): Promise<StorageAuditResult> {
  const issues: string[] = [];
  const timestamp = Date.now();

  // Check if storage is initialized
  if (!isSecureStorageInitialized()) {
    issues.push('Secure storage not initialized');
    return {
      success: false,
      encryptionVerified: false,
      instancesAudited: [],
      encryptionMode: 'unknown',
      issues,
      timestamp,
    };
  }

  // Check sentinel keys
  const sentinelValid = await checkSentinel();
  if (!sentinelValid) {
    issues.push('Sentinel verification failed for one or more domains');
  }

  // Scan AsyncStorage for sensitive keys
  const asyncStorageLeaks = await scanAsyncStorage();
  if (asyncStorageLeaks.length > 0) {
    issues.push(
      `Found ${asyncStorageLeaks.length} sensitive keys in AsyncStorage: ${asyncStorageLeaks.join(', ')}`
    );
  }

  // Scan unencrypted MMKV
  const unencryptedLeaks = await scanUnencryptedMMKV();
  if (unencryptedLeaks.length > 0) {
    issues.push(
      `Found ${unencryptedLeaks.length} keys in unencrypted MMKV: ${unencryptedLeaks.join(', ')}`
    );
  }

  // Validate key domain mapping
  const driftedKeys = await validateKeyDomainMapping();
  if (driftedKeys.length > 0) {
    issues.push(
      `Found ${driftedKeys.length} keys in wrong domain: ${driftedKeys.join(', ')}`
    );
  }

  // Detect encryption mode
  const encryptionMode = await detectEncryptionMode();

  // Get key age
  const keyAge = await getOldestKeyAge();

  // Get initialized domains
  const instancesAudited = getInitializedDomains();

  const success = issues.length === 0 && sentinelValid;

  return {
    success,
    encryptionVerified: sentinelValid,
    instancesAudited,
    encryptionMode,
    keyAge,
    issues,
    timestamp,
  };
}

/**
 * Generate comprehensive audit report with recommendations
 *
 * @returns Promise<StorageAuditReport>
 */
async function generateReport(): Promise<StorageAuditReport> {
  log.info('Generating storage audit report');

  const auditResults = await verifyEncryption();
  const recommendations: string[] = [];

  // Add recommendations based on issues
  if (!auditResults.success) {
    recommendations.push('Review and remediate all identified issues');
  }

  if (auditResults.encryptionMode === 'software') {
    recommendations.push(
      'Hardware-backed encryption not available. Consider device upgrade for enhanced security.'
    );
  }

  if (auditResults.encryptionMode === 'unknown') {
    recommendations.push(
      'Unable to determine encryption mode. Verify keychain configuration.'
    );
  }

  if (auditResults.keyAge && auditResults.keyAge > 365) {
    recommendations.push(
      `Encryption keys are ${auditResults.keyAge} days old. Consider key rotation.`
    );
  }

  if (auditResults.issues.some((issue) => issue.includes('AsyncStorage'))) {
    recommendations.push(
      'Migrate sensitive data from AsyncStorage to encrypted MMKV storage'
    );
  }

  // Collect key metadata for all domains
  const domains = Object.values(STORAGE_DOMAINS);
  let keyMetadata = {
    createdAt: 0,
    rotationCount: 0,
    isHardwareBacked: false,
  };

  for (const domain of domains) {
    const keyId = `mmkv.${domain}`;
    const metadata = await keyManager.getKeyMetadata(keyId);

    if (
      metadata &&
      (keyMetadata.createdAt === 0 ||
        metadata.createdAt < keyMetadata.createdAt)
    ) {
      // Use oldest key's metadata
      keyMetadata = metadata;
    }
  }

  return {
    auditResults,
    instanceList: auditResults.instancesAudited,
    keyMetadata,
    recommendations,
  };
}

// ==================== Exported Storage Auditor ====================

export const storageAuditor: StorageAuditor = {
  verifyEncryption,
  checkSentinel,
  generateReport,
};

// ==================== Audit Evidence Generation ====================

/**
 * Generate audit evidence JSON for compliance
 * This is used to prove that sensitive data is encrypted
 *
 * @returns Promise<string> - JSON string with audit evidence
 */
export async function generateAuditEvidence(): Promise<string> {
  const report = await generateReport();

  const evidence = {
    timestamp: new Date().toISOString(),
    encryptionEnabled: report.auditResults.encryptionVerified,
    encryptionMode: report.auditResults.encryptionMode,
    instanceList: report.instanceList,
    keyAge: report.auditResults.keyAge,
    isHardwareBacked: report.keyMetadata.isHardwareBacked,
    rotationCount: report.keyMetadata.rotationCount,
    issues: report.auditResults.issues,
    recommendations: report.recommendations,
    domains: {
      auth: report.instanceList.includes(STORAGE_DOMAINS.AUTH),
      userData: report.instanceList.includes(STORAGE_DOMAINS.USER_DATA),
      syncMetadata: report.instanceList.includes(STORAGE_DOMAINS.SYNC_METADATA),
      securityCache: report.instanceList.includes(
        STORAGE_DOMAINS.SECURITY_CACHE
      ),
      featureFlags: report.instanceList.includes(STORAGE_DOMAINS.FEATURE_FLAGS),
    },
  };

  return JSON.stringify(evidence, null, 2);
}

// ==================== Static Code Scan (for CI) ====================

/**
 * Pattern to detect AsyncStorage usage in code
 * Should be run as part of CI to catch accidental AsyncStorage usage
 */
export const ASYNC_STORAGE_PATTERNS = [
  /AsyncStorage\.setItem\(/,
  /AsyncStorage\.getItem\(/,
  /AsyncStorage\.multiSet\(/,
  /AsyncStorage\.multiGet\(/,
];

/**
 * Sensitive key patterns that should never be in AsyncStorage
 */
export const SENSITIVE_KEY_PATTERNS = [
  /auth.*token/i,
  /refresh.*token/i,
  /session/i,
  /password/i,
  /secret/i,
  /api.*key/i,
];
