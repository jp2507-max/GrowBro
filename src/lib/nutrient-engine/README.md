# Nutrient Engine and pH/EC System

Core utility functions and type definitions for the GrowBro nutrient management system.

## Overview

This module provides the foundational utilities and types for managing feeding schedules, pH/EC measurements, and nutrient diagnostics in an offline-first architecture.

## Features

### Temperature Compensation

- **`toEC25(ecRaw, tempC, beta?)`**: Normalizes EC readings to 25°C reference temperature
- Uses linear compensation model with configurable beta factor (default 2%/°C)
- Automatically validates input ranges and prevents double-correction
- Supports temperature range: 5-40°C
- EC range: 0-10 mS/cm

### PPM Conversion

- **`ecToPpm(ecMsCm, scale)`**: Converts EC to PPM with scale support
- Two scales supported:
  - 500 scale (NaCl/TDS): 1.0 mS/cm = 500 ppm
  - 700 scale (442/KCl): 1.0 mS/cm = 700 ppm
- View-only conversion (EC@25°C is canonical storage unit)
- Always displays with explicit scale label: "1000 ppm [500]"

### Quality Assessment

- **`computeQualityFlags(reading, calibration?)`**: Derives quality flags from reading state
  - `NO_ATC`: Automatic temperature compensation not enabled
  - `CAL_STALE`: Meter calibration expired or invalid
  - `TEMP_HIGH`: Temperature ≥28°C
  - `OUTLIER`: Statistical anomaly (future implementation)

- **`calculateConfidenceScore(reading, calibration?)`**: Computes 0-1 confidence score
  - Stale calibration: -30% (×0.7)
  - High temperature: -20% (×0.8)
  - No ATC: -10% (×0.9)
  - Factors compound multiplicatively

### Display Formatting

- **`formatPpmWithScale(ppm, scale)`**: Formats PPM with scale label
- **`formatEcPpmDisplay(ecMsCm, scale, tempC)`**: Complete display string
  - Example: "2.0 mS/cm @25°C • 1000 ppm [500] • 22.4°C"

## Type System

### Domain Models

- **`FeedingTemplate`**: Complete feeding schedule for a growing medium
- **`FeedingPhase`**: Phase-specific nutrient ratios and target ranges
- **`PhEcReading`**: pH/EC measurement with temperature compensation
- **`Reservoir`**: Reservoir configuration with target ranges
- **`SourceWaterProfile`**: Baseline water quality parameters
- **`Calibration`**: Meter calibration record with validity tracking
- **`DeviationAlert`**: Out-of-range measurement alert
- **`DiagnosticResult`**: Nutrient issue classification with recommendations

### Enums (as const objects)

- **`PpmScale`**: `{ PPM_500: '500', PPM_700: '700' }`
- **`GrowingMedium`**: `{ SOIL, COCO, HYDRO, SOILLESS, PEAT }`
- **`PlantPhase`**: `{ SEEDLING, VEGETATIVE, FLOWERING, FLUSH }`
- **`AlertType`**: `{ PH_HIGH, PH_LOW, EC_HIGH, EC_LOW, CALIBRATION_STALE, TEMP_HIGH }`
- **`AlertSeverity`**: `{ INFO, WARNING, CRITICAL }`
- **`IssueType`**: `{ DEFICIENCY, TOXICITY, LOCKOUT, PH_DRIFT }`
- **`CalibrationType`**: `{ PH, EC }`
- **`ReservoirEventKind`**: `{ FILL, DILUTE, ADD_NUTRIENT, PH_UP, PH_DOWN, CHANGE }`

## Usage

```typescript
import {
  toEC25,
  ecToPpm,
  computeQualityFlags,
  calculateConfidenceScore,
  formatEcPpmDisplay,
  PpmScale,
  type PhEcReading,
  type Calibration,
} from '@/lib/nutrient-engine';

// Temperature compensation
const ec25c = toEC25(1.5, 20); // 1.64 mS/cm at 20°C → normalized to 25°C

// PPM conversion
const ppm = ecToPpm(2.0, PpmScale.PPM_500); // 1000 ppm

// Quality assessment
const flags = computeQualityFlags(reading, calibration);
const confidence = calculateConfidenceScore(reading, calibration);

// Display formatting
const display = formatEcPpmDisplay(2.0, PpmScale.PPM_500, 22.4);
// "2.0 mS/cm @25°C • 1000 ppm [500] • 22.4°C"
```

## Validation

All utility functions include comprehensive input validation:

- **EC range**: 0.00-10.00 mS/cm
- **pH range**: 0.00-14.00 (defined in requirements)
- **Temperature range**: 5.00-40.00°C
- **Beta coefficient**: 0.00-0.05 (0-5% per °C)

Invalid inputs throw descriptive errors with specific range information.

## Testing

Comprehensive unit tests cover:

- Temperature compensation accuracy across 15-30°C range
- ATC on/off paths (no double correction)
- PPM conversion with both scales
- Quality flag computation for all scenarios
- Confidence score calculation with multiple factors
- Edge cases and boundary conditions
- Input validation and error handling

Run tests:

```bash
pnpm test src/lib/nutrient-engine/utils/conversions.test.ts
```

## Design Principles

1. **EC@25°C is canonical**: All EC values stored normalized to 25°C
2. **PPM is view-only**: Never store PPM, always convert from EC for display
3. **Explicit scale labeling**: Always show "[500]" or "[700]" with PPM values
4. **Quality flags over stored confidence**: Compute confidence on-the-fly from flags
5. **Skip double correction**: When `atcOn=true`, meter already compensated
6. **Type safety**: Use type aliases and const objects with literal union types

## Requirements Satisfied

- **Req 2.2**: Store temp_c, atc_on, ec_raw, ec_25c with UI displaying both values
- **Req 2.7**: Label readings "low confidence" when calibration stale or temp ≥28°C
- **Req 1.6**: Target bands (not single points) for pH and EC@25°C
- **Req 3.1**: Type system supports rule-based classification with history and water profile

## Next Steps

- Task 3: Build WatermelonDB models and database layer
- Task 4: Implement sync worker and offline functionality
- Task 5: Create measurement tracking system with UI components
- Task 6: Build alert and deviation detection system
