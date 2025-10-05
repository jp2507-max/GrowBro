# AI-Driven Schedule Adjustment System

## Overview

The AI-driven schedule adjustment system provides intelligent suggestions to optimize grow schedules based on user behavior patterns and plant health assessments. The system is designed with user control, transparency, and privacy in mind.

## Features

### 1. Intelligent Gating

- **Feature Flags**: Remote control via environment variables
- **Thresholds**: Configurable minimum skipped tasks (default: 2 in 7 days) and confidence levels (default: 70%)
- **User Preferences**: Per-plant "never suggest" setting
- **Cooldown Periods**: 7-day cooldown per root cause to avoid suggestion fatigue

### 2. Explainable Suggestions

- Clear reasoning for each suggestion
- Before/after preview showing which tasks will move and why
- Confidence scores displayed to users
- Educational disclaimers on all AI outputs

### 3. Granular Control

- Accept all suggested changes
- Accept partial changes (per phase or per task)
- Decline suggestions with optional reason
- Dismiss individual suggestions

### 4. Outcome Tracking

- Helpfulness voting (👍/👎) after applying suggestions
- Analytics events for suggestion quality improvement
- Tracks accepted vs declined suggestions
- Monitors suggestion effectiveness over time

## Architecture

### Data Models

#### AdjustmentSuggestion

```typescript
{
  id: string;
  plantId: string;
  playbookId?: string;
  suggestionType: 'watering' | 'feeding' | 'lighting' | 'environment' | 'schedule_shift';
  rootCause: 'skipped_tasks' | 'low_confidence_assessment' | ...;
  reasoning: string;
  affectedTasks: TaskAdjustment[];
  confidence: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  acceptedTasks?: string[];
  helpfulnessVote?: 'helpful' | 'not_helpful';
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}
```

#### AdjustmentCooldown

```typescript
{
  id: string;
  plantId: string;
  rootCause: string;
  cooldownUntil: number;
  createdAt: number;
}
```

#### PlantAdjustmentPreference

```typescript
{
  id: string;
  plantId: string;
  neverSuggest: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### Service Layer

**AIAdjustmentService** (`ai-adjustment-service.ts`)

- `shouldSuggestAdjustments()`: Checks feature flags, thresholds, preferences, and cooldowns
- `generateSuggestions()`: Creates suggestions based on context
- `applySuggestion()`: Applies accepted changes (full or partial)
- `declineSuggestion()`: Records declined suggestions and sets cooldown
- `voteHelpfulness()`: Records user feedback
- `setNeverSuggest()`: Updates plant preferences

### React Hook

**useAIAdjustments** (`use-ai-adjustments.ts`)

```typescript
const {
  suggestions,
  loading,
  generateSuggestion,
  acceptSuggestion,
  declineSuggestion,
  voteHelpfulness,
  setNeverSuggest,
  refresh,
} = useAIAdjustments(plantId);
```

### UI Components

1. **AdjustmentSuggestionCard**: Displays suggestion summary with view/dismiss actions
2. **AdjustmentPreviewModal**: Full-screen modal showing detailed before/after with granular acceptance
3. **HelpfulnessVoting**: Thumbs up/down voting after applying suggestions

## Usage Example

```typescript
import { useAIAdjustments } from '@/lib/playbooks/use-ai-adjustments';

function PlantDetailScreen({ plantId }: { plantId: string }) {
  const {
    suggestions,
    acceptSuggestion,
    declineSuggestion,
    voteHelpfulness,
  } = useAIAdjustments(plantId);

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  return (
    <View>
      {pendingSuggestions.map(suggestion => (
        <AdjustmentSuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onView={(s) => {/* Show preview modal */}}
          onDismiss={(id) => declineSuggestion(id)}
        />
      ))}
    </View>
  );
}
```

## Analytics Events

The system emits three key analytics events:

### ai_adjustment_suggested

Emitted when a suggestion is generated

```typescript
{
  playbookId: string;
  adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
  confidence: number;
}
```

### ai_adjustment_applied

Emitted when user accepts a suggestion

```typescript
{
  playbookId: string;
  adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
  applied: boolean;
}
```

### ai_adjustment_declined

Emitted when user declines a suggestion

```typescript
{
  playbookId: string;
  adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
  reason?: string;
}
```

## Feature Flags

Configure via environment variables:

```env
FEATURE_AI_ADJUSTMENTS_ENABLED=false
FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS=2
FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE=0.7
```

## Database Schema

### adjustment_suggestions

- `plant_id` (indexed)
- `playbook_id`
- `suggestion_type`
- `root_cause`
- `reasoning`
- `affected_tasks` (JSON)
- `confidence`
- `status` (indexed)
- `accepted_tasks` (JSON)
- `helpfulness_vote`
- `expires_at` (indexed)
- `created_at`
- `updated_at`

### adjustment_cooldowns

- `plant_id` (indexed)
- `root_cause` (indexed)
- `cooldown_until` (indexed)
- `created_at`

### plant_adjustment_preferences

- `plant_id` (indexed)
- `never_suggest`
- `created_at`
- `updated_at`

## Testing

Run tests:

```bash
pnpm test ai-adjustment-service
pnpm test adjustment-suggestion-card
```

## Compliance

- All AI outputs include disclaimer: "AI suggestion • Educational, not professional advice"
- No automatic schedule changes without explicit user confirmation
- User can disable suggestions per plant or decline individual suggestions
- Cooldown periods prevent suggestion fatigue
- Analytics events respect user privacy consent settings

## Future Enhancements

1. **ML Integration**: Replace simplified logic with actual ML models
2. **More Root Causes**: Add detection for environmental stress, nutrient issues, etc.
3. **Phase-Specific Suggestions**: Tailor suggestions to growth phase
4. **Strain-Specific Adjustments**: Use strain characteristics for better suggestions
5. **Historical Learning**: Improve suggestions based on user's past acceptance patterns
