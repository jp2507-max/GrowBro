/**
 * Shared database record types for Supabase queries
 */

export type DbContentRestriction = {
  id: string;
  content_id: string;
  content_type: string;
  is_age_restricted: boolean;
  min_age: number;
  flagged_by_system: boolean;
  flagged_by_author: boolean;
  flagged_by_moderator: boolean;
  moderator_id: string | null;
  restriction_reason: string | null;
  keywords_detected: string[] | null;
  created_at: string;
  updated_at: string;
};

export type DbUserAgeStatus = {
  user_id: string;
  is_age_verified: boolean;
  verified_at: string | null;
  active_token_id: string | null;
  is_minor: boolean;
  minor_protections_enabled: boolean;
  show_age_restricted_content: boolean;
  created_at: string;
  updated_at: string;
};

export type DbTokenRecord = {
  id: string;
  user_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  used_at: string | null;
  use_count: number;
  max_uses: number;
  verification_method: string;
  verification_provider: string | null;
  assurance_level: string | null;
  age_attribute_verified: boolean;
  created_at: string;
  updated_at: string;
};
