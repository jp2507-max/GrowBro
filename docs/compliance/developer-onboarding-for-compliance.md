# Developer onboarding for Android compliance

Read first

- docs/compliance/compliance-playbook.md
- docs/compliance/play-submission-checklist.md

Daily

- Keep compliance/\*.json updated when adding SDKs, data types, or deletion flows
- Run pnpm check-all locally before PRs touching compliance-sensitive areas

PR requirements

- New restricted permissions require a justification doc under compliance/
- No secrets or reviewer credentials in repo; use Play Console App access
