# AI Photo Diagnosis Troubleshooting Guide

**Version**: 1.0  
**Last Updated**: October 26, 2025

---

## Table of Contents

1. [Common Issues](#common-issues)
2. [Assessment History](#assessment-history)
3. [Task Creation](#task-creation)
4. [Community Integration](#community-integration)
5. [Performance Issues](#performance-issues)
6. [Data Sync](#data-sync)
7. [Debugging Tools](#debugging-tools)

---

## Common Issues

### Issue: Assessment History Not Displaying

**Symptoms**:

- Plant profile shows "No assessments yet"
- Assessment count shows 0
- History section appears empty

**Possible Causes**:

1. Plant ID mismatch
2. Assessments not synced to local database
3. Assessment status not "completed"
4. WatermelonDB query error

**Solutions**:

```tsx
// 1. Verify plant ID is correct
console.log('Plant ID:', plantId);

// 2. Check assessment count
import { getAssessmentCount } from '@/lib/assessment/assessment-queries';
const count = await getAssessmentCount(plantId);
console.log('Assessment count:', count);

// 3. Check assessments directly
import { getAssessmentsByPlantId } from '@/lib/assessment/assessment-queries';
const assessments = await getAssessmentsByPlantId(plantId);
console.log('Assessments:', assessments);

// 4. Verify assessment status
assessments.forEach((a) => {
  console.log(
    `Assessment ${a.id}: status=${a.status}, class=${a.predictedClass}`
  );
});
```

**Fix**:

- Ensure `plant_id` in assessment matches plant record
- Complete assessment flow fully (don't interrupt)
- Check WatermelonDB sync status
- Verify assessment status is "completed"

---

### Issue: Task Creation Fails Silently

**Symptoms**:

- "Create Tasks" button does nothing
- Modal opens but no tasks created
- Success message shows but tasks don't appear in calendar

**Possible Causes**:

1. Action plan missing task templates
2. Invalid timezone string
3. Task manager service error
4. Database write permission issue

**Solutions**:

```tsx
// 1. Check action plan structure
console.log('Action plan:', JSON.stringify(actionPlan, null, 2));

// 2. Count creatable tasks
import { countCreatableTasks } from '@/lib/assessment/task-integration';
const count = countCreatableTasks(actionPlan);
console.log('Creatable tasks:', count);

// 3. Test task creation directly
import { handleTaskCreation } from '@/lib/assessment/task-creation-handler';
const result = await handleTaskCreation({
  plan: actionPlan,
  plantId,
  assessmentId,
  classId: assessment.topClass.id,
  timezone: 'Europe/Berlin',
  assessment,
});
console.log('Task creation result:', result);

// 4. Check for errors
if (result.errors.length > 0) {
  console.error('Task creation errors:', result.errors);
}
```

**Fix**:

- Verify action plan has `taskTemplate` fields
- Use valid IANA timezone (e.g., "Europe/Berlin", "America/New_York")
- Check database permissions
- Review error logs for specific failures

---

### Issue: Community Post Prefill Not Working

**Symptoms**:

- Post creation screen opens but fields are empty
- Images not attached
- Title/body not prefilled

**Possible Causes**:

1. Assessment session expired/cleared
2. Route params not passed correctly
3. Image URIs expired
4. Post creation screen not reading params

**Solutions**:

```tsx
// 1. Check assessment session
import { getAssessmentSession } from '@/lib/assessment/current-assessment-store';
const session = getAssessmentSession(assessmentId);
console.log('Session exists:', !!session);
console.log('Photos count:', session?.photos.length);

// 2. Verify prefill generation
import { generateCommunityPostPrefill } from '@/lib/assessment/community-post-prefill';
const prefillData = await generateCommunityPostPrefill({
  assessment,
  assessmentId,
  plantContext: session.plantContext,
  capturedPhotos: session.photos,
});
console.log('Prefill data:', prefillData);

// 3. Check route params
// In post creation screen:
import { useLocalSearchParams } from 'expo-router';
const params = useLocalSearchParams();
console.log('Route params:', params);
```

**Fix**:

- Don't clear assessment session before navigation
- Verify post creation screen reads `prefillTitle`, `prefillBody`, `prefillTags`, `prefillImages` params
- Parse JSON params correctly: `JSON.parse(params.prefillTags as string)`
- Ensure images are still accessible (not temporary/expired URIs)

---

## Assessment History

### Empty State Persists After Assessment

**Problem**: Completed assessment but history still shows empty.

**Debug Steps**:

1. Check assessment was saved to database
2. Verify plant ID matches
3. Confirm assessment status is "completed"
4. Test query directly

**Code**:

```tsx
// Direct database query
import { database } from '@/lib/watermelon';
const collection = database.collections.get('assessments');
const all = await collection.query().fetch();
console.log('All assessments:', all.length);

const forPlant = await collection.query(Q.where('plant_id', plantId)).fetch();
console.log('Assessments for plant:', forPlant.length);
```

---

### History List Performance Issues

**Problem**: Slow scrolling or lag when viewing history.

**Solutions**:

1. Reduce query limit
2. Implement pagination
3. Optimize FlashList rendering

**Code**:

```tsx
// Reduce initial load
<AssessmentHistoryList plantId={plantId} limit={20} />;

// Add pagination (future enhancement)
const [page, setPage] = useState(1);
const limit = 20;
const offset = (page - 1) * limit;
```

---

## Task Creation

### Partial Task Creation

**Problem**: Some tasks created, others failed.

**Expected Behavior**: This is normal! The system handles partial failures.

**Check Result**:

```tsx
const result = await handleTaskCreation(options);
console.log(`Created: ${result.createdCount}/${result.totalCount}`);
console.log('Failures:', result.errors);
```

**User Feedback**:

```tsx
if (result.failedCount > 0) {
  showMessage({
    message: 'Partial Success',
    description: `Created ${result.createdCount} of ${result.totalCount} tasks. ${result.failedCount} failed.`,
    type: 'warning',
  });
}
```

---

### Tasks Not Appearing in Calendar

**Problem**: Tasks created successfully but don't show in calendar.

**Possible Causes**:

1. Calendar filter hiding tasks
2. Date range outside view
3. Task notification not scheduled
4. Cache not refreshed

**Solutions**:

```tsx
// 1. Verify task was created
import { database } from '@/lib/watermelon';
const tasks = await database.collections
  .get('tasks')
  .query(Q.where('plant_id', plantId))
  .fetch();
console.log('Tasks for plant:', tasks.length);

// 2. Check task due dates
tasks.forEach((t) => {
  console.log(`Task: ${t.title}, Due: ${t.dueAtLocal}`);
});

// 3. Refresh calendar view
// Trigger re-query or invalidate cache
```

---

## Community Integration

### Images Not Redacted

**Problem**: Original images appear in community post instead of redacted versions.

**Critical**: This is a privacy issue!

**Debug**:

```tsx
// Check redaction process
import { redactAssessmentForCommunity } from '@/lib/assessment/assessment-redaction';

const redacted = await redactAssessmentForCommunity(imageUri, plantContext);
console.log('Original:', imageUri);
console.log('Redacted:', redacted.redactedImageUri);
console.log('Filename:', redacted.anonymousFilename);

// Verify EXIF stripped
// Use exif-reader or similar to check
```

**Fix**:

- Ensure `generateCommunityPostPrefill()` is called before navigation
- Don't bypass redaction process
- Test with images containing EXIF data
- Verify anonymous filenames are used

---

### Post Creation Screen Not Receiving Data

**Problem**: Navigation works but post form is empty.

**Check Route Params**:

```tsx
// In post creation screen
const params = useLocalSearchParams();
console.log('All params:', params);
console.log('Source:', params.source);
console.log('Title:', params.prefillTitle);
console.log('Body:', params.prefillBody);
```

**Common Mistakes**:

1. Not checking `params.source === 'assessment'`
2. Not parsing JSON params
3. Using wrong param names

**Correct Implementation**:

```tsx
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
  const [title, setTitle] = useState(prefillData?.title ?? '');
  const [body, setBody] = useState(prefillData?.body ?? '');
  // etc.
}
```

---

## Performance Issues

### Slow Assessment History Loading

**Symptoms**:

- Long delay before history appears
- UI freezes during load
- Poor scroll performance

**Solutions**:

1. **Reduce Query Limit**:

```tsx
// Instead of loading all
<AssessmentHistoryList plantId={plantId} limit={50} />

// Load fewer initially
<AssessmentHistoryList plantId={plantId} limit={20} />
```

2. **Add Loading State**:

```tsx
// Component already handles this, but ensure it's visible
// Check that loading indicator is styled correctly
```

3. **Optimize Queries**:

```tsx
// Use indexes in WatermelonDB schema
// Ensure plant_id and created_at are indexed
```

---

### Task Creation Modal Slow to Open

**Problem**: Delay when opening task creation modal.

**Cause**: Generating task inputs synchronously.

**Solution**: Already optimized, but can add loading state:

```tsx
const [preparing, setPreparing] = useState(false);

const handleOpenModal = async () => {
  setPreparing(true);
  // Modal will handle task generation
  setShowModal(true);
  setPreparing(false);
};
```

---

## Data Sync

### Assessments Not Syncing to Server

**Problem**: Local assessments not appearing on other devices.

**Check Sync Status**:

```tsx
// Check outbox for pending syncs
import { database } from '@/lib/watermelon';
const outbox = await database.collections.get('outbox').query().fetch();
console.log('Pending syncs:', outbox.length);

// Check assessment sync status
const assessment = await database.collections
  .get('assessments')
  .find(assessmentId);
console.log('Server revision:', assessment.serverRevision);
console.log('Server updated:', assessment.serverUpdatedAtMs);
```

**Solutions**:

1. Trigger manual sync
2. Check network connectivity
3. Verify Supabase connection
4. Review sync logs

---

### Duplicate Assessments After Sync

**Problem**: Same assessment appears multiple times.

**Cause**: Sync conflict or duplicate creation.

**Prevention**:

- Use idempotency keys
- Check for existing assessment before creating
- Implement proper conflict resolution

---

## Debugging Tools

### Enable Verbose Logging

```tsx
// In development, enable detailed logs
if (__DEV__) {
  // Assessment queries
  const originalGetAssessments = getAssessmentsByPlantId;
  getAssessmentsByPlantId = async (...args) => {
    console.log('[Assessment Query]', args);
    const result = await originalGetAssessments(...args);
    console.log('[Assessment Result]', result.length, 'items');
    return result;
  };
}
```

### Inspect WatermelonDB

```tsx
// View all tables
import { database } from '@/lib/watermelon';

async function inspectDatabase() {
  const tables = ['assessments', 'tasks', 'series', 'outbox'];

  for (const table of tables) {
    const collection = database.collections.get(table);
    const records = await collection.query().fetch();
    console.log(`${table}: ${records.length} records`);
  }
}
```

### Test Integration Points

```tsx
// Test each integration point independently
async function testIntegration() {
  // 1. Test queries
  const assessments = await getAssessmentsByPlantId(plantId);
  console.log('✓ Queries working:', assessments.length);

  // 2. Test task creation
  const taskResult = await handleTaskCreation({...});
  console.log('✓ Task creation:', taskResult.success);

  // 3. Test prefill generation
  const prefill = await generateCommunityPostPrefill({...});
  console.log('✓ Prefill generated:', prefill.title);
}
```

---

## Getting Help

### Before Reporting Issues

1. Check this troubleshooting guide
2. Review [Integration Guide](./integration-guide.md)
3. Check [Test Implementation Notes](./test-implementation-notes.md)
4. Enable verbose logging and collect logs
5. Test on multiple devices if possible

### Information to Include

When reporting issues, include:

- Device model and OS version
- App version
- Steps to reproduce
- Console logs (with sensitive data removed)
- Screenshots if applicable
- Network status (online/offline)

### Known Limitations

1. **Community Post Screen**: Must be updated to accept prefill params (outside Task 12 scope)
2. **Plant Detail Screen**: No dedicated screen yet for history integration
3. **Playbook Application**: "Apply Adjustment" button is placeholder
4. **Test Type Errors**: Some integration tests have type mismatches (documented)

---

## Quick Reference

### Common Console Commands

```tsx
// Check assessment count
await getAssessmentCount(plantId)

// View recent assessments
await getAssessmentsByPlantId(plantId, 10)

// Test task creation
await handleTaskCreation({...})

// Check session
getAssessmentSession(assessmentId)

// Inspect database
await database.collections.get('assessments').query().fetch()
```

### Common Fixes

| Issue            | Quick Fix                             |
| ---------------- | ------------------------------------- |
| Empty history    | Verify plant_id matches               |
| No tasks created | Check action plan has taskTemplate    |
| Prefill missing  | Don't clear session before navigation |
| Slow loading     | Reduce query limit                    |
| Sync issues      | Check network and trigger manual sync |

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**Status**: Production Ready
