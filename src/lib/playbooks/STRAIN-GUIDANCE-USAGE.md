# Strain-Specific Guidance System

## Overview

The strain-specific guidance system customizes playbook schedules based on strain characteristics including:

- **Strain Type**: Autoflower vs Photoperiod
- **Breeder Flowering Range**: Precise flowering time from breeder data
- **Strain Lean**: Sativa, Indica, or Balanced

All guidance is **educational and non-commercial**, compliant with app store policies.

## Features

### 1. Customized Phase Durations

The system calculates phase durations based on strain characteristics:

```typescript
import { calculatePhaseDurations } from '@/lib/playbooks';

const strainCharacteristics = {
  strain_type: 'autoflower',
  breeder_flowering_range: {
    min_weeks: 8,
    max_weeks: 10,
    source: 'FastBuds',
  },
  strain_lean: 'sativa',
};

const phaseDurations = calculatePhaseDurations(strainCharacteristics);
// Returns:
// {
//   seedling: 7,
//   veg: 21,
//   flower: 63, // Average of 8-10 weeks
//   harvest: 14,
//   assumptions: {
//     usedDefaults: false,
//     message: 'Using FastBuds flowering range (8-10 weeks)'
//   }
// }
```

### 2. Conservative Defaults

When strain data is missing, the system uses conservative defaults:

```typescript
// No strain data provided
const phaseDurations = calculatePhaseDurations();
// Returns photoperiod defaults with assumptions flag

// Partial strain data
const phaseDurations = calculatePhaseDurations({
  strain_type: 'autoflower',
  // No breeder_flowering_range
});
// Returns autoflower defaults with assumptions flag
```

### 3. Strain-Specific Tips

Educational tips are added to task descriptions based on strain characteristics:

```typescript
import { getStrainSpecificTips } from '@/lib/playbooks';

const tips = getStrainSpecificTips(strainCharacteristics);
// Returns array of tips like:
// [
//   {
//     phase: 'seedling',
//     taskType: 'water',
//     tip: 'Autoflowers are sensitive to overwatering...',
//     isEducational: true
//   },
//   ...
// ]
```

### 4. Playbook Customization

Automatically customize entire playbooks:

```typescript
import { customizePlaybookForStrain } from '@/lib/playbooks';

const customizedPlaybook = customizePlaybookForStrain(
  basePlaybook,
  strainCharacteristics
);
// Returns playbook with:
// - Strain-specific tips added to task descriptions
// - Updated metadata with estimated duration
// - Strain type information
```

### 5. React Hook Integration

Use the hook for easy integration in React components:

```typescript
import { useStrainGuidance } from '@/lib/playbooks';

function PlaybookPreview({ playbook, strain }) {
  const { customizedPlaybook, phaseDurations, assumptionsChip, hasStrainData } =
    useStrainGuidance({
      playbook,
      strainCharacteristics: strain?.grow,
    });

  return (
    <View>
      {assumptionsChip.show && (
        <AssumptionsChip assumptions={phaseDurations.assumptions} />
      )}
      <Text>Estimated Duration: {customizedPlaybook.metadata.estimatedDuration} weeks</Text>
      {/* Render customized playbook */}
    </View>
  );
}
```

## UI Components

### AssumptionsChip

Displays when conservative defaults are used:

```typescript
import { AssumptionsChip } from '@/components/playbooks';

<AssumptionsChip
  assumptions={phaseDurations.assumptions}
  onPress={() => showAssumptionsModal()}
/>
```

### StrainTipBadge

Displays strain-specific tips within task descriptions:

```typescript
import { StrainTipBadge, extractStrainTip } from '@/components/playbooks';

const { mainDescription, strainTip } = extractStrainTip(task.description);

<View>
  <Text>{mainDescription}</Text>
  {strainTip && <StrainTipBadge tip={strainTip} />}
</View>
```

## Compliance

### Educational Content

All tips are educational and avoid:

- Product recommendations
- Commercial links
- Consumption encouragement
- Medical claims

### Disclaimer

Always display the disclaimer when showing strain guidance:

```typescript
import { STRAIN_GUIDANCE_DISCLAIMER } from '@/lib/playbooks';

<Text className="text-xs text-neutral-600">
  {STRAIN_GUIDANCE_DISCLAIMER}
</Text>
```

## Examples

### Example 1: Autoflower with Breeder Data

```typescript
const strain = {
  name: 'Northern Lights Auto',
  grow: {
    strain_type: 'autoflower',
    breeder_flowering_range: {
      min_weeks: 8,
      max_weeks: 9,
      source: 'Royal Queen Seeds',
    },
    strain_lean: 'indica',
  },
};

const phaseDurations = calculatePhaseDurations(strain.grow);
// Uses breeder data: 8.5 weeks average = 59.5 days ≈ 60 days flowering
// assumptions.usedDefaults = false
```

### Example 2: Photoperiod without Breeder Data

```typescript
const strain = {
  name: 'Blue Dream',
  grow: {
    strain_type: 'photoperiod',
    strain_lean: 'sativa',
    // No breeder_flowering_range
  },
};

const phaseDurations = calculatePhaseDurations(strain.grow);
// Uses photoperiod defaults: 56 days flowering
// assumptions.usedDefaults = true
// assumptions.message = 'Using conservative photoperiod defaults...'
```

### Example 3: No Strain Data

```typescript
const phaseDurations = calculatePhaseDurations();
// Uses photoperiod defaults
// assumptions.usedDefaults = true
// assumptions.assumedStrainType = 'photoperiod'
```

## Testing

Run tests with:

```bash
pnpm test strain-guidance
```

All tests verify:

- Correct phase duration calculations
- Proper default handling
- Educational tip generation
- Playbook customization
- Compliance (no commercial content)

## Analytics

Track strain guidance usage:

```typescript
analytics.track('playbook_customized_for_strain', {
  strain_type: strainCharacteristics.strain_type,
  has_breeder_data: Boolean(strainCharacteristics.breeder_flowering_range),
  used_defaults: phaseDurations.assumptions.usedDefaults,
});
```

## Future Enhancements

Potential improvements:

- User feedback on tip helpfulness
- Community-contributed strain-specific tips
- Integration with strain database for automatic data
- Machine learning for tip relevance
- Regional growing condition adjustments
