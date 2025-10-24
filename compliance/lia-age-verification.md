# Legitimate Interests Assessment: Age Verification and Minor Protection

**LIA ID:** LIA-AGE-001
**Processing Operation:** Age Verification and Minor Protection
**Date Created:** 2025-10-21
**Last Updated:** 2025-10-21
**Status:** Approved
**Approved By:** [Data Protection Officer]
**Approval Date:** [Pending Final Review]

## Purpose and Legitimate Interest

### Purpose

Protect minors from age-inappropriate content and implement safety-by-design principles through privacy-preserving age verification mechanisms.

### Legitimate Interest

Minor protection and content safety require age verification to prevent minors from accessing harmful content while maintaining user privacy through minimal data processing.

## Necessity Test

### Question

Is age verification necessary for minor protection?

### Answer

Yes. Privacy-preserving age verification (boolean attribute only) is necessary to comply with DSA Art. 28 and prevent minor exposure to harmful content. The processing must balance safety requirements with privacy protection.

### Alternatives Considered

1. **No age verification** - Unacceptable, violates DSA Art. 28 and exposes minors to harmful content
2. **Full ID verification with persistent storage** - Excessive, violates data minimization principles
3. **Privacy-preserving age attribute (boolean only)** - Selected, aligns with EU Age-Verification Blueprint

## Balancing Test

### Controller Interests

- Comply with DSA Art. 28 (Protection of Minors)
- Protect minors from age-inappropriate and harmful content
- Implement safety-by-design principles
- Maintain platform safety and legal compliance

### Data Subject Interests and Rights

- Privacy protection through minimal data processing
- No persistent storage of identification documents
- Right to dispute verification results
- Right to request re-verification
- Right to delete age attribute upon account deletion

### Safeguards Implemented

1. **Store only over-18 boolean** - Not raw birthdate or ID documents
2. **One-time verification with reusable token** - No repeated ID checks required
3. **No device fingerprinting without explicit consent** - ePrivacy Directive compliance
4. **Safer defaults for unverified users** - Restrict age-restricted content, no profiling ads to minors
5. **Clear consent mechanisms** - Transparent age verification process

### Conclusion

Minor protection interests justify minimal data processing. The privacy-preserving design per EU Age-Verification Blueprint ensures no persistent ID storage while meeting legal safety requirements.

## Data Processing Details

### Data Categories Processed

- Age attribute (over-18 boolean only)
- One-time verification token (reusable)
- Verification metadata (fraud prevention)

### Processing Principles

- **Lawfulness, Fairness, Transparency** - Clear explanation of age verification purposes
- **Purpose Limitation** - Processing limited to minor protection and DSA compliance
- **Data Minimization** - Boolean attribute only, no full date of birth storage
- **Accuracy** - Verification mechanisms validated for reliability
- **Storage Limitation** - Minimal retention, deleted upon account closure
- **Integrity and Confidentiality** - Secure token generation and storage
- **Accountability** - Audit trails for verification processes

## Risk Assessment

### Privacy Risks

- **Identification document exposure** - Mitigated through one-time verification, no storage
- **Device fingerprinting** - Mitigated through explicit consent requirements
- **Profiling of minors** - Mitigated through boolean-only attribute and safer defaults

### Mitigation Measures

- Privacy-preserving verification methods (no document storage)
- Clear user consent and control mechanisms
- Automated deletion of verification metadata
- Regular security assessments of verification systems

## Age Verification Implementation

### Verification Methods

- **Self-attestation** - User declares age (lowest privacy impact)
- **Document verification** - One-time check without storage (higher privacy cost)
- **Third-party verification** - Privacy-preserving services (balanced approach)

### Technical Safeguards

- Cryptographic verification tokens
- No persistent personal data storage
- Secure deletion after verification
- Audit trails for compliance monitoring

## Review and Monitoring

### Review Schedule

Annual review with updates following changes to age verification regulations or technologies.

### Monitoring

- Verification success rate monitoring
- User complaint tracking
- Privacy impact assessment updates
- Compliance with evolving age verification standards

## References

- GDPR Article 6(1)(f) - Legitimate Interests
- Digital Services Act (Regulation (EU) 2022/2065) Article 28
- EU Age-Verification Blueprint (2025)
- ePrivacy Directive Article 5(3)
- ROPA Reference: ROPA-AGE-001
- Related Documents:
  - Privacy Policy - Age Verification Section
  - Data Inventory - Age Verification Data Categories
