# Community Playbook Templates

This module implements the community template sharing feature for guided grow playbooks.

## Overview

The community template sharing system allows users to share their customized playbooks with the community while ensuring all personally identifiable information (PII) and personal plant data is stripped before sharing.

## Key Features

- **PII Sanitization**: Automatically removes emails, phone numbers, URLs, and other PII
- **RLS Security**: Row-level security ensures proper access control
- **Template Adoption**: Users can adopt and customize community templates
- **Ratings & Comments**: Community engagement through ratings and comments
- **Realtime Updates**: Supabase Realtime for ratings and comments only (not private data)
- **Analytics Tracking**: Tracks template sharing and adoption events

## Architecture

### Database Schema

The feature uses three main tables in Supabase:

1. **community_playbook_templates**: Stores shared templates
   - Public read access (RLS)
   - Owner write access (RLS)
   - Includes adoption count, ratings, and metadata

2. **template_ratings**: Stores user ratings
   - Public read access
   - User can create/update/delete their own ratings
   - Automatically updates template rating average

3. **template_comments**: Stores user comments
   - Public read access
   - User can create/update their own comments
   - Soft delete support

### Services

#### TemplateSharingService

Handles sharing playbooks as community templates:

```typescript
const service = new TemplateSharingService(supabase, analytics);

// Share a template
const template = await service.shareTemplate({
  playbook,
  authorHandle: 'grower123',
  description: 'My custom indoor auto grow',
  license: 'CC-BY-SA',
  isPublic: true,
});

// List templates
const { templates, total } = await service.listTemplates({
  setup: 'auto_indoor',
  sortBy: 'rating_average',
  limit: 20,
});
```

#### TemplateAdoptionService

Handles adopting and customizing community templates:

```typescript
const service = new TemplateAdoptionService(supabase);

// Adopt a template
const adopted = await service.adoptTemplate({
  templateId: 'template-uuid',
  plantId: 'plant-uuid',
  customizations: {
    name: 'My Custom Version',
    skipSteps: ['step-1', 'step-2'],
    modifySteps: [
      {
        stepId: 'step-3',
        changes: { title: 'Modified Title' },
      },
    ],
  },
});

// Rate a template
await service.rateTemplate('template-uuid', 5, 'Great playbook!');

// Comment on a template
await service.commentOnTemplate(
  'template-uuid',
  'This worked great for my grow',
  'grower123'
);
```

### PII Sanitization

The `sanitize-playbook.ts` module provides comprehensive PII stripping:

- **Email addresses**: Replaced with `[email removed]`
- **Phone numbers**: Replaced with `[phone removed]`
- **URLs**: Replaced with `[link removed]`
- **@ mentions**: Replaced with `[mention removed]`
- **Long text**: Truncated to 500 characters

```typescript
import { sanitizePlaybookForSharing } from './sanitize-playbook';

const sanitized = sanitizePlaybookForSharing(playbook, 'grower123');
// Returns: SanitizedPlaybook with all PII removed
```

### Validation

Before sharing, playbooks are validated to ensure:

- Name is present and non-empty
- Setup type is specified
- At least 5 steps are included
- All steps have required fields (title, phase, relativeDay, taskType)
- Author handle is valid (no PII patterns)

```typescript
import { validatePlaybookForSharing } from './sanitize-playbook';

const validation = validatePlaybookForSharing(playbook);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## API Layer

### React Query Hooks

The feature provides several React Query hooks for easy integration:

```typescript
import {
  useTemplates,
  useTemplate,
  useShareTemplate,
  useAdoptTemplate,
  useRateTemplate,
  useCommentTemplate,
  useTemplateComments,
} from '@/api/templates';

// List templates
const { data, isLoading } = useTemplates({
  variables: { setup: 'auto_indoor', sortBy: 'rating_average' },
});

// Get single template
const { data: template } = useTemplate({ variables: { id: 'template-uuid' } });

// Share template
const shareTemplate = useShareTemplate();
await shareTemplate.mutateAsync({
  playbook,
  authorHandle: 'grower123',
  description: 'My custom grow',
});

// Adopt template
const adoptTemplate = useAdoptTemplate();
await adoptTemplate.mutateAsync({
  templateId: 'template-uuid',
  plantId: 'plant-uuid',
});
```

## UI Components

### ShareTemplateModal

Modal for sharing a playbook as a community template:

```typescript
import { ShareTemplateModal } from '@/components/playbooks';

<ShareTemplateModal
  playbook={playbook}
  onSuccess={() => console.log('Shared!')}
  onCancel={() => console.log('Cancelled')}
/>
```

### TemplateListItem

Displays a template in a list:

```typescript
import { TemplateListItem } from '@/components/playbooks';

<TemplateListItem
  template={template}
  onPress={(template) => console.log('Selected:', template)}
/>
```

### TemplateDetailView

Displays detailed information about a template:

```typescript
import { TemplateDetailView } from '@/components/playbooks';

<TemplateDetailView
  template={template}
  onAdopt={(template) => console.log('Adopting:', template)}
  onRate={(template) => console.log('Rating:', template)}
/>
```

## Security

### Row-Level Security (RLS)

All tables have RLS enabled with the following policies:

**community_playbook_templates**:

- Public can view non-deleted templates
- Users can create their own templates
- Authors can update their own templates
- Authors can soft-delete their own templates

**template_ratings**:

- Public can view ratings
- Users can create/update/delete their own ratings

**template_comments**:

- Public can view non-deleted comments
- Users can create/update their own comments

### Realtime Subscriptions

Supabase Realtime is used ONLY for:

- Template ratings (public data)
- Template comments (public data)

Private user data (plants, tasks, etc.) does NOT use Realtime subscriptions.

## Analytics

The feature tracks the following events:

- `playbook_saved_as_template`: When a user shares a template
  - Payload: `{ playbookId, templateName, isPublic }`

All analytics events respect user consent and are automatically sanitized to remove PII.

## Testing

Comprehensive unit tests are provided in `sanitize-playbook.test.ts`:

```bash
pnpm test sanitize-playbook -- --coverage
```

Test coverage:

- PII removal (emails, phones, URLs, mentions)
- Author handle validation
- Metadata calculation (weeks, task count)
- Step sanitization
- Playbook validation

## Migration

To set up the database schema, run the migrations:

```bash
# Create tables and RLS policies
supabase/migrations/20251005_create_community_playbook_templates.sql

# Add adoption increment function
supabase/migrations/20251005_add_template_adoption_function.sql
```

## License

Templates shared through this system use the CC-BY-SA (Creative Commons Attribution-ShareAlike) license by default, allowing others to use and modify with attribution.

## Compliance

- All PII is stripped before sharing
- No personal plant data is included in shared templates
- Content is educational and non-commercial
- Follows app store policies for community content
