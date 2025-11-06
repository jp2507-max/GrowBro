/**
 * Core type definitions for security infrastructure
 */

// ==================== Encrypted Storage Types ====================

export interface SecureStorageConfig {
  id: string;
  encryptionKey: string;
}

export interface StorageAuditResult {
  success: boolean;
  encryptionVerified: boolean;
  instancesAudited: string[];
  encryptionMode: 'hardware' | 'software' | 'unknown';
  keyAge?: number;
  issues: string[];
  timestamp: number;
}

export interface StorageAuditReport {
  auditResults: StorageAuditResult;
  instanceList: string[];
  keyMetadata: {
    createdAt: number;
    rotationCount: number;
    isHardwareBacked: boolean;
  };
  recommendations: string[];
}

export interface KeyManager {
  generateKey(): Promise<string>;
  storeKey(keyId: string, key: string): Promise<void>;
  retrieveKey(keyId: string): Promise<string | null>;
  rotateKey(keyId: string): Promise<string>;
  deleteKey(keyId: string): Promise<void>;
  getKeyMetadata(keyId: string): Promise<KeyMetadata | null>;
}

export interface KeyMetadata {
  createdAt: number;
  rotationCount: number;
  isHardwareBacked: boolean;
  lastRotationAt?: number;
}

export interface SecureStorage {
  set(key: string, value: string | number | boolean): void;
  get(key: string): string | number | boolean | undefined;
  delete(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
  recrypt(newKey: string): Promise<void>;
}

export interface StorageAuditor {
  verifyEncryption(): Promise<StorageAuditResult>;
  checkSentinel(): Promise<boolean>;
  generateReport(): Promise<StorageAuditReport>;
}

// ==================== Device Integrity Types ====================

export interface IntegrityStatus {
  isCompromised: boolean;
  detectionMethod: string;
  indicators: string[];
  timestamp: number;
  platform: 'ios' | 'android';
  expiresAt: number;
}

export interface IntegrityDetector {
  checkIntegrity(): Promise<IntegrityStatus>;
  isJailbroken(): Promise<boolean>;
  isRooted(): Promise<boolean>;
  getCompromiseIndicators(): Promise<string[]>;
}

export interface AttestationResult {
  isValid: boolean;
  token: string;
  verdict: string;
  timestamp: number;
  expiresAt: number;
}

export interface AttestationService {
  requestAttestation(): Promise<AttestationResult>;
  verifyAttestation(token: string): Promise<boolean>;
}

export interface IntegrityCache {
  get(): IntegrityStatus | null;
  set(status: IntegrityStatus): void;
  isExpired(): boolean;
  clear(): void;
}

// ==================== Certificate Pinning Types ====================

export interface PinConfiguration {
  hostname: string;
  pins: string[];
  includeSubdomains?: boolean;
  publicKeyHashes?: string[];
  version: number;
  createdAt: number;
  expiresAt?: number;
}

export interface CertificatePinner {
  validateCertificate(hostname: string, certificate: string): Promise<boolean>;
  getPins(hostname: string): string[];
  updatePins(config: PinConfiguration): Promise<void>;
}

export interface PinConfigManager {
  loadBundledConfig(): PinConfiguration[];
  fetchRemoteConfig(): Promise<PinConfiguration[]>;
  validateConfigIntegrity(config: string): boolean;
  mergeConfigs(
    bundled: PinConfiguration[],
    remote: PinConfiguration[]
  ): PinConfiguration[];
  getCachedConfig(): PinConfiguration[] | null;
  cacheConfig(config: PinConfiguration[]): void;
}

// ==================== Threat Monitoring Types ====================

export type SecurityEventType =
  | 'auth_failed'
  | 'integrity_compromised'
  | 'pin_violation'
  | 'rate_limit_hit'
  | 'session_anomaly'
  | 'storage_rekey';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: number;
  deviceFingerprint: string;
  metadata: Record<string, unknown>;
}

export interface SecurityEventLogger {
  log(event: SecurityEvent): void;
  logAuthFailure(metadata: Record<string, unknown>): void;
  logIntegrityCompromise(metadata: Record<string, unknown>): void;
  logPinViolation(metadata: Record<string, unknown>): void;
  logRateLimitHit(metadata: Record<string, unknown>): void;
  logSessionAnomaly(metadata: Record<string, unknown>): void;
  logStorageRekey(metadata: Record<string, unknown>): void;
}

export interface AuthThrottler {
  recordAttempt(): void;
  canAttempt(): boolean;
  getRemainingLockoutTime(): number;
  reset(): void;
  getAttemptCount(): number;
}

// ==================== PII Scrubbing Types ====================

export interface PIIScrubber {
  scrubEvent(event: unknown): unknown;
  scrubBreadcrumb(breadcrumb: unknown): unknown;
  scrubString(value: string): string;
  containsPII(value: string): boolean;
}

export interface PIIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

// ==================== Vulnerability Management Types ====================

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Vulnerability {
  id: string;
  cveId?: string;
  severity: VulnerabilitySeverity;
  packageName: string;
  installedVersion: string;
  fixedVersion?: string;
  title: string;
  description: string;
  recommendation: string;
  detectedAt: number;
}

export interface VulnerabilityScanResult {
  vulnerabilities: Vulnerability[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scanTimestamp: number;
  commitHash?: string;
}

export interface VulnerabilityTriager {
  triage(vulnerabilities: Vulnerability[]): Promise<void>;
  assignSLA(vulnerability: Vulnerability): Date;
  createIssue(vulnerability: Vulnerability): Promise<string>;
}

export interface SBOM {
  format: 'CycloneDX' | 'SPDX';
  version: string;
  components: SBOMComponent[];
  metadata: {
    timestamp: number;
    commitHash?: string;
  };
}

export interface SBOMComponent {
  name: string;
  version: string;
  type: string;
  licenses?: string[];
}

// ==================== Breach Response Types ====================

export interface IncidentReport {
  incidentId: string;
  detectedAt: number;
  reportedAt: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers: number;
  affectedDataTypes: string[];
  timeline: IncidentTimelineEntry[];
  rootCause?: string;
  cwes?: string[];
  status: 'active' | 'contained' | 'resolved';
}

export interface IncidentTimelineEntry {
  timestamp: number;
  event: string;
  actor: string;
}

export interface IncidentCoordinator {
  createIncident(severity: string): Promise<IncidentReport>;
  updateIncident(
    incidentId: string,
    updates: Partial<IncidentReport>
  ): Promise<void>;
  exportTimeline(incidentId: string): Promise<string>;
  notifyStakeholders(incidentId: string): Promise<void>;
}

export interface EvidenceCollector {
  exportAuditLogs(startTime: number, endTime: number): Promise<string>;
  captureIntegrityCache(): Promise<string>;
  preserveSentryEvents(incidentId: string): Promise<string[]>;
  generateEvidenceReport(): Promise<string>;
}

// ==================== Security Audit Types ====================

export interface SecurityAuditResult {
  passed: boolean;
  timestamp: number;
  commitHash: string;
  environment: string;
  checks: SecurityCheck[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
  };
}

export interface SecurityCheck {
  name: string;
  category: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  remediation?: string;
}

export interface SecurityAuditor {
  runAudit(): Promise<SecurityAuditResult>;
  checkEncryption(): Promise<SecurityCheck>;
  checkPinning(): Promise<SecurityCheck>;
  checkPIIScrubbing(): Promise<SecurityCheck>;
  checkIntegrity(): Promise<SecurityCheck>;
  generateReport(result: SecurityAuditResult): Promise<string>;
}

export interface ComplianceReporter {
  generateComplianceReport(): Promise<string>;
  signReport(report: string): Promise<string>;
  exportReport(format: 'json' | 'csv'): Promise<string>;
}

// ==================== Security Initialization Types ====================

export interface SecurityInitializer {
  initialize(): Promise<void>;
  isInitialized(): boolean;
  getInitializationStatus(): SecurityInitializationStatus;
}

export interface SecurityInitializationStatus {
  storageInitialized: boolean;
  integrityChecked: boolean;
  pinningConfigured: boolean;
  sentryConfigured: boolean;
  threatMonitoringActive: boolean;
  errors: string[];
}

// ==================== Device Fingerprint Types ====================

export interface DeviceFingerprint {
  installId: string;
  hashedId: string;
  deviceCategory: string;
  createdAt: number;
}

export interface DeviceFingerprintGenerator {
  generate(): Promise<DeviceFingerprint>;
  getInstallId(): Promise<string>;
  getHashedId(): Promise<string>;
  getDeviceCategory(): string;
}
