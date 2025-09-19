## EU AI Act compliance (non‑blocking monitor)

This document tracks GrowBro features that involve AI and their tentative classification and transparency duties under the EU AI Act. This is not legal advice. The build monitor surfaces warnings as deadlines approach but does not block CI by default.

### Scope

- AI diagnosis: on‑device first, optional network inference for plant health analysis
- AI training images: optional user contribution to training pool (separate from diagnosis)

### Tentative risk classification

- AI diagnosis (`ai-diagnosis`): limited risk (informational transparency duties). Review with counsel.
- AI training images (`ai-training`): limited risk; strong consent, redaction, and deletion receipts already implemented.

### Transparency duties (draft)

- Clearly disclose when AI is used and its purpose in EN/DE
- Identify controller and contact
- Provide opt‑out of training; diagnosis continues to work
- Data minimization and retention as per GDPR design

### Milestones (target)

- Transparency UI copy, links, and settings finalized by 2025-12-31
- Risk management documentation refresh by 2026-06-30

### Feature notes

#### AI diagnosis {#ai-diagnosis}

- Disclosure: in scan flow and settings
- Offline‑first; transient uploads with ≤24h purge when network inference is used
- No free‑text or PII in telemetry; images handled per design retention rules

#### AI training images {#ai-training}

- Explicit consent required; one‑tap purge with receipt (implemented)
- Training bucket tagged with `consent_version`; deletion cascades validated

### Review cadence

- Update this file when scope changes; run `pnpm ai:monitor` locally/CI
