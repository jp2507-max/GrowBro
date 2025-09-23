# Compliance troubleshooting

Common failures

- privacy-policy:validate → ensure compliance/privacy-policy.json contains HTTPS URLs
- ci-android-manifest-scan → remove restricted permissions or add required justification docs
- ci-data-safety-validate → regenerate data-safety-draft.json and fix sdk index mismatches
- prelaunch:validate → address warnings/security before release

How to regenerate Data Safety draft

- pnpm run data-safety:generate

Where are reports stored?

- build/reports/compliance/_.json and _.md
