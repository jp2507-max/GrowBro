/**
 * Data Minimization Service
 * Implements GDPR data minimization principles (Art. 5(1)(c))
 */

import type {
  DataCategory,
  DataMinimizationRule,
  LegalBasis,
} from '@/types/privacy';

/**
 * Data minimization rules for moderation system
 */
const MINIMIZATION_RULES: DataMinimizationRule[] = [
  {
    dataCategory: 'identity',
    purpose: 'User authentication and account management',
    legalBasis: 'contract',
    minimumFields: ['user_id', 'created_at'],
    optionalFields: ['display_name'],
    prohibitedFields: ['ssn', 'passport_number', 'drivers_license'],
  },
  {
    dataCategory: 'contact',
    purpose: 'Communication and notifications',
    legalBasis: 'contract',
    minimumFields: ['email'],
    optionalFields: ['phone'],
    prohibitedFields: ['home_address', 'physical_location'],
  },
  {
    dataCategory: 'content',
    purpose: 'Content moderation and safety',
    legalBasis: 'legal_obligation',
    minimumFields: ['content_id', 'content_type', 'created_at'],
    optionalFields: ['content_text', 'content_hash'],
    prohibitedFields: ['raw_biometric_data', 'health_data'],
  },
  {
    dataCategory: 'behavioral',
    purpose: 'Abuse prevention and pattern detection',
    legalBasis: 'legitimate_interests',
    minimumFields: ['user_id', 'action_type', 'timestamp'],
    optionalFields: ['session_id'],
    prohibitedFields: ['browsing_history', 'cross_site_tracking'],
    anonymizationThreshold: 90, // Anonymize after 90 days
  },
  {
    dataCategory: 'technical',
    purpose: 'Security and fraud prevention',
    legalBasis: 'legitimate_interests',
    minimumFields: ['timestamp'],
    optionalFields: ['ip_address', 'user_agent'],
    prohibitedFields: ['device_fingerprint', 'precise_geolocation'],
    anonymizationThreshold: 30, // Anonymize after 30 days
  },
  {
    dataCategory: 'moderation',
    purpose: 'DSA compliance and transparency reporting',
    legalBasis: 'legal_obligation',
    minimumFields: [
      'report_id',
      'decision_id',
      'action_type',
      'timestamp',
      'legal_basis',
    ],
    optionalFields: ['moderator_id', 'reasoning'],
    prohibitedFields: [
      'user_ssn',
      'passport_number',
      'drivers_license',
      'credit_card',
    ],
  },
  {
    dataCategory: 'audit',
    purpose: 'Compliance auditing and forensic investigation',
    legalBasis: 'legal_obligation',
    minimumFields: ['event_id', 'event_type', 'timestamp', 'actor_id'],
    optionalFields: ['metadata'],
    prohibitedFields: [],
  },
];

export class DataMinimizationService {
  /**
   * Get minimization rule for a data category
   */
  getRule(dataCategory: DataCategory): DataMinimizationRule | undefined {
    return MINIMIZATION_RULES.find(
      (rule) => rule.dataCategory === dataCategory
    );
  }

  /**
   * Validate that data collection complies with minimization rules
   */
  validateDataCollection(
    dataCategory: DataCategory,
    fields: string[]
  ): {
    isValid: boolean;
    violations: string[];
    warnings: string[];
  } {
    const rule = this.getRule(dataCategory);
    if (!rule) {
      return {
        isValid: false,
        violations: [
          `No minimization rule found for category: ${dataCategory}`,
        ],
        warnings: [],
      };
    }

    const violations: string[] = [];
    const warnings: string[] = [];

    // Check for prohibited fields
    const prohibitedFound = fields.filter((field) =>
      rule.prohibitedFields.includes(field)
    );
    if (prohibitedFound.length > 0) {
      violations.push(
        `Prohibited fields detected: ${prohibitedFound.join(', ')}`
      );
    }

    // Check for missing minimum fields
    const missingRequired = rule.minimumFields.filter(
      (field) => !fields.includes(field)
    );
    if (missingRequired.length > 0) {
      violations.push(`Missing required fields: ${missingRequired.join(', ')}`);
    }

    // Warn about excessive optional fields
    const unnecessaryFields = fields.filter(
      (field) =>
        !rule.minimumFields.includes(field) &&
        !rule.optionalFields.includes(field) &&
        !rule.prohibitedFields.includes(field)
    );
    if (unnecessaryFields.length > 0) {
      warnings.push(
        `Unnecessary fields (not in minimization rule): ${unnecessaryFields.join(', ')}`
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Filter data object to only include allowed fields
   */
  filterData(
    dataCategory: DataCategory,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const rule = this.getRule(dataCategory);
    if (!rule) {
      throw new Error(
        `No minimization rule found for category: ${dataCategory}`
      );
    }

    const allowedFields = [...rule.minimumFields, ...rule.optionalFields];
    const filtered: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in data) {
        filtered[field] = data[field];
      }
    }

    return filtered;
  }

  /**
   * Check if data should be anonymized based on age
   */
  shouldAnonymize(dataCategory: DataCategory, ageInDays: number): boolean {
    const rule = this.getRule(dataCategory);
    if (!rule || !rule.anonymizationThreshold) {
      return false;
    }

    return ageInDays >= rule.anonymizationThreshold;
  }

  /**
   * Anonymize sensitive fields in data
   */
  anonymizeData(
    dataCategory: DataCategory,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const anonymized = { ...data };

    // Anonymize based on data category
    switch (dataCategory) {
      case 'identity':
        if ('user_id' in anonymized) {
          anonymized.user_id = this.hashIdentifier(String(anonymized.user_id));
        }
        if ('display_name' in anonymized) {
          delete anonymized.display_name;
        }
        break;

      case 'contact':
        if ('email' in anonymized) {
          anonymized.email = this.maskEmail(String(anonymized.email));
        }
        if ('phone' in anonymized) {
          anonymized.phone = this.maskPhone(String(anonymized.phone));
        }
        break;

      case 'technical':
        if ('ip_address' in anonymized) {
          anonymized.ip_address = this.maskIpAddress(
            String(anonymized.ip_address)
          );
        }
        if ('user_agent' in anonymized) {
          delete anonymized.user_agent;
        }
        break;

      case 'behavioral':
        if ('user_id' in anonymized) {
          anonymized.user_id = this.hashIdentifier(String(anonymized.user_id));
        }
        if ('session_id' in anonymized) {
          delete anonymized.session_id;
        }
        break;

      default:
        // No anonymization for other categories
        break;
    }

    return anonymized;
  }

  /**
   * Hash identifier for pseudonymization
   */
  private hashIdentifier(identifier: string): string {
    // Simple hash for demonstration - use crypto.createHash in production
    return `anon_${identifier.substring(0, 8)}`;
  }

  /**
   * Mask email address
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    const maskedLocal = local.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask phone number
   */
  private maskPhone(phone: string): string {
    if (phone.length < 4) return '***';
    return '***' + phone.substring(phone.length - 4);
  }

  /**
   * Mask IP address (keep first two octets for IPv4)
   */
  private maskIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***.***`;
    }
    // IPv6 or invalid - mask completely
    return '***';
  }

  /**
   * Document legal basis for data processing
   */
  documentLegalBasis(
    dataCategory: DataCategory,
    purpose: string
  ): {
    legalBasis: LegalBasis;
    documentation: string;
  } {
    const rule = this.getRule(dataCategory);
    if (!rule) {
      throw new Error(
        `No minimization rule found for category: ${dataCategory}`
      );
    }

    return {
      legalBasis: rule.legalBasis,
      documentation: `Processing ${dataCategory} data for: ${purpose}. Legal basis: ${rule.legalBasis} (GDPR Art. 6(1))`,
    };
  }

  /**
   * Get all minimization rules
   */
  getAllRules(): DataMinimizationRule[] {
    return [...MINIMIZATION_RULES];
  }
}

// Export singleton instance
export const dataMinimizationService = new DataMinimizationService();
