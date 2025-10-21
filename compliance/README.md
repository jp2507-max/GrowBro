# Compliance assets

This folder contains machine-readable compliance artifacts used to automate Google Play Data Safety documentation and CI gates.

## Data Inventory & Privacy

- `data-inventory.json` - Authoritative data inventory: feature -> data type -> purpose -> retention -> sharedWith
- `sdk-index.json` - Local mirror for third-party SDK disclosures used by the validator (no network calls in CI)
- `privacy-policy.json` - Public URLs for the Privacy Policy and web deletion request page
- `deletion-methods.json` - Describes in-app and web account deletion paths (<=3 taps in-app, public web portal)

## GDPR & DSA Compliance

- `ropa-entries.json` - Records of Processing Activities (RoPA) for GDPR Article 30 compliance
- `dpia-moderation-system.json` - Data Protection Impact Assessment for moderation system
- `dsa-compliance-mapping.json` - Mapping of DSA articles to implementation
- `lawful-bases-matrix.json` - GDPR Article 6 lawful bases for all data processing
- `retention-schedule.json` - Data retention schedules by category

## Legitimate Interests Assessments (LIA)

- `lia-age-verification.md` - Legitimate interests assessment for age verification
- `lia-audit-trails.md` - Legitimate interests assessment for audit trails
- `lia-content-moderation.md` - Legitimate interests assessment for content moderation
- `lia-geo-location.md` - Legitimate interests assessment for geo-location

## Environment Variables & Configuration

**⚠️ IMPORTANT**: Before enabling moderation features in production, all environment variables in compliance documents must be populated with real values.

- **[README-env-variables.md](./README-env-variables.md)** - Comprehensive guide for configuring compliance environment variables
- Required variables: `LEGAL_ENTITY_ADDRESS`, `DPO_EMAIL`, `DPO_NAME`, `EU_REPRESENTATIVE_ADDRESS`
- See `.env.production.template` in the root directory for a complete template
- Run `pnpm run compliance:env:validate:production` to validate before deployment

## Validation & Maintenance

Update these files whenever data practices change. CI will fail if they are missing or out of sync.

Run validation scripts:

```bash
# Validate all compliance documentation
pnpm run check-all

# Validate environment variables for production
pnpm run compliance:env:validate:production

# Validate environment variables for staging
pnpm run compliance:env:validate:staging
```

## Legal Review Checklist

See `legal-review-checklist.md` for pre-production legal compliance verification steps.
