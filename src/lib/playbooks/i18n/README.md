# Playbook Internationalization

This module contains internationalization utilities and tests for the Guided Grow Playbooks feature.

## Translation Structure

All playbook translations are located in:

- `src/translations/en.json` - English translations
- `src/translations/de.json` - German translations

### Key Sections

```json
{
  "playbooks": {
    "selection": { ... },      // Playbook selection UI
    "apply": { ... },          // Applying playbooks to plants
    "schedule": { ... },       // Schedule shifting
    "progress": { ... },       // Phase progress tracking
    "trichome": { ... },       // Trichome helper
    "community": { ... },      // Community templates
    "accessibility": { ... }   // Accessibility labels
  },
  "phases": {
    "seedling": "...",
    "veg": "...",
    "flower": "...",
    "harvest": "..."
  }
}
```

## ICU MessageFormat

All translations use ICU MessageFormat for proper pluralization and interpolation.

### Pluralization

```json
{
  "totalWeeks_one": "{{count}} week total",
  "totalWeeks_other": "{{count}} weeks total"
}
```

Usage:

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

// Automatically selects correct plural form
t('playbooks.selection.preview.totalWeeks', { count: 1 }); // "1 week total"
t('playbooks.selection.preview.totalWeeks', { count: 5 }); // "5 weeks total"
```

### Interpolation

```json
{
  "confidence": "{{percent}}% confidence",
  "transitionNotice": "Your plant is transitioning to {{phase}} phase"
}
```

Usage:

```typescript
t('playbooks.adjustments.confidence', { percent: 85 }); // "85% confidence"
t('playbooks.progress.transitionNotice', { phase: 'flowering' }); // "Your plant is transitioning to flowering phase"
```

### Complex Interpolation

```json
{
  "completedTasks_one": "{{count}} of {{total}} task completed",
  "completedTasks_other": "{{count}} of {{total}} tasks completed"
}
```

Usage:

```typescript
t('playbooks.progress.completedTasks', { count: 5, total: 10 }); // "5 of 10 tasks completed"
```

## Translation Guidelines

### 1. Always Use ICU MessageFormat

```json
// ✅ Good
{
  "taskCount_one": "{{count}} task",
  "taskCount_other": "{{count}} tasks"
}

// ❌ Bad
{
  "taskCount": "{{count}} task(s)"
}
```

### 2. Maintain Key Parity

All translation keys must exist in both EN and DE files:

```json
// en.json
{
  "playbooks": {
    "selection": {
      "title": "Choose Your Playbook"
    }
  }
}

// de.json
{
  "playbooks": {
    "selection": {
      "title": "Wähle deinen Playbook"
    }
  }
}
```

### 3. Use Descriptive Keys

```json
// ✅ Good
{
  "schedule": {
    "shift": {
      "title": "Shift Schedule",
      "subtitle": "Adjust all task dates by a specific number of days"
    }
  }
}

// ❌ Bad
{
  "title1": "Shift Schedule",
  "text1": "Adjust all task dates by a specific number of days"
}
```

### 4. Include Context in Accessibility Labels

```json
{
  "accessibility": {
    "playbookCard": "{{name}} playbook, {{setup}} setup, {{weeks}} weeks, {{tasks}} tasks",
    "taskItem": "{{title}}, due {{date}}, {{status}}{{reminder}}"
  }
}
```

## Testing

### Running Translation Tests

```bash
# Run all translation tests
pnpm test translations.test

# Run with coverage
pnpm test translations.test --coverage
```

### What Gets Tested

1. **ICU Format Validation**: Ensures all pluralization and interpolation patterns are valid
2. **Key Parity**: Verifies EN and DE have matching keys
3. **Interpolation Variables**: Checks that all required variables are present
4. **Accessibility Labels**: Validates accessibility-specific translations

### Example Test

```typescript
test('should have valid ICU format for pluralization', () => {
  const { playbooks } = enTranslations;

  expect(playbooks.selection.preview.totalWeeks_one).toContain('{{count}}');
  expect(playbooks.selection.preview.totalWeeks_other).toContain('{{count}}');
});
```

## Adding New Translations

### 1. Add to English File

```json
// src/translations/en.json
{
  "playbooks": {
    "newFeature": {
      "title": "New Feature",
      "description": "This is a new feature",
      "count_one": "{{count}} item",
      "count_other": "{{count}} items"
    }
  }
}
```

### 2. Add to German File

```json
// src/translations/de.json
{
  "playbooks": {
    "newFeature": {
      "title": "Neue Funktion",
      "description": "Dies ist eine neue Funktion",
      "count_one": "{{count}} Element",
      "count_other": "{{count}} Elemente"
    }
  }
}
```

### 3. Add Tests

```typescript
// src/lib/playbooks/i18n/__tests__/translations.test.ts
test('should have newFeature translations', () => {
  expect(enTranslations.playbooks.newFeature.title).toBeDefined();
  expect(deTranslations.playbooks.newFeature.title).toBeDefined();

  expect(enTranslations.playbooks.newFeature.count_one).toContain('{{count}}');
  expect(deTranslations.playbooks.newFeature.count_one).toContain('{{count}}');
});
```

### 4. Validate

```bash
# Validate translation syntax
pnpm i18n:validate

# Run translation tests
pnpm test translations.test
```

## Common Patterns

### Dates and Times

```json
{
  "firstNewDate": "First task: {{date}}",
  "undoAvailable": "Undo available for {{seconds}}s"
}
```

### Percentages

```json
{
  "confidence": "{{percent}}% confidence",
  "customizationLevel": "{{percentage}}% customized"
}
```

### Conditional Text

```json
{
  "taskItem": "{{title}}, due {{date}}, {{status}}{{reminder}}",
  "taskItemWithReminder": ", has reminder"
}
```

Usage:

```typescript
const reminderText = hasReminder
  ? t('playbooks.accessibility.taskItemWithReminder')
  : '';

const label = t('playbooks.accessibility.taskItem', {
  title: 'Water plants',
  date: 'tomorrow',
  status: 'pending',
  reminder: reminderText,
});
```

## Validation

### Automated Checks

The CI pipeline validates:

- Translation key parity between EN and DE
- ICU MessageFormat syntax
- Required interpolation variables
- Proper pluralization patterns

### Manual Validation

```bash
# Lint translations
pnpm lint:translations

# Validate i18n syntax
pnpm i18n:validate

# Run all checks
pnpm check-all
```

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [React i18next](https://react.i18next.com/)
- [Pluralization Rules](https://www.i18next.com/translation-function/plurals)
