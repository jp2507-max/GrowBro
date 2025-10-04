# Playbook Schema Validation

This directory contains Zod schemas for validating playbook data structures used in the Guided Grow Playbooks feature.

## Overview

The schema validation system ensures that playbook templates conform to the expected structure before being stored in the database or synced to the backend. This prevents invalid data from entering the system and provides clear error messages when validation fails.

## Schema Structure

### Playbook Schema

The main playbook schema validates:

- **id**: UUID format
- **name**: 1-200 characters
- **setup**: One of `auto_indoor`, `auto_outdoor`, `photo_indoor`, `photo_outdoor`
- **locale**: Format `xx` or `xx-XX` (e.g., `en`, `de`, `en-US`)
- **phaseOrder**: Array of grow phases (optional)
- **steps**: Array of playbook steps (minimum 1)
- **metadata**: Optional metadata object
- **isTemplate**: Boolean flag for templates
- **isCommunity**: Boolean flag for community-shared playbooks
- **authorHandle**: Optional author identifier
- **license**: Optional license string (e.g., `CC-BY-SA`)

### Playbook Step Schema

Each step in a playbook validates:

- **id**: Unique identifier
- **phase**: One of `seedling`, `veg`, `flower`, `harvest`
- **title**: 1-200 characters
- **descriptionIcu**: Optional ICU MessageFormat string for i18n
- **relativeDay**: Non-negative integer (day offset from phase start)
- **rrule**: Optional RFC 5545 RRULE pattern (must start with `FREQ=`)
- **defaultReminderLocal**: Optional time in `HH:mm` format
- **taskType**: One of `water`, `feed`, `prune`, `train`, `monitor`, `note`, `custom`
- **durationDays**: Optional positive integer for multi-day tasks
- **dependencies**: Array of step IDs that must complete first

### Playbook Metadata Schema

Optional metadata includes:

- **author**: Author name (max 100 characters)
- **version**: Semantic version (e.g., `1.0.0`)
- **tags**: Array of tags (max 50 characters each)
- **difficulty**: One of `beginner`, `intermediate`, `advanced`
- **estimatedDuration**: Estimated duration in weeks
- **strainTypes**: Array of compatible strain types

## Usage

### Validating a Playbook

```typescript
import { validatePlaybookSchema } from '@/lib/schemas/validator';

const result = validatePlaybookSchema(playbookData);

if (result.valid) {
  // Playbook is valid
  console.log('Playbook is valid!');
} else {
  // Playbook has errors
  console.error('Validation errors:', result.errors);
}
```

### Formatting Error Messages

```typescript
import { formatValidationErrors } from '@/lib/schemas/validator';

const result = validatePlaybookSchema(playbookData);
const errorMessages = formatValidationErrors(result);

errorMessages.forEach((message) => {
  console.error(message);
});
```

### Validating Individual Formats

```typescript
import {
  validateRRULEFormat,
  validateTimeFormat,
  validateISODatetime,
} from '@/lib/schemas/validator';

// Validate RRULE
const isValidRRule = validateRRULEFormat('FREQ=DAILY;INTERVAL=2');

// Validate time format
const isValidTime = validateTimeFormat('08:00');

// Validate ISO datetime
const isValidDatetime = validateISODatetime('2025-01-01T00:00:00.000Z');
```

## CI Validation

The schema validation is integrated into the CI pipeline via the `schemas:validate` npm script:

```bash
pnpm schemas:validate
```

This script validates all fixture files in `__fixtures__/` directory:

- Files containing `valid` in the name should pass validation
- Files containing `invalid` in the name should fail validation

The CI script exits with code 0 if all validations pass, or code 1 if any fail.

## Test Fixtures

Test fixtures are located in `__fixtures__/`:

- **valid-playbook.json**: Example of a valid playbook
- **invalid-playbook.json**: Example of an invalid playbook (for testing error handling)

## Adding New Fixtures

To add a new test fixture:

1. Create a JSON file in `__fixtures__/`
2. Name it with `valid-` prefix if it should pass validation
3. Name it with `invalid-` prefix if it should fail validation
4. Run `pnpm schemas:validate` to verify

## Integration with WatermelonDB

The validated playbook data is stored in WatermelonDB using the `PlaybookModel`:

```typescript
import { database } from '@/lib/watermelon';
import { PlaybookModel } from '@/lib/watermelon-models/playbook';

// Validate before storing
const result = validatePlaybookSchema(playbookData);
if (!result.valid) {
  throw new Error('Invalid playbook data');
}

// Store in database
await database.write(async () => {
  await database.get<PlaybookModel>('playbooks').create((playbook) => {
    playbook.name = playbookData.name;
    playbook.setup = playbookData.setup;
    // ... set other fields
  });
});
```

## Format Specifications

### Time Format (HH:mm)

- Hours: 00-23
- Minutes: 00-59
- Examples: `08:00`, `12:30`, `23:59`

### RRULE Format (RFC 5545)

Must start with `FREQ=` followed by one of:

- `DAILY`
- `WEEKLY`
- `MONTHLY`
- `YEARLY`

Examples:

- `FREQ=DAILY;INTERVAL=2`
- `FREQ=WEEKLY;BYDAY=MO,WE,FR`
- `FREQ=MONTHLY;BYMONTHDAY=1`

### ISO Datetime Format

Full ISO 8601 format with timezone:

- Format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Example: `2025-01-01T00:00:00.000Z`

## Error Handling

Validation errors include:

- **path**: The JSON path to the invalid field (e.g., `steps.0.relativeDay`)
- **message**: Human-readable error message

Example error:

```typescript
{
  path: 'steps.0.relativeDay',
  message: 'Expected number, received string'
}
```

## Best Practices

1. **Always validate before storing**: Validate playbook data before writing to the database
2. **Validate on import**: Validate community templates before importing
3. **Provide clear feedback**: Use `formatValidationErrors()` to show user-friendly messages
4. **Test edge cases**: Add fixtures for edge cases and boundary conditions
5. **Keep schemas in sync**: Update schemas when adding new fields to playbook types
