# AI Photo Diagnosis Integration Guide

**Version**: 1.0  
**Last Updated**: October 26, 2025  
**Task**: 12 - Final Integration and Polish

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Integration Points](#integration-points)
4. [Component Usage](#component-usage)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The AI Photo Diagnosis feature is now integrated with core app functionality:

- **Plant Profiles**: Assessment history display
- **Calendar System**: Task creation from action plans
- **Community Feed**: Prefilled post creation with redacted images
- **Analytics**: Comprehensive tracking of user actions

### Key Features

- ✅ Assessment history timeline in plant profiles
- ✅ One-tap task creation from AI recommendations
- ✅ Playbook adjustment suggestions
- ✅ Community post prefill with privacy-safe images
- ✅ Offline-first with sync support
- ✅ Analytics and telemetry integration

---

## Architecture

### Data Flow

```
Assessment Capture → Inference → Result Storage → Integration Points
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
            Plant Profile      Task Creation    Community Post
            (History View)     (Action Plan)    (Prefilled)
```

### Database Schema

**AssessmentModel** (WatermelonDB)

- `plant_id`: Foreign key to plant/series
- `user_id`: Foreign key to user
- `status`: pending | processing | completed | failed
- `predicted_class`: Assessment class ID
- `calibrated_confidence`: Confidence score (0-1)
- `action_plan`: JSON field with steps
- `issue_resolved`: Boolean tracking resolution

---

## Integration Points

### 1. Plant Profile Assessment History

**Purpose**: Display assessment history for a specific plant

**Component**: `PlantAssessmentHistorySection`

**Usage**:

```tsx
import { PlantAssessmentHistorySection } from '@/components/plants';

function PlantDetailScreen({ plantId }: { plantId: string }) {
  return (
    <ScrollView>
      {/* Other plant details */}

      <PlantAssessmentHistorySection
        plantId={plantId}
        initiallyExpanded={false}
      />
    </ScrollView>
  );
}
```

**Features**:

- Collapsible accordion UI
- Assessment count badge
- Timeline view with newest first
- Status indicators (Resolved/Pending/Failed)
- Device vs Cloud mode display
- Tap to navigate to result details

**Query Functions**:

```tsx
import {
  getAssessmentsByPlantId,
  getUnresolvedAssessments,
  getAssessmentCount,
} from '@/lib/assessment/assessment-queries';

// Get all assessments
const assessments = await getAssessmentsByPlantId(plantId, 50);

// Get only unresolved issues
const unresolved = await getUnresolvedAssessments(plantId);

// Get count for badge
const count = await getAssessmentCount(plantId);
```

---

### 2. Task Creation from Action Plans

**Purpose**: Create calendar tasks from AI recommendations

**Component**: `TaskCreationModal`

**Usage**:

```tsx
import { TaskCreationModal } from '@/components/assessment';
import { useState } from 'react';

function AssessmentResultScreen() {
  const [showTaskModal, setShowTaskModal] = useState(false);

  return (
    <>
      <Button onPress={() => setShowTaskModal(true)}>Create Tasks</Button>

      <TaskCreationModal
        visible={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        assessment={result}
        assessmentId={assessmentId}
        plantId={plantContext.id}
        actionPlan={result.actionPlan}
        timezone="Europe/Berlin"
      />
    </>
  );
}
```

**Features**:

- Bottom sheet modal UI
- Task preview list
- Batch creation with error handling
- Success/failure feedback
- Analytics tracking
- Partial success support

**Handler Service**:

```tsx
import { handleTaskCreation } from '@/lib/assessment/task-creation-handler';

const result = await handleTaskCreation({
  plan: actionPlan,
  plantId,
  assessmentId,
  classId: assessment.topClass.id,
  timezone: 'Europe/Berlin',
  assessment,
});

console.log(`Created ${result.createdCount} of ${result.totalCount} tasks`);
```

---

### 3. Playbook Adjustment Suggestions

**Purpose**: Display AI-generated playbook modifications

**Component**: `PlaybookAdjustmentCard`

**Usage**:

```tsx
import { PlaybookAdjustmentCard } from '@/components/assessment';
import { suggestPlaybookAdjustments } from '@/lib/assessment/playbook-integration';

function ResultScreen() {
  const { adjustments } = suggestPlaybookAdjustments({
    assessment,
    plan: actionPlan,
    context: plantContext,
    assessmentId,
  });

  if (adjustments.length === 0) return null;

  return (
    <PlaybookAdjustmentCard
      adjustments={adjustments}
      onAccept={(adjustment) => {
        // Handle adjustment application
        console.log('Applying:', adjustment);
      }}
    />
  );
}
```

**Adjustment Types**:

- **Schedule**: Timing changes (e.g., "+2 days between waterings")
- **Resource**: Equipment or supply changes
- **Instructions**: Process modifications
- **Priority**: Task importance changes

---

### 4. Community Post Deep-Link

**Purpose**: Navigate to community post creation with prefilled data

**Component**: `CommunityCTAButton` (auto-integrated)

**How It Works**:

1. User taps "Ask Community" button
2. System retrieves assessment session data
3. `generateCommunityPostPrefill()` creates redacted post data
4. Navigation to `/feed/add-post` with params

**Route Parameters**:

```typescript
{
  source: 'assessment',
  assessmentId: string,
  prefillTitle: string,
  prefillBody: string,
  prefillTags: string, // JSON array
  prefillImages: string, // JSON array of {uri, filename}
}
```

**Community Post Screen Integration**:

```tsx
// In your /feed/add-post screen
import { useLocalSearchParams } from 'expo-router';

function AddPostScreen() {
  const params = useLocalSearchParams();

  const prefillData =
    params.source === 'assessment'
      ? {
          title: params.prefillTitle as string,
          body: params.prefillBody as string,
          tags: JSON.parse(params.prefillTags as string),
          images: JSON.parse(params.prefillImages as string),
        }
      : null;

  // Use prefillData to populate form
}
```

---

### 5. Result Action Panel

**Purpose**: Unified action buttons for assessment results

**Component**: `ResultActionPanel`

**Usage**:

```tsx
import { ResultActionPanel } from '@/components/assessment';

function ResultScreen() {
  return (
    <ResultActionPanel
      assessment={result}
      assessmentId={assessmentId}
      plantId={plantContext.id}
      actionPlan={result.actionPlan}
      onCreateTasks={() => setShowTaskModal(true)}
      onAskCommunity={() => setShowCommunityModal(true)}
      onRetake={handleRetake}
    />
  );
}
```

**Actions**:

- **Create Tasks**: Opens task creation modal
- **Ask Community**: Navigates to post creation
- **View History**: Navigates to plant profile
- **Retake**: Returns to capture screen

---

## API Reference

### Query Functions

#### `getAssessmentsByPlantId(plantId, limit?)`

Fetches assessments for a plant, sorted by creation date (newest first).

**Parameters**:

- `plantId` (string): Plant ID to query
- `limit` (number, optional): Maximum results (default: 50)

**Returns**: `Promise<AssessmentQueryResult[]>`

#### `getUnresolvedAssessments(plantId)`

Fetches only unresolved, completed assessments for a plant.

**Parameters**:

- `plantId` (string): Plant ID to query

**Returns**: `Promise<AssessmentQueryResult[]>`

#### `getAssessmentCount(plantId)`

Gets total assessment count for a plant.

**Parameters**:

- `plantId` (string): Plant ID to query

**Returns**: `Promise<number>`

#### `getAssessmentById(assessmentId)`

Fetches a single assessment by ID.

**Parameters**:

- `assessmentId` (string): Assessment ID

**Returns**: `Promise<AssessmentQueryResult | null>`

---

### Task Integration

#### `handleTaskCreation(options)`

Creates tasks from action plan with error handling.

**Parameters**:

```typescript
{
  plan: AssessmentActionPlan,
  plantId: string,
  assessmentId: string,
  classId: string,
  timezone?: string,
  assessment: AssessmentResult
}
```

**Returns**: `Promise<TaskCreationHandlerResult>`

```typescript
{
  success: boolean,
  createdCount: number,
  failedCount: number,
  totalCount: number,
  createdTaskIds: string[],
  errors: Array<{index: number, error: string}>
}
```

#### `getTaskCreationMessage(result)`

Generates user-friendly message from task creation result.

**Parameters**:

- `result` (TaskCreationHandlerResult)

**Returns**: `string`

---

### Playbook Integration

#### `suggestPlaybookAdjustments(options)`

Generates playbook adjustment suggestions.

**Parameters**:

```typescript
{
  assessment: AssessmentResult,
  plan: AssessmentActionPlan,
  playbook?: Playbook,
  context: AssessmentPlantContext,
  assessmentId?: string
}
```

**Returns**: `PlaybookAdjustmentResult`

```typescript
{
  adjustments: PlaybookAdjustment[],
  metadata: {
    assessmentId?: string,
    classId: string,
    confidence: number,
    suggestedCount: number,
    timestamp: number
  }
}
```

---

## Best Practices

### Performance

1. **Query Limits**: Use appropriate limits for assessment queries

   ```tsx
   // Good: Limit to recent assessments
   const recent = await getAssessmentsByPlantId(plantId, 20);

   // Avoid: Loading all assessments
   const all = await getAssessmentsByPlantId(plantId, 1000);
   ```

2. **FlashList**: Assessment history uses FlashList for performance
   - Handles large datasets efficiently
   - No manual optimization needed

3. **Image Redaction**: Community post prefill is async

   ```tsx
   // Show loading state during prefill generation
   const [loading, setLoading] = useState(false);

   const handleAskCommunity = async () => {
     setLoading(true);
     try {
       const prefillData = await generateCommunityPostPrefill({...});
       // Navigate with data
     } finally {
       setLoading(false);
     }
   };
   ```

### Error Handling

1. **Task Creation**: Handle partial failures gracefully

   ```tsx
   const result = await handleTaskCreation(options);

   if (result.failedCount > 0) {
     showMessage({
       message: 'Partial Success',
       description: `Created ${result.createdCount} of ${result.totalCount} tasks`,
       type: 'warning',
     });
   }
   ```

2. **Query Errors**: Provide fallback UI
   ```tsx
   try {
     const assessments = await getAssessmentsByPlantId(plantId);
   } catch (error) {
     // Show error state, don't crash
     return <ErrorView message="Failed to load assessments" />;
   }
   ```

### Analytics

All integration points automatically track events:

- Assessment history views
- Task creation attempts/successes
- Community CTA interactions
- Playbook adjustment displays

No manual tracking needed in most cases.

---

## Troubleshooting

### Assessment History Not Showing

**Problem**: Plant profile shows "No assessments yet" despite completed assessments.

**Solutions**:

1. Verify `plant_id` matches between assessment and plant records
2. Check assessment `status` is "completed"
3. Ensure WatermelonDB sync is working

**Debug**:

```tsx
const count = await getAssessmentCount(plantId);
console.log(`Found ${count} assessments for plant ${plantId}`);

const assessments = await getAssessmentsByPlantId(plantId);
console.log(
  'Assessments:',
  assessments.map((a) => ({
    id: a.id,
    status: a.status,
    class: a.predictedClass,
  }))
);
```

### Task Creation Fails

**Problem**: Tasks not created from action plan.

**Solutions**:

1. Verify action plan has `taskTemplate` fields
2. Check timezone is valid IANA string
3. Ensure `createTask` function is not mocked in production

**Debug**:

```tsx
const { taskInputs } = createTasksFromActionPlan({...});
console.log(`Generated ${taskInputs.length} task inputs`);
console.log('First task:', taskInputs[0]);
```

### Community Post Prefill Missing

**Problem**: Post creation screen doesn't receive prefill data.

**Solutions**:

1. Verify assessment session exists in store
2. Check route params are being read correctly
3. Ensure images are accessible (not expired URIs)

**Debug**:

```tsx
const session = getAssessmentSession(assessmentId);
console.log('Session:', session ? 'Found' : 'Missing');
console.log('Photos:', session?.photos.length);
```

---

## Migration Guide

### Updating Existing Screens

#### Before (No Integration)

```tsx
function PlantScreen({ plantId }) {
  return (
    <View>
      <Text>Plant Details</Text>
      {/* No assessment history */}
    </View>
  );
}
```

#### After (With Integration)

```tsx
import { PlantAssessmentHistorySection } from '@/components/plants';

function PlantScreen({ plantId }) {
  return (
    <ScrollView>
      <Text>Plant Details</Text>

      {/* Add assessment history */}
      <PlantAssessmentHistorySection plantId={plantId} />
    </ScrollView>
  );
}
```

---

## Support

For issues or questions:

- Check [Troubleshooting Guide](./troubleshooting.md)
- Review [Test Implementation Notes](./test-implementation-notes.md)
- See [Task 12 Summary](./task-12-integration-summary.md)

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**Status**: Production Ready
