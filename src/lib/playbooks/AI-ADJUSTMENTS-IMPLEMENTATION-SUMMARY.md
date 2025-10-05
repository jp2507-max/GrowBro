# AI-Driven Schedule Adjustment System - Implementation Summary

## Task Completion Status

✅ **Task 9: Build AI-driven schedule adjustment system** - COMPLETED

All requirements from the task specification have been implemented and tested.

## Implementation Overview

### 1. Feature Gating ✅

- **Feature Flags**: Added `aiAdjustmentsEnabled`, `aiAdjustmentsMinSkippedTasks`, and `aiAdjustmentsMinConfidence` to feature flags system
- **Thresholds**: Configurable via environment variables (default: ≥2 skipped tasks in 7 days OR assessment confidence <70%)
- **User Preferences**: Per-plant "never suggest" setting stored in database
- **Cooldown System**: 7-day cooldown per root cause to prevent suggestion fatigue

### 2. Explainable Adjustment Proposals ✅

- **Clear Reasoning**: Each suggestion includes human-readable explanation of why it's being suggested
- **Task Details**: Shows which tasks will move, from what date to what date, and why
- **Confidence Scores**: Displays confidence percentage (0-100%) to users
- **Educational Disclaimers**: All AI outputs include "AI suggestion • Educational, not professional advice"

### 3. Partial Acceptance ✅

- **Granular Control**: Users can select individual tasks to accept or decline
- **Phase-Level Selection**: Tasks grouped by phase for easier bulk selection
- **Accept All**: One-tap option to accept all suggested changes
- **Accept Selected**: Apply only the selected subset of changes

### 4. Cooldown and Preferences ✅

- **7-Day Cooldown**: Automatically set after accepting or declining a suggestion
- **Per Root Cause**: Cooldown is specific to the reason (e.g., skipped_tasks, low_confidence_assessment)
- **Never Suggest**: Plant-level setting to completely disable suggestions
- **Persistent Storage**: All preferences and cooldowns stored in WatermelonDB

### 5. Outcome Tracking ✅

- **Helpfulness Voting**: Thumbs up/down voting after applying suggestions
- **Vote Storage**: Votes stored with suggestions for quality improvement
- **Analytics Events**: Three key events emitted:
  - `ai_adjustment_suggested`: When suggestion is generated
  - `ai_adjustment_applied`: When user accepts (full or partial)
  - `ai_adjustment_declined`: When user declines with optional reason

### 6. Analytics Integration ✅

- **Structured Events**: All events follow existing analytics schema
- **Consent Gating**: Respects user's analytics consent preferences
- **PII Sanitization**: No personally identifiable information in events
- **Quality Metrics**: Tracks confidence, acceptance rate, and helpfulness votes

### 7. UI Components ✅

- **AdjustmentSuggestionCard**: Compact card showing suggestion summary
- **AdjustmentPreviewModal**: Full-screen modal with detailed before/after view
- **HelpfulnessVoting**: Simple thumbs up/down component
- **Example Implementation**: Complete example showing integration in plant detail screen

## Files Created

### Data Layer

- `src/types/ai-adjustments.ts` - TypeScript types for suggestions, cooldowns, and preferences
- `src/lib/watermelon-schema.ts` - Updated schema (v10 → v11) with 3 new tables
- `src/lib/watermelon-migrations.ts` - Migration definitions for schema changes

### Service Layer

- `src/lib/playbooks/ai-adjustment-service.ts` - Core service handling all AI adjustment logic
- `src/lib/playbooks/use-ai-adjustments.ts` - React hook for using the service in components

### UI Layer

- `src/components/playbooks/adjustment-suggestion-card.tsx` - Suggestion summary card
- `src/components/playbooks/adjustment-preview-modal.tsx` - Detailed preview modal
- `src/components/playbooks/helpfulness-voting.tsx` - Voting component
- `src/components/playbooks/ai-adjustments-example.tsx` - Complete example implementation

### Configuration

- `src/lib/feature-flags.ts` - Updated with AI adjustment feature flags

### Tests

- `src/lib/playbooks/__tests__/ai-adjustment-service.test.ts` - Unit tests for service (11 tests)
- `src/components/playbooks/__tests__/adjustment-suggestion-card.test.tsx` - Component tests (8 tests)
- `src/lib/playbooks/__tests__/ai-adjustments-integration.test.ts` - Integration tests (3 tests)

### Documentation

- `src/lib/playbooks/README-ai-adjustments.md` - Comprehensive documentation
- `src/lib/playbooks/AI-ADJUSTMENTS-IMPLEMENTATION-SUMMARY.md` - This file

## Database Schema Changes

### New Tables (Schema v11)

#### adjustment_suggestions

Stores AI-generated schedule adjustment suggestions

- `plant_id` (indexed) - Which plant the suggestion is for
- `playbook_id` - Associated playbook (optional)
- `suggestion_type` - Type of adjustment (watering, feeding, lighting, environment, schedule_shift)
- `root_cause` - Why the suggestion was made (skipped_tasks, low_confidence_assessment, etc.)
- `reasoning` - Human-readable explanation
- `affected_tasks` (JSON) - Array of task adjustments with before/after dates
- `confidence` - Confidence score (0-1)
- `status` - Current status (pending, accepted, declined, expired)
- `accepted_tasks` (JSON) - Which tasks were accepted (for partial acceptance)
- `helpfulness_vote` - User feedback (helpful, not_helpful)
- `expires_at` (indexed) - When suggestion expires (3 days)
- `created_at`, `updated_at` - Timestamps

#### adjustment_cooldowns

Tracks cooldown periods to prevent suggestion fatigue

- `plant_id` (indexed) - Which plant
- `root_cause` (indexed) - Which type of issue
- `cooldown_until` (indexed) - When cooldown expires
- `created_at` - When cooldown was set

#### plant_adjustment_preferences

Stores per-plant user preferences

- `plant_id` (indexed) - Which plant
- `never_suggest` - Whether to disable all suggestions for this plant
- `created_at`, `updated_at` - Timestamps

## Test Coverage

### Unit Tests (11 tests)

- Feature flag gating
- Threshold checking
- Cooldown enforcement
- Preference handling
- Suggestion generation
- Acceptance (full and partial)
- Decline with cooldown
- Helpfulness voting

### Component Tests (8 tests)

- Rendering with various data
- User interactions (view, dismiss)
- Edge cases (single task, low confidence)

### Integration Tests (3 tests)

- Complete flow: generate → accept → vote
- Complete flow: generate → decline → cooldown
- Never suggest preference blocking

**Total: 22 tests, all passing ✅**

## Analytics Events

### ai_adjustment_suggested

```typescript
{
  playbookId: string;
  adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
  confidence: number;
}
```

### ai_adjustment_applied

```typescript
{
  playbookId: string;
  adjustmentType: 'watering' | 'feeding' | 'lighting' | 'environment';
  applied: boolean;
}
```

### ai_adjustment_declined

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
# Enable/disable AI adjustments feature
FEATURE_AI_ADJUSTMENTS_ENABLED=false

# Minimum skipped tasks to trigger suggestion (default: 2)
FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS=2

# Minimum confidence threshold (default: 0.7 = 70%)
FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE=0.7
```

## Usage Example

```typescript
import { useAIAdjustments } from '@/lib/playbooks/use-ai-adjustments';
import { AdjustmentSuggestionCard } from '@/components/playbooks/adjustment-suggestion-card';

function PlantDetailScreen({ plantId }: { plantId: string }) {
  const {
    suggestions,
    acceptSuggestion,
    declineSuggestion,
    voteHelpfulness,
  } = useAIAdjustments(plantId);

  const pending = suggestions.filter(s => s.status === 'pending');

  return (
    <View>
      {pending.map(suggestion => (
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

## Compliance

✅ All AI outputs include educational disclaimer
✅ No automatic changes without explicit user confirmation
✅ User can disable suggestions per plant
✅ Cooldown periods prevent suggestion fatigue
✅ Analytics respects user privacy consent
✅ No PII in analytics events

## Definition of Done Checklist

- [x] Gate suggestions behind remote feature flags with thresholds
- [x] Implement explainable adjustment proposals showing which tasks move and why
- [x] Allow partial acceptance of suggestions (per phase or per task)
- [x] Add 7-day cool-down per root cause plus "Never suggest for this plant" user setting
- [x] Build suggestion outcome tracking with "helpful" voting
- [x] Emit ai_adjustment_suggested, ai_adjustment_applied, ai_adjustment_declined analytics events
- [x] Create clear UI explaining AI reasoning and allowing granular acceptance/rejection
- [x] Suggestions properly gated
- [x] Explanations clear
- [x] Partial acceptance works
- [x] Outcomes tracked
- [x] All tests passing (22/22)

## Next Steps

1. **Enable Feature Flag**: Set `FEATURE_AI_ADJUSTMENTS_ENABLED=true` in environment
2. **Integrate with Plant Screens**: Add AI adjustment components to plant detail screens
3. **Monitor Analytics**: Track suggestion acceptance rates and helpfulness votes
4. **Iterate on ML**: Replace simplified logic with actual ML models based on user data
5. **Add More Root Causes**: Expand beyond skipped_tasks and low_confidence_assessment

## Notes

- The current implementation uses simplified logic for generating suggestions. In production, this should be replaced with actual ML models that learn from user patterns.
- Task date calculations are simplified. Production should use proper timezone-aware date manipulation with the existing RRULE system.
- The system is designed to be extensible - new root causes and suggestion types can be added easily.
- All database operations use WatermelonDB's write() method for proper transaction handling.
- The UI components follow the project's design system and accessibility guidelines.
