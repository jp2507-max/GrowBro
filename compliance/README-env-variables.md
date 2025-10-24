# Compliance Configuration Environment Variables

## Overview

Compliance documents in this directory use environment variable placeholders that must be populated before enabling production features. These variables are defined in the root `env.js` file and should be provided via `.env.{environment}` files.

## Required Environment Variables

### Legal Entity Information

- **`LEGAL_ENTITY_ADDRESS`**: Complete legal address of the data controller (GrowBro entity)
  - Example: `"GrowBro GmbH, Musterstrasse 123, 10115 Berlin, Germany"`
  - Used in: `ropa-entries.json` (controller.address)

### Data Protection Officer (DPO) Contact

- **`DPO_EMAIL`**: Email address of the Data Protection Officer
  - Example: `"jan-blohm@gmx.de"` (current placeholder)
  - Must be a valid email address
  - Used in: `ropa-entries.json` (controller.dpoContact and all entry dpoContact fields)

- **`DPO_NAME`**: Full name of the Data Protection Officer
  - Example: `"Jan Blohm"`
  - Used in: `ropa-entries.json` (metadata.responsiblePerson)

### EU Representative (if applicable)

- **`EU_REPRESENTATIVE_ADDRESS`**: Address of EU representative if controller is outside the EU
  - Leave empty if not applicable
  - Example: `"EU Representative Name, Address, City, Country"`
  - Used in: `ropa-entries.json` (controller.representativeEU)

## Configuration Files Affected

### 1. `compliance/ropa-entries.json`

This file contains Records of Processing Activities (RoPA) required for GDPR compliance. The following placeholders are used:

- **Line 9**: `"address": "${LEGAL_ENTITY_ADDRESS}"`
- **Line 10**: `"dpoContact": "${DPO_EMAIL}"`
- **Line 11**: `"representativeEU": "${EU_REPRESENTATIVE_ADDRESS}"`
- **Entry-level dpoContact fields** (lines ~20, ~109, ~184, ~259, ~339): All use `"${DPO_EMAIL}"`
- **Metadata responsiblePerson** (line ~409): `"${DPO_NAME}"`

### 2. `compliance/retention-schedule.json`

This file contains data retention schedules required for GDPR compliance. The following placeholders are used:

- **Line 315**: `"responsiblePerson": "${DPO_NAME}"`

## Environment File Setup

Add these variables to your environment files:

### `.env.development` (Development)

```env
# Legal/Compliance Contact Information (Development)
LEGAL_ENTITY_ADDRESS="[Development Address - To be filled]"
DPO_EMAIL="jan-blohm@gmx.de"
DPO_NAME="Jan Blohm"
EU_REPRESENTATIVE_ADDRESS=""
```

### `.env.staging` (Staging)

```env
# Legal/Compliance Contact Information (Staging)
LEGAL_ENTITY_ADDRESS="[Staging Address - To be filled]"
DPO_EMAIL="jan-blohm@gmx.de"
DPO_NAME="Jan Blohm"
EU_REPRESENTATIVE_ADDRESS=""
```

### `.env.production` (Production)

```env
# Legal/Compliance Contact Information (Production)
# ⚠️ REQUIRED: Must be populated before production deployment
LEGAL_ENTITY_ADDRESS="[PRODUCTION ADDRESS REQUIRED]"
DPO_EMAIL="[PRODUCTION DPO EMAIL REQUIRED]"
DPO_NAME="[PRODUCTION DPO NAME REQUIRED]"
EU_REPRESENTATIVE_ADDRESS=""
```

## Using Environment Variables in Compliance Documents

The compliance JSON files use template string syntax `${VAR_NAME}` for environment variable substitution. Before these documents are used in production:

1. **Populate all required environment variables** in the appropriate `.env.{environment}` file
2. **Create a processing script** (if needed) to substitute placeholders with actual values
3. **Verify all placeholders are replaced** before deploying or submitting to authorities

## CI/CD Integration

For production deployments, consider:

1. **Secrets Management**: Store sensitive values (DPO email, addresses) in CI/CD secrets
2. **Build-time Substitution**: Replace placeholders during build process
3. **Validation**: Add pre-deployment checks to ensure no placeholders remain
4. **Environment-specific Values**: Use different values per deployment environment

## Example Processing Script

```javascript
// scripts/process-compliance-docs.js
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({
  path: path.resolve(__dirname, '../.env.production'),
});

const processDocument = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace environment variable placeholders
  content = content
    .replace(
      /\$\{LEGAL_ENTITY_ADDRESS\}/g,
      process.env.LEGAL_ENTITY_ADDRESS || '[MISSING]'
    )
    .replace(/\$\{DPO_EMAIL\}/g, process.env.DPO_EMAIL || '[MISSING]')
    .replace(/\$\{DPO_NAME\}/g, process.env.DPO_NAME || '[MISSING]')
    .replace(
      /\$\{EU_REPRESENTATIVE_ADDRESS\}/g,
      process.env.EU_REPRESENTATIVE_ADDRESS || ''
    );

  // Validate no missing values
  if (content.includes('[MISSING]')) {
    throw new Error(`Missing required environment variables in ${filePath}`);
  }

  return content;
};

// Process all compliance documents
const ropaContent = processDocument(
  path.join(__dirname, '../compliance/ropa-entries.json')
);
const retentionContent = processDocument(
  path.join(__dirname, '../compliance/retention-schedule.json')
);
console.log('✅ RoPA document processed successfully');
console.log('✅ Retention schedule document processed successfully');
```

## Pre-Production Checklist

Before enabling moderation features or deploying to production:

- [ ] All environment variables populated in `.env.production`
- [ ] DPO email verified and tested
- [ ] Legal entity address confirmed with legal team
- [ ] EU representative appointed (if applicable)
- [ ] All compliance documents reviewed by DPO
- [ ] No placeholder values (`[To be filled]`, `${VAR_NAME}`) remain in processed documents
- [ ] Legal review completed for all jurisdictional requirements
- [ ] Audit trail for all changes to compliance documents

## Notes

- **Development/Staging**: Can use placeholder or test values
- **Production**: All values MUST be real and legally accurate
- **Updates**: Any changes to DPO or legal entity information must be updated in environment files and redeployed
- **Audit**: Keep records of when these values were set and by whom

## Related Documentation

- [RoPA Entries](./ropa-entries.json) - Records of Processing Activities
- [Legal Review Checklist](./legal-review-checklist.md)
- [Privacy Policy](./privacy-policy.json)
