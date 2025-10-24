# Legal Review Checklist - Community Moderation System

## Overview

This checklist defines pre-deployment legal review requirements, compliance validation gates, sign-off procedures, and audit schedules for the community moderation system.

**Last Updated:** 2025-10-19  
**Review Schedule:** Quarterly reviews; immediate updates upon regulation changes  
**Responsible Person:** [Compliance Officer / Legal Counsel]

---

## Pre-Deployment Legal Review Requirements

### 1. Data Protection Impact Assessment (DPIA) Review

- [ ] **DPIA Completed**: `compliance/dpia-moderation-system.json` reviewed and approved
- [ ] **DPO Approval**: Data Protection Officer sign-off obtained
- [ ] **Risk Assessment**: All identified risks have documented mitigation measures
- [ ] **Consultation**: Data subjects consulted where appropriate (or documented exemption)
- [ ] **Processing Operations**: All three operations (moderation, age verification, geo-location) assessed
- [ ] **Annual Review**: DPIA review schedule established (annual minimum)

**Sign-off Required:** Data Protection Officer  
**Completion Deadline:** Before any production deployment  
**Evidence Location:** `compliance/dpia-moderation-system.json` (approvals section)

---

### 2. Records of Processing Activities (RoPA) Validation

- [ ] **All Entries Complete**: Five RoPA entries documented (`ROPA-MOD-001`, `ROPA-AGE-001`, `ROPA-GEO-001`, `ROPA-AUDIT-001`, `ROPA-TRANS-001`)
- [ ] **Controller Details**: Controller name, address, DPO contact filled
- [ ] **Processor Details**: Third-party processors documented (age verification provider if applicable)
- [ ] **Legal Bases**: All lawful bases documented per GDPR Art. 6(1)
- [ ] **Retention Periods**: Retention schedules defined and documented
- [ ] **Technical Measures**: Security measures documented per GDPR Art. 32
- [ ] **Data Subject Rights**: Rights procedures documented (access, erasure, rectification, portability)

**Sign-off Required:** Data Protection Officer  
**Completion Deadline:** Before production deployment  
**Evidence Location:** `compliance/ropa-entries.json`

---

### 3. Lawful Bases and Legitimate Interests Assessments (LIA)

- [ ] **Lawful Bases Matrix**: `compliance/lawful-bases-matrix.json` reviewed
- [ ] **LIA Documentation**: All four LIAs completed (`LIA-MOD-001`, `LIA-AGE-001`, `LIA-GEO-001`, `LIA-AUDIT-001`)
- [ ] **Necessity Test**: Necessity justified for each processing operation
- [ ] **Balancing Test**: Balancing test conducted for all legitimate interests processing
- [ ] **Consent Mechanisms**: GPS consent mechanism validated (GDPR Art. 6(1)(a) compliance)
- [ ] **Legal Obligation References**: DSA article references validated (Art. 16, 17, 20, 21, 22, 23, 24, 28)

**Sign-off Required:** Data Protection Officer + Legal Counsel  
**Completion Deadline:** Before production deployment  
**Evidence Location:** `compliance/lawful-bases-matrix.json`

---

### 4. Retention Schedule and Deletion Workflows

- [ ] **Retention Policies**: All 10 data categories have defined retention periods
- [ ] **Automated Deletion**: Daily and monthly deletion workflows implemented and tested
- [ ] **Legal Hold Procedures**: Legal hold approval process documented and tested
- [ ] **User Rights**: Erasure request handling tested (30-day timeline verified)
- [ ] **Anonymization**: PII anonymization at 30-day mark tested (golden tests passing)
- [ ] **Audit Logging**: All deletions logged in audit trail
- [ ] **Quarterly Audits**: Retention audit schedule established

**Sign-off Required:** Data Protection Officer + Engineering Lead  
**Completion Deadline:** Before production deployment  
**Evidence Location:** `compliance/retention-schedule.json` + automated deletion test results

---

### 5. DSA Compliance Mapping Validation

- [ ] **All DSA Articles**: Nine DSA articles mapped to implementation (`Art. 16, 17, 20, 21, 22, 23, 24(5), 28, 15 & 24`)
- [ ] **Acceptance Criteria**: Acceptance criteria defined for each article
- [ ] **System Components**: All system components identified and mapped
- [ ] **Implementation Details**: Implementation approach documented per article
- [ ] **Feature Flags**: Feature flag enablement criteria defined
- [ ] **Deployment Strategy**: Four-phase deployment strategy documented (ship dark → internal testing → gradual rollout → full activation)

**Sign-off Required:** Legal Counsel + Compliance Officer  
**Completion Deadline:** Before production deployment  
**Evidence Location:** `compliance/dsa-compliance-mapping.json`

---

### 6. Privacy Notices Review

- [ ] **All Notices Complete**: Four privacy notices documented (`PRIVACY-MOD-001`, `PRIVACY-AGE-001`, `PRIVACY-GEO-001`, `PRIVACY-MOD-STAFF-001`)
- [ ] **GDPR Art. 13/14 Compliance**: All mandatory information elements present (controller details, purposes, legal bases, recipients, retention, rights)
- [ ] **Clear Language**: Privacy notices use clear, non-technical language
- [ ] **Translations**: Privacy notices translated to German (de) and English (en)
- [ ] **Delivery Context**: Privacy notices integrated into UI flows (report submission, age verification, geo-blocking, moderator console)

**Sign-off Required:** Legal Counsel + Data Protection Officer  
**Completion Deadline:** Before production deployment  
**Evidence Location:** `compliance/privacy-notices.json`

---

## Feature-Specific Compliance Validation

### Feature: SoR Export to DSA Transparency Database (Art. 24(5))

**Feature Flag:** `FEATURE_SOR_EXPORT_ENABLED`

**Pre-Enablement Checklist:**

- [ ] **Commission DB API Credentials**: API credentials configured and tested
- [ ] **PII Scrubbing Golden Tests**: 100% pass rate for deterministic PII scrubbing
- [ ] **Redacted SoR Template**: Legal review approval for redacted SoR template
- [ ] **No Personal Data Verification**: Compliance tests verify no personal data in exports
- [ ] **DLQ Monitoring**: Dead letter queue monitoring and alerting configured
- [ ] **Idempotency**: Idempotent submissions by decision_id tested
- [ ] **Batch API**: Batch API (1-100 SoRs) tested with fallback to single submission
- [ ] **Circuit Breaker**: Circuit breaker pattern implemented and tested
- [ ] **Audit Trail**: SoR submission audit trail operational (timestamp, EC DB ID, payload hash)

**Sign-off Required:** Legal Counsel + Engineering Lead  
**Enablement Timeline:** After all checklist items complete  
**Monitoring SLI:** p95 time-to-submit < 1 hour

---

### Feature: Age Verification and Minor Protection (DSA Art. 28)

**Feature Flag:** `FEATURE_AGE_VERIFICATION_ENABLED`

**Pre-Enablement Checklist:**

- [ ] **DPIA Approval**: Age verification DPIA approved by DPO
- [ ] **Third-Party Provider**: Age verification provider contract signed (or EU Age-Verification Blueprint self-implementation validated)
- [ ] **Privacy-Preserving Implementation**: Over-18 boolean attribute only (no raw ID storage) tested
- [ ] **No Raw ID Storage**: Compliance tests verify no persistent ID document storage
- [ ] **One-Time Verification**: One-time verification with reusable token tested
- [ ] **Token Replay Prevention**: Token replay prevention tested (security tests passing)
- [ ] **Safer Defaults**: Age-restricted content filtering for unverified users tested
- [ ] **No Fingerprinting**: No device fingerprinting without consent (ePrivacy compliance verified)
- [ ] **EUDI Wallet Compatibility**: Design compatible with future EUDI wallet integration

**Sign-off Required:** Data Protection Officer + Legal Counsel  
**Enablement Timeline:** After DPIA approval and provider contract signed  
**Monitoring SLI:** Verification success rate > 95%

---

### Feature: Geo-blocking and Regional Content Restrictions

**Feature Flag:** `FEATURE_GEO_BLOCKING_ENABLED`

**Pre-Enablement Checklist:**

- [ ] **IP Geolocation Accuracy**: >95% correct country detection validated
- [ ] **ePrivacy Compliance**: No GPS without explicit consent verified
- [ ] **GPS Consent Mechanism**: GPS consent dialog tested (freely given, specific, informed, unambiguous, withdrawable)
- [ ] **Appeal Flow**: Geo-blocking appeal process tested and documented
- [ ] **Legal Review**: Geo-blocking rules approved by legal counsel
- [ ] **No Persistent Storage**: IP addresses not persistently stored verified
- [ ] **Cache TTL**: 1-hour cache TTL tested with automatic expiry
- [ ] **Most Restrictive Setting**: IP vs GPS mismatch applies most restrictive setting verified

**Sign-off Required:** Legal Counsel + Engineering Lead  
**Enablement Timeline:** After IP geolocation accuracy validated and appeal flow tested  
**Monitoring SLI:** False positive rate < 5%

---

### Feature: Trusted Flaggers Priority Lane (DSA Art. 22)

**Feature Flag:** `FEATURE_TRUSTED_FLAGGERS_ENABLED`

**Pre-Enablement Checklist:**

- [ ] **Certification Criteria**: Trusted flagger certification criteria documented and approved
- [ ] **Vetting Process**: Trusted flagger vetting process operational
- [ ] **Priority Queue**: Priority queue SLA monitoring configured (<1 hour handling time)
- [ ] **Quality Analytics**: Quality analytics dashboard operational (accuracy, handling time, appeal reversal rate)
- [ ] **Quarterly Review**: Quarterly review workflow implemented and tested
- [ ] **Revocation Procedures**: Revocation procedures documented and tested
- [ ] **Distinct Badges**: Visual badges in moderator console tested

**Sign-off Required:** Compliance Officer + Product Lead  
**Enablement Timeline:** After certification criteria approved and vetting process operational  
**Monitoring SLI:** Trusted flagger handling time < 1 hour (p95)

---

## Sign-off Procedures

### Data Protection Officer (DPO) Sign-off

**Required for:**

- DPIA approval
- RoPA entries validation
- Lawful bases and LIA review
- Privacy notices review
- Retention schedule approval
- Age verification feature enablement

**Sign-off Format:**

```
DPIA Approval: [DPO Name], [Date], [Signature/Email Confirmation]
RoPA Approval: [DPO Name], [Date], [Signature/Email Confirmation]
```

**Evidence Location:** `compliance/approvals/dpo-sign-offs.json`

---

### Legal Counsel Sign-off

**Required for:**

- DSA compliance mapping validation
- Lawful bases and LIA review
- Privacy notices review
- SoR export feature enablement
- Age verification feature enablement
- Geo-blocking feature enablement
- Trusted flagger certification criteria

**Sign-off Format:**

```
DSA Compliance: [Legal Counsel Name], [Date], [Signature/Email Confirmation]
Geo-blocking Rules: [Legal Counsel Name], [Date], [Signature/Email Confirmation]
```

**Evidence Location:** `compliance/approvals/legal-sign-offs.json`

---

### Compliance Officer Sign-off

**Required for:**

- DSA compliance mapping validation
- Trusted flagger certification criteria
- Quarterly compliance audits
- Feature enablement go/no-go decisions

**Sign-off Format:**

```
Quarterly Audit Q4 2025: [Compliance Officer Name], [Date], [Signature/Email Confirmation]
```

**Evidence Location:** `compliance/approvals/compliance-sign-offs.json`

---

## Compliance Audit Schedule

### Quarterly Audits

**Frequency:** Every 3 months  
**Responsible Person:** Compliance Officer + Data Protection Officer

**Audit Scope:**

1. **Retention Compliance**
   - Verify automated deletion workflows operational (100% success rate)
   - Review legal holds for necessity (quarterly review requirement)
   - Validate user erasure request handling (<30 day timeline)
   - Check anonymization correctness (golden tests 100% pass rate)

2. **DSA Compliance**
   - Verify SoR submissions to Commission DB (p95 time-to-submit < 1 hour)
   - Review SLA compliance (illegal content <24h, policy violations <72h)
   - Check trusted flagger quality analytics (quarterly review)
   - Validate appeal handling times (<72 hours)

3. **GDPR Compliance**
   - Review RoPA entries for accuracy and completeness
   - Validate lawful bases documentation
   - Check privacy notice delivery (all UI integration points)
   - Review data subject rights request handling

**Deliverables:**

- Quarterly audit report with findings and remediation plan
- Updated compliance dashboard metrics
- Remediation tickets for any non-compliance issues

**Evidence Location:** `compliance/audits/quarterly/YYYY-QN.json`

---

### Annual Reviews

**Frequency:** Every 12 months  
**Responsible Person:** Data Protection Officer + Legal Counsel + Compliance Officer

**Review Scope:**

1. **DPIA Review**: Re-assess all three processing operations for changes
2. **RoPA Update**: Update all five RoPA entries for processing changes
3. **Retention Schedule**: Review all 10 retention periods for necessity
4. **Lawful Bases**: Re-validate all four LIAs for proportionality
5. **Privacy Notices**: Update privacy notices for regulation changes
6. **DSA Mapping**: Re-validate DSA article implementations
7. **Security Audit**: External security audit of moderation infrastructure
8. **Penetration Testing**: Annual penetration testing of compliance systems

**Deliverables:**

- Annual compliance report
- Updated DPIA, RoPA, retention schedule, lawful bases, privacy notices
- Security audit report
- Penetration testing report
- Remediation roadmap for identified issues

**Evidence Location:** `compliance/audits/annual/YYYY.json`

---

## Incident Response and Breach Notification

### Data Breach Response

**Trigger Events:**

- Unauthorized access to moderation data
- Data breach exposing personal data (reporter identities, moderator IDs, user data)
- Security incident affecting audit trail integrity
- Ransomware or malware affecting compliance systems

**Response Procedure:**

1. **Immediate Actions (0-4 hours)**
   - Contain breach (isolate affected systems)
   - Notify DPO and Legal Counsel
   - Document incident details (scope, affected data, timeline)

2. **Assessment (4-24 hours)**
   - Assess severity and personal data impact
   - Determine if breach notification required (GDPR Art. 33/34)
   - Prepare breach notification documentation

3. **Notification (24-72 hours)**
   - Notify supervisory authority within 72 hours (if required)
   - Notify affected data subjects without undue delay (if high risk)
   - Document notification timeline and content

4. **Remediation (ongoing)**
   - Implement security measures to prevent recurrence
   - Update DPIA and risk assessment
   - Conduct post-incident review
   - Update incident response plan

**Evidence Location:** `compliance/incidents/breach-YYYY-MM-DD.json`

---

## Feature Flag Enablement Gates

### Gate 1: Compliance Validation

**Criteria:**

- All pre-deployment legal review requirements complete
- Feature-specific compliance checklist items complete
- DPO and Legal Counsel sign-offs obtained

**Go/No-Go Decision:** Compliance Officer

---

### Gate 2: Internal Testing

**Criteria:**

- All unit, integration, and E2E tests passing
- Security tests passing (no critical vulnerabilities)
- Compliance tests passing (golden tests, contract tests)
- Monitoring and alerting configured

**Go/No-Go Decision:** Engineering Lead + Compliance Officer

---

### Gate 3: Gradual Rollout (10% users)

**Criteria:**

- Gate 1 and Gate 2 complete
- Production monitoring operational
- Incident response plan validated
- Rollback procedures tested

**Go/No-Go Decision:** Product Lead + Compliance Officer

---

### Gate 4: Full Activation (100% users)

**Criteria:**

- Gate 3 complete with no critical issues
- 10% rollout metrics within SLI targets
- No compliance violations or data breaches
- User feedback reviewed (no systemic issues)

**Go/No-Go Decision:** Product Lead + Compliance Officer + Legal Counsel

---

## Documentation Maintenance

**Update Triggers:**

- Regulation changes (DSA amendments, GDPR guidance updates)
- Processing operation changes (new features, data categories)
- Third-party processor changes (new providers, contract updates)
- Security incident learnings (post-incident review)
- Annual compliance reviews

**Review Schedule:**

- Quarterly compliance audits
- Annual DPIA/RoPA/retention/lawful bases reviews
- Immediate updates upon regulation changes

**Version Control:**

- All compliance documents in JSON format with version field
- Git version control for all compliance files
- Approval signatures tracked in separate approvals directory

---

## Contact Information

**Data Protection Officer:** [To be filled - data-protection@growbro.app]  
**Legal Counsel:** [To be filled - legal@growbro.app]  
**Compliance Officer:** [To be filled - compliance@growbro.app]  
**Engineering Lead:** [To be filled - engineering@growbro.app]  
**Product Lead:** [To be filled - product@growbro.app]

---

## Appendix: Compliance Metrics Dashboard

Track these metrics in real-time for compliance monitoring:

**DSA Compliance Metrics:**

- SoR submission latency (p95 < 1 hour target)
- SLA compliance rate (illegal content <24h, policy violations <72h)
- Appeal handling time (p95 < 72 hours target)
- Trusted flagger handling time (p95 < 1 hour target)
- Appeal reversal rate (quality indicator)

**GDPR Compliance Metrics:**

- Automated deletion success rate (target: >99%)
- User erasure request handling time (target: <30 days)
- Legal hold quarterly review completion rate (target: 100%)
- Anonymization correctness (golden tests: 100% pass rate)
- Privacy notice delivery rate (target: 100%)

**Security Metrics:**

- Unauthorized access attempts (monitor for anomalies)
- Audit trail integrity verification (daily checks)
- Failed login attempts (rate limiting effectiveness)
- MFA adoption rate (target: 100% for moderators/admins)

---

**Checklist Version:** 1.0.0  
**Last Updated:** 2025-10-19  
**Next Review:** 2026-01-19 (Quarterly)
