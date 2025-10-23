/**
 * Geo-Location Type Definitions
 * Implements privacy-first geographic content filtering with DSA compliance
 * Part of Task 10: Geo-Location Service (Requirements 9.1-9.7)
 */

export type LocationMethod = 'ip' | 'gps' | 'device_region';
export type RestrictionReasonCode =
  | 'illegal_content'
  | 'policy_violation'
  | 'legal_request'
  | 'age_restriction';
export type AppealStatus = 'pending' | 'under_review' | 'upheld' | 'rejected';
export type NotificationType = 'author_alert' | 'user_explainer';
export type DeliveryMethod = 'push' | 'email' | 'in_app';
export type DeliveryStatus = 'pending' | 'sent' | 'failed';
export type ContentType = 'post' | 'comment' | 'user_content';

/**
 * Location data structure returned by geolocation services
 */
export interface LocationData {
  country: string; // ISO 3166-1 alpha-2 code (e.g., 'DE', 'FR')
  region?: string; // State/province/region name
  city?: string;
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  timezone?: string;
}

/**
 * Location result with metadata about detection method
 */
export interface LocationResult {
  location: LocationData;
  method: LocationMethod;
  vpnDetected?: boolean;
  confidenceScore?: number; // 0.0 to 1.0
  timestamp: Date;
}

/**
 * Request for IP-based geolocation
 */
export interface IPLocationRequest {
  ipAddress?: string; // If not provided, use request IP
  includeVpnCheck?: boolean;
}

/**
 * Geographic restriction on content
 */
export interface GeoRestriction {
  id: string;
  contentId: string;
  contentType: ContentType;
  restrictedRegions: string[]; // ISO 3166-1 alpha-2 codes
  permittedRegions: string[]; // Empty = available in non-restricted regions
  lawfulBasis: string;
  reasonCode: RestrictionReasonCode;
  includeInSoR: boolean; // Include in Statement of Reasons
  appliedBy?: string; // User ID of moderator/system
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Content availability result for user's location
 */
export interface AvailabilityResult {
  available: boolean;
  reason?: RestrictionReasonCode;
  lawfulBasis?: string;
  affectedRegions?: string[];
  explainerText?: string; // User-facing "why can't I see this?" message
}

/**
 * Cached location data with expiry
 */
export interface GeoLocationCache {
  id: string;
  userId: string;
  locationMethod: LocationMethod;
  locationData: LocationData;
  vpnDetected: boolean;
  confidenceScore?: number;
  expiresAt: Date;
  cachedAt: Date;
}

/**
 * Region-specific content filtering rule
 */
export interface GeoRestrictionRule {
  id: string;
  regionCode: string; // ISO 3166-1 alpha-2 or 'EU'
  ruleType: string; // e.g., 'cannabis_content', 'age_restricted'
  ruleConfig: {
    action: 'block' | 'age_gate' | 'warning';
    minAge?: number;
    reason?: string;
    [key: string]: unknown;
  };
  lawfulBasis: string;
  priority: number; // Higher = applied first
  effectiveFrom: Date;
  expiresAt?: Date;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Appeal for false positive geo-restriction
 */
export interface GeoRestrictionAppeal {
  id: string;
  restrictionId: string;
  userId: string;
  appealReason: string;
  supportingEvidence?: {
    locationType?: string;
    locationProof?: string[];
    travelDocuments?: string[];
    [key: string]: unknown;
  };
  status: AppealStatus;
  reviewerId?: string;
  reviewNotes?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification about geo-restriction to author/user
 */
export interface GeoRestrictionNotification {
  id: string;
  restrictionId: string;
  recipientId: string;
  notificationType: NotificationType;
  deliveryMethod: DeliveryMethod;
  deliveryStatus: DeliveryStatus;
  sentAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * Input for creating a geo-restriction
 */
export interface CreateGeoRestrictionInput {
  contentId: string;
  contentType: ContentType;
  restrictedRegions: string[];
  permittedRegions?: string[];
  lawfulBasis: string;
  reasonCode: RestrictionReasonCode;
  includeInSoR?: boolean;
  appliedBy?: string;
  expiresAt?: Date;
}

/**
 * Input for submitting a geo-restriction appeal
 */
export interface SubmitAppealInput {
  restrictionId: string;
  userId: string;
  appealReason: string;
  supportingEvidence?: {
    locationType?: string;
    locationProof?: string[];
    travelDocuments?: string[];
    [key: string]: unknown;
  };
}

/**
 * Configuration for geo-location service
 */
export interface GeoLocationConfig {
  vpnBlockingEnabled: boolean;
  cacheTtlMs: number; // Default: 3600000 (1 hour)
  ruleUpdateSlaMs: number; // Default: 14400000 (4 hours)
  ipProvider: 'ipapi' | 'supabase' | 'cloudflare';
  defaultConfidenceThreshold: number; // 0.0 to 1.0
}

/**
 * VPN/Proxy detection result
 */
export interface VpnDetectionResult {
  detected: boolean;
  confidence: number; // 0.0 to 1.0
  reason?: string;
  cached: boolean;
}

/**
 * Signal mismatch resolution strategy
 * When IP location differs from device region
 */
export type MismatchResolutionStrategy =
  | 'most_restrictive'
  | 'ip_priority'
  | 'device_priority';

/**
 * Geo-location service interface (from design.md)
 */
export interface GeoLocationService {
  detectUserLocationIP(request: IPLocationRequest): Promise<LocationResult>;
  requestGPSLocation(
    userId: string,
    purpose: string,
    hasConsent: boolean
  ): Promise<LocationResult>;
  checkContentAvailability(
    contentId: string,
    location: LocationData
  ): Promise<AvailabilityResult>;
  applyGeoRestriction(
    contentId: string,
    restrictedRegions: string[],
    includeInSoR: boolean
  ): Promise<void>;
  notifyGeoRestriction(
    userId: string,
    contentId: string,
    regions: string[]
  ): Promise<void>;
  setVpnBlocking(enabled: boolean): Promise<void>;
  getDecisionTtlMs(): number;
}

/**
 * Error code types for geo-location operations
 */
export type GeoLocationErrorCode =
  | 'GPS_PERMISSION_DENIED'
  | 'GPS_UNAVAILABLE'
  | 'IP_LOOKUP_FAILED'
  | 'INVALID_REGION_CODE'
  | 'RESTRICTION_NOT_FOUND'
  | 'NOTIFICATION_FAILED'
  | 'CACHE_EXPIRED'
  | 'VPN_DETECTED'
  | 'APPEAL_INELIGIBLE';

/**
 * Error class for geo-location operations
 */
export class GeoLocationError extends Error {
  constructor(
    message: string,
    public code: GeoLocationErrorCode,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GeoLocationError';
  }
}
