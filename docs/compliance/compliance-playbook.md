# Compliance Playbook

Purpose: How GrowBro maintains Android Play Store compliance across releases.

Responsibilities

- Compliance Owner: tracks deadlines, owns checklists, reviews CI reports
- Android Lead: maintains build/manifest rules and targetSdk validation
- Privacy Officer: maintains data inventory, privacy policy sync, data safety answers
- Release Manager: blocks releases if any compliance gate fails

Workflows

- Pre-release: run pnpm check-all, pnpm compliance:audit, ensure all gates pass
- Policy update intake: monitor policy feeds, file an issue with impact assessment, update docs/scripts
- CI enforcement: compliance:docs:validate ensures required artifacts; cannabis scanner blocks commerce language

Artifacts

- Machine-readable: compliance/_.json, build/reports/compliance/_.json
- Human-readable: docs/compliance/_, build/reports/compliance/_.md

Escalation

- If a new restricted permission is introduced, require justification document under compliance/ with owner approval before merge

References

- .kiro/specs/7. android-store-compliance/design.md
- .kiro/specs/7. android-store-compliance/requirements.md (Section 15)
