# Device Test Matrix - AI Photo Diagnosis

**Version**: 1.0  
**Last Updated**: October 26, 2025  
**Task**: 12.2 - Device Testing

---

## Test Devices

### Target Devices (Required)

| Device              | OS          | Screen    | RAM | Notes                       |
| ------------------- | ----------- | --------- | --- | --------------------------- |
| Google Pixel 6a     | Android 13+ | 6.1" FHD+ | 6GB | Primary Android test device |
| Samsung Galaxy A54  | Android 13+ | 6.4" FHD+ | 8GB | Mid-range Android           |
| iPhone 12           | iOS 16+     | 6.1"      | 4GB | Primary iOS test device     |
| iPhone SE (3rd gen) | iOS 16+     | 4.7"      | 4GB | Small screen iOS            |

### Optional Devices (Nice to Have)

| Device             | OS          | Purpose                      |
| ------------------ | ----------- | ---------------------------- |
| OnePlus 9          | Android 12+ | Alternative Android flagship |
| iPhone 13 Pro      | iOS 16+     | High-end iOS                 |
| Samsung Galaxy S21 | Android 12+ | Alternative Samsung          |

---

## Test Scenarios

### 1. Assessment History Display

**Test**: Plant profile assessment history integration

**Steps**:

1. Navigate to plant profile screen
2. Locate assessment history section
3. Tap to expand history
4. Verify assessments display correctly
5. Tap individual assessment card
6. Verify navigation to result screen

**Expected Results**:

- ✅ History section visible with count badge
- ✅ Assessments sorted newest first
- ✅ Status indicators correct (Resolved/Pending/Failed)
- ✅ Device/Cloud mode displayed
- ✅ Confidence percentages accurate
- ✅ Relative time display (e.g., "2 hours ago")
- ✅ Smooth scrolling with FlashList
- ✅ Empty state when no assessments

**Performance Targets**:

- Initial load: <500ms
- Scroll FPS: >55fps
- Memory usage: <50MB increase

**Test Matrix**:

| Device     | Load Time | Scroll FPS | Memory | Pass/Fail |
| ---------- | --------- | ---------- | ------ | --------- |
| Pixel 6a   |           |            |        |           |
| Galaxy A54 |           |            |        |           |
| iPhone 12  |           |            |        |           |
| iPhone SE  |           |            |        |           |

---

### 2. Task Creation Flow

**Test**: Create tasks from assessment action plan

**Steps**:

1. Complete assessment with action plan
2. View result screen
3. Tap "Create Tasks" button
4. Verify modal opens with task preview
5. Review task list
6. Tap "Create Tasks" confirm
7. Wait for completion
8. Verify success message
9. Navigate to calendar
10. Verify tasks appear

**Expected Results**:

- ✅ Modal opens smoothly (<200ms)
- ✅ Task count displayed correctly
- ✅ Task preview list readable
- ✅ Loading state during creation
- ✅ Success/failure feedback clear
- ✅ Tasks appear in calendar immediately
- ✅ Task metadata includes assessment ID
- ✅ Due dates calculated correctly

**Performance Targets**:

- Modal open: <200ms
- Task creation (3 tasks): <1s
- Task creation (10 tasks): <3s

**Test Matrix**:

| Device     | Modal Open | 3 Tasks | 10 Tasks | Pass/Fail |
| ---------- | ---------- | ------- | -------- | --------- |
| Pixel 6a   |            |         |          |           |
| Galaxy A54 |            |         |          |           |
| iPhone 12  |            |         |          |           |
| iPhone SE  |            |         |          |           |

**Edge Cases**:

- [ ] Action plan with 0 tasks
- [ ] Action plan with 20+ tasks
- [ ] Partial failure (some tasks fail)
- [ ] Complete failure (all tasks fail)
- [ ] Network offline during creation

---

### 3. Community Post Prefill

**Test**: Navigate to community post with prefilled data

**Steps**:

1. Complete low-confidence assessment
2. Verify "Ask Community" button visible
3. Tap "Ask Community"
4. Wait for prefill generation
5. Verify navigation to post creation
6. Check title prefilled
7. Check body prefilled
8. Check tags attached
9. Verify images attached (redacted)
10. Submit post (optional)

**Expected Results**:

- ✅ Button visible for low confidence (<70%)
- ✅ Loading state during prefill generation
- ✅ Navigation successful
- ✅ Title matches expected format
- ✅ Body includes assessment context
- ✅ Tags include "ai-assessment"
- ✅ Images redacted (no EXIF data)
- ✅ Filenames randomized
- ✅ Post submits successfully

**Performance Targets**:

- Prefill generation (3 images): <2s
- Image redaction per image: <500ms
- Navigation: <300ms

**Test Matrix**:

| Device     | Prefill Time | Redaction | Navigation | Pass/Fail |
| ---------- | ------------ | --------- | ---------- | --------- |
| Pixel 6a   |              |           |            |           |
| Galaxy A54 |              |           |            |           |
| iPhone 12  |              |           |            |           |
| iPhone SE  |              |           |            |           |

**Privacy Verification**:

- [ ] EXIF data stripped from all images
- [ ] GPS coordinates removed
- [ ] Device info removed
- [ ] Timestamp randomized
- [ ] Filenames non-linkable

---

### 4. Playbook Adjustment Display

**Test**: Display playbook adjustment suggestions

**Steps**:

1. Complete assessment with adjustments
2. View result screen
3. Scroll to playbook adjustments section
4. Tap to expand
5. Review adjustment cards
6. Verify impact indicators
7. Check affected phases

**Expected Results**:

- ✅ Section visible when adjustments exist
- ✅ Collapsible behavior smooth
- ✅ Adjustment count accurate
- ✅ Impact colors correct
- ✅ Descriptions readable
- ✅ Reasons clear
- ✅ Timing deltas displayed

**Test Matrix**:

| Device     | Display | Expand | Readability | Pass/Fail |
| ---------- | ------- | ------ | ----------- | --------- |
| Pixel 6a   |         |        |             |           |
| Galaxy A54 |         |        |             |           |
| iPhone 12  |         |        |             |           |
| iPhone SE  |         |        |             |           |

---

### 5. Result Action Panel

**Test**: Unified action buttons on result screen

**Steps**:

1. Complete assessment
2. View result screen
3. Verify all action buttons visible
4. Test "Create Tasks" button
5. Test "Ask Community" button
6. Test "View History" button
7. Test "Retake" button

**Expected Results**:

- ✅ All buttons visible and accessible
- ✅ Primary actions prominent
- ✅ Secondary actions appropriately styled
- ✅ Touch targets ≥44pt
- ✅ Loading states work
- ✅ Disabled states clear
- ✅ Navigation correct for each action

**Test Matrix**:

| Device     | Layout | Touch Targets | Navigation | Pass/Fail |
| ---------- | ------ | ------------- | ---------- | --------- |
| Pixel 6a   |        |               |            |           |
| Galaxy A54 |        |               |            |           |
| iPhone 12  |        |               |            |           |
| iPhone SE  |        |               |            |           |

---

## Performance Benchmarks

### Assessment History Loading

**Target**: p95 latency <500ms for 50 assessments

| Device     | 10 Items | 50 Items | 100 Items | Pass/Fail |
| ---------- | -------- | -------- | --------- | --------- |
| Pixel 6a   |          |          |           |           |
| Galaxy A54 |          |          |           |           |
| iPhone 12  |          |          |           |           |
| iPhone SE  |          |          |           |           |

### Task Creation Performance

**Target**: p95 latency <1s for 5 tasks, <3s for 10 tasks

| Device     | 1 Task | 5 Tasks | 10 Tasks | 20 Tasks | Pass/Fail |
| ---------- | ------ | ------- | -------- | -------- | --------- |
| Pixel 6a   |        |         |          |          |           |
| Galaxy A54 |        |         |          |          |           |
| iPhone 12  |        |         |          |          |           |
| iPhone SE  |        |         |          |          |           |

### Community Prefill Generation

**Target**: p95 latency <2s for 3 images

| Device     | 1 Image | 3 Images | Pass/Fail |
| ---------- | ------- | -------- | --------- |
| Pixel 6a   |         |          |           |
| Galaxy A54 |         |          |           |
| iPhone 12  |         |          |           |
| iPhone SE  |         |          |           |

---

## Memory Usage

**Target**: <100MB increase during integration flows

| Device     | Baseline | History View | Task Creation | Post Prefill | Pass/Fail |
| ---------- | -------- | ------------ | ------------- | ------------ | --------- |
| Pixel 6a   |          |              |               |              |           |
| Galaxy A54 |          |              |               |              |           |
| iPhone 12  |          |              |               |              |           |
| iPhone SE  |          |              |               |              |           |

---

## Battery Impact

**Test Duration**: 30 minutes of continuous use

**Target**: <5% battery drain per 30 minutes

| Device     | Baseline | With Integration | Delta | Pass/Fail |
| ---------- | -------- | ---------------- | ----- | --------- |
| Pixel 6a   |          |                  |       |           |
| Galaxy A54 |          |                  |       |           |
| iPhone 12  |          |                  |       |           |
| iPhone SE  |          |                  |       |           |

---

## Network Conditions

### Offline Behavior

**Test**: All features work offline

- [ ] Assessment history loads from local DB
- [ ] Task creation works offline
- [ ] Tasks sync when online
- [ ] Offline indicator shown
- [ ] Queue status visible

### Slow Network (3G)

**Test**: Features remain responsive on slow network

- [ ] History loads within 2s
- [ ] Task creation <3s
- [ ] Prefill generation <5s
- [ ] Timeout handling works
- [ ] Retry logic functional

### Network Switching

**Test**: Handle network state changes gracefully

- [ ] Online → Offline transition smooth
- [ ] Offline → Online triggers sync
- [ ] No data loss during switch
- [ ] User feedback clear

---

## Screen Sizes

### Small Screens (iPhone SE 4.7")

- [ ] All content visible without horizontal scroll
- [ ] Touch targets adequate
- [ ] Text readable
- [ ] Modals fit screen
- [ ] No content cutoff

### Large Screens (Galaxy A54 6.4")

- [ ] Layout scales appropriately
- [ ] No excessive whitespace
- [ ] Content well-distributed
- [ ] Images scale correctly

---

## Dark Mode

**Test**: All components support dark mode

- [ ] Assessment history cards
- [ ] Task creation modal
- [ ] Playbook adjustment cards
- [ ] Action panel buttons
- [ ] Text contrast adequate (WCAG AA)
- [ ] Colors appropriate for dark theme

---

## Orientation Changes

**Test**: Handle rotation gracefully

- [ ] Portrait → Landscape smooth
- [ ] Landscape → Portrait smooth
- [ ] No data loss
- [ ] Layout adjusts correctly
- [ ] Modals reposition

---

## Real-World Scenarios

### Scenario 1: New User Flow

1. Install app
2. Create first plant
3. Complete first assessment
4. View history (empty → 1 item)
5. Create tasks from assessment
6. View calendar with new tasks

**Expected**: Smooth onboarding, clear guidance

### Scenario 2: Power User Flow

1. User with 10 plants
2. 50+ assessments total
3. View history for specific plant
4. Create tasks for multiple assessments
5. Navigate between plants
6. Check calendar with 100+ tasks

**Expected**: No performance degradation

### Scenario 3: Offline User

1. Complete assessment offline
2. Create tasks offline
3. View history offline
4. Go online
5. Verify sync completes
6. Check data consistency

**Expected**: Seamless offline/online transition

---

## Issue Tracking

### Critical Issues (Blockers)

| Issue | Device | Description | Status |
| ----- | ------ | ----------- | ------ |
|       |        |             |        |

### High Priority Issues

| Issue | Device | Description | Status |
| ----- | ------ | ----------- | ------ |
|       |        |             |        |

### Medium Priority Issues

| Issue | Device | Description | Status |
| ----- | ------ | ----------- | ------ |
|       |        |             |        |

### Low Priority Issues (Nice to Have)

| Issue | Device | Description | Status |
| ----- | ------ | ----------- | ------ |
|       |        |             |        |

---

## Sign-Off

### Test Completion

- [ ] All target devices tested
- [ ] All scenarios passed
- [ ] Performance targets met
- [ ] Memory usage acceptable
- [ ] Battery impact minimal
- [ ] Network conditions handled
- [ ] Dark mode verified
- [ ] Real-world scenarios validated

### Tester Sign-Off

**Tester Name**: ******\_\_\_******  
**Date**: ******\_\_\_******  
**Signature**: ******\_\_\_******

**Notes**:

---

---

---

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**Status**: Ready for Testing
