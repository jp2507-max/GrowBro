# Requirements — Adjustments to Existing Epics

R1 Calendar Nutrient Events and Targets

- R1.1 Add event types: Feeding, Flush, Top-Dress.
- R1.2 Display medium/phase pH/EC targets in task detail and creation flows.
- R1.3 Show deviation badges when latest pH/EC logs are out of range.

R2 Harvest → Inventory Handoff

- R2.1 Add curing quality checklist gates before inventory booking.
- R2.2 Perform atomic finalize-curing→inventory creation with audit note and server timestamp.

R3 Community DSA Enhancements

- R3.1 Implement Notice-and-Action: report → moderation inbox → decision → appeal.
- R3.2 Publish Transparency Log (aggregated, privacy-safe) with periodic cadence.
- R3.3 Enforce age gating and geo-visibility for UGC according to policy.

R4 AI On-Device & UI

- R4.1 Post-training quantization step in model pipeline (e.g., INT8 QAT/PTQ).
- R4.2 Device inference p95 < 300 ms on mid-range Android; log delegate and latency.
- R4.3 Decision policy UI: device-first; cloud fallback on OOM/timeout/quality.
- R4.4 Display calibrated confidence and class taxonomy with localized tooltips.

R5 Playbooks Nutrient & pH Corrections

- R5.1 Include medium/phase-specific pH guides and nutrient corrections.
- R5.2 Add measurement preconditions to corrective steps (recent pH/EC, light checks).

R6 Android Store Policy Guardrails

- R6.1 Block “sale facilitation” language in app/store copy; CI check.
- R6.2 Enforce global age gate before cannabis content.

R7 iOS Store Guardrails

- R7.1 Add geo-fence configuration for restricted regions.
- R7.2 Ensure 18+ rating aligned with in-app age gate; CI lint.

R8 Release Health & Synthetic Tests

- R8.1 Fail pipeline if sourcemaps are missing or upload fails.
- R8.2 Add Sentry release health thresholds; block if below crash-free target.
- R8.3 Add synthetic flows (Maestro): Offline Sync, AI Assessment, Data Export in CI.

Localization & Accessibility

- All new UI copy localized (EN/DE). Maintain 44pt/48dp touch targets and roles/labels.

Telemetry & Privacy

- No PII in transparency logs. Respect consent settings for telemetry.
