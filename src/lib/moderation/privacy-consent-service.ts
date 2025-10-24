/**
 * Privacy Consent Service
 * Implements GDPR consent management and privacy notice delivery
 * Complies with GDPR Art. 7 (Conditions for consent) and Art. 13 (Information to be provided)
 */

import { supabase } from '@/lib/supabase';
import type { ConsentRecord, LegalBasis, PrivacyNotice } from '@/types/privacy';

export class PrivacyConsentService {
  /**
   * Get current privacy notice for a language
   */
  async getCurrentPrivacyNotice(
    language: string = 'en'
  ): Promise<PrivacyNotice | null> {
    const { data, error } = await supabase
      .from('privacy_notices')
      .select('*')
      .eq('language', language)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error fetching privacy notice:', error);
      return null;
    }

    return {
      id: data.id,
      version: data.version,
      effectiveDate: new Date(data.effective_date),
      content: data.content,
      language: data.language,
      dataCategories: data.data_categories,
      legalBases: data.legal_bases,
      retentionPeriods: data.retention_periods,
      thirdPartyProcessors: data.third_party_processors,
    };
  }

  /**
   * Create or update privacy notice
   */
  async createPrivacyNotice(
    notice: Omit<PrivacyNotice, 'id'>
  ): Promise<PrivacyNotice> {
    const { data, error } = await supabase
      .from('privacy_notices')
      .insert({
        version: notice.version,
        effective_date: notice.effectiveDate.toISOString(),
        content: notice.content,
        language: notice.language,
        data_categories: notice.dataCategories,
        legal_bases: notice.legalBases,
        retention_periods: notice.retentionPeriods,
        third_party_processors: notice.thirdPartyProcessors,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create privacy notice: ${error.message}`);
    }

    return {
      id: data.id,
      version: data.version,
      effectiveDate: new Date(data.effective_date),
      content: data.content,
      language: data.language,
      dataCategories: data.data_categories,
      legalBases: data.legal_bases,
      retentionPeriods: data.retention_periods,
      thirdPartyProcessors: data.third_party_processors,
    };
  }

  /**
   * Record user consent
   */
  async recordConsent(params: {
    userId: string;
    purpose: string;
    legalBasis: LegalBasis;
    privacyNoticeVersion: string;
    consentGiven?: boolean;
  }): Promise<ConsentRecord> {
    const {
      userId,
      purpose,
      legalBasis,
      privacyNoticeVersion,
      consentGiven = true,
    } = params;
    const consent: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      purpose,
      legalBasis,
      consentGiven,
      consentDate: new Date(),
      version: privacyNoticeVersion,
    };

    const { error } = await supabase.from('consent_records').insert({
      id: consent.id,
      user_id: consent.userId,
      purpose: consent.purpose,
      legal_basis: consent.legalBasis,
      consent_given: consent.consentGiven,
      consent_date: consent.consentDate.toISOString(),
      version: consent.version,
    });

    if (error) {
      throw new Error(`Failed to record consent: ${error.message}`);
    }

    return consent;
  }

  /**
   * Withdraw user consent
   */
  async withdrawConsent(
    userId: string,
    purpose: string
  ): Promise<ConsentRecord | null> {
    // Find active consent record
    const { data: existingConsent, error: fetchError } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .eq('consent_given', true)
      .is('withdrawn_date', null)
      .order('consent_date', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !existingConsent) {
      console.error('No active consent found to withdraw:', fetchError);
      return null;
    }

    // Mark as withdrawn
    const withdrawnDate = new Date();
    const { error: updateError } = await supabase
      .from('consent_records')
      .update({
        consent_given: false,
        withdrawn_date: withdrawnDate.toISOString(),
      })
      .eq('id', existingConsent.id);

    if (updateError) {
      throw new Error(`Failed to withdraw consent: ${updateError.message}`);
    }

    return {
      id: existingConsent.id,
      userId: existingConsent.user_id,
      purpose: existingConsent.purpose,
      legalBasis: existingConsent.legal_basis,
      consentGiven: false,
      consentDate: new Date(existingConsent.consent_date),
      withdrawnDate,
      version: existingConsent.version,
      metadata: existingConsent.metadata,
    };
  }

  /**
   * Check if user has given consent for a purpose
   */
  async hasConsent(userId: string, purpose: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('consent_records')
      .select('consent_given')
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .eq('consent_given', true)
      .is('withdrawn_date', null)
      .order('consent_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return false;
    }

    return data.consent_given === true;
  }

  /**
   * Get user's consent history
   */
  async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    const { data, error } = await supabase
      .from('consent_records')
      .select('*')
      .eq('user_id', userId)
      .order('consent_date', { ascending: false });

    if (error) {
      console.error('Error fetching consent history:', error);
      return [];
    }

    return (data || []).map((record) => ({
      id: record.id,
      userId: record.user_id,
      purpose: record.purpose,
      legalBasis: record.legal_basis,
      consentGiven: record.consent_given,
      consentDate: new Date(record.consent_date),
      withdrawnDate: record.withdrawn_date
        ? new Date(record.withdrawn_date)
        : undefined,
      version: record.version,
      metadata: record.metadata,
    }));
  }

  /**
   * Deliver privacy notice to user
   */
  async deliverPrivacyNotice(
    userId: string,
    language: string = 'en'
  ): Promise<{
    notice: PrivacyNotice | null;
    delivered: boolean;
  }> {
    const notice = await this.getCurrentPrivacyNotice(language);

    if (!notice) {
      return { notice: null, delivered: false };
    }

    // Record that notice was delivered
    const { error } = await supabase.from('privacy_notice_deliveries').insert({
      user_id: userId,
      notice_id: notice.id,
      delivered_at: new Date().toISOString(),
      language,
    });

    if (error) {
      console.error('Error recording privacy notice delivery:', error);
      return { notice, delivered: false };
    }

    return { notice, delivered: true };
  }

  /**
   * Check if user has acknowledged current privacy notice
   */
  async hasAcknowledgedPrivacyNotice(
    userId: string,
    language: string = 'en'
  ): Promise<boolean> {
    const currentNotice = await this.getCurrentPrivacyNotice(language);

    if (!currentNotice) {
      return false;
    }

    const { data, error } = await supabase
      .from('privacy_notice_deliveries')
      .select('id')
      .eq('user_id', userId)
      .eq('notice_id', currentNotice.id)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  }

  /**
   * Validate consent requirements for data processing
   */
  async validateConsentRequirements(
    userId: string,
    purposes: string[]
  ): Promise<{
    valid: boolean;
    missingConsents: string[];
  }> {
    const missingConsents: string[] = [];

    for (const purpose of purposes) {
      const hasConsent = await this.hasConsent(userId, purpose);
      if (!hasConsent) {
        missingConsents.push(purpose);
      }
    }

    return {
      valid: missingConsents.length === 0,
      missingConsents,
    };
  }

  /**
   * Get consent purposes that require explicit consent
   */
  getConsentPurposes(): {
    purpose: string;
    description: string;
    required: boolean;
  }[] {
    return [
      {
        purpose: 'content_moderation',
        description: 'Processing reports and moderation decisions',
        required: false, // Legal obligation basis
      },
      {
        purpose: 'behavioral_analytics',
        description: 'Analyzing usage patterns for abuse prevention',
        required: true, // Requires consent
      },
      {
        purpose: 'gps_location',
        description: 'Accessing precise GPS location for geo-restrictions',
        required: true, // Requires explicit consent
      },
      {
        purpose: 'device_fingerprinting',
        description: 'Device fingerprinting for age verification fallback',
        required: true, // ePrivacy 5(3) consent required
      },
      {
        purpose: 'marketing_communications',
        description: 'Sending marketing and promotional communications',
        required: true, // Requires consent
      },
    ];
  }

  /**
   * Bulk consent update (e.g., after privacy policy update)
   */
  async requestConsentRenewal(
    userId: string,
    newPrivacyNoticeVersion: string
  ): Promise<void> {
    // Mark all existing consents as requiring renewal
    const { error } = await supabase
      .from('consent_records')
      .update({
        metadata: {
          renewal_required: true,
          new_version: newPrivacyNoticeVersion,
        },
      })
      .eq('user_id', userId)
      .eq('consent_given', true)
      .is('withdrawn_date', null);

    if (error) {
      throw new Error(`Failed to request consent renewal: ${error.message}`);
    }
  }

  /**
   * Get users requiring consent renewal
   */
  async getUsersRequiringConsentRenewal(
    limit: number = 100
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('consent_records')
      .select('user_id')
      .eq('consent_given', true)
      .is('withdrawn_date', null)
      .contains('metadata', { renewal_required: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching users requiring consent renewal:', error);
      return [];
    }

    // Return unique user IDs
    return [...new Set((data || []).map((record) => record.user_id))];
  }
}

// Export singleton instance
export const privacyConsentService = new PrivacyConsentService();
