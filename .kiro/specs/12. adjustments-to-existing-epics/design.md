# Adjustments to Existing Epics — Design

This spec consolidates cross-epic adjustments derived from market analysis. It amends the following existing specs without duplicating their core scope:

- 1. calendar-2.0
- 4. harvest-workflow
- 5. community-feed-improvements
- 6. ai-photo-diagnosis
- 7. guided-grow-playbooks
- 9. android-store-compliance
- 10. ios-store-compliance
- 11. release-pipeline-eas

Principles

- Educational Focus: All cannabis-related content remains educational and non-commercial.
- Privacy-First: Purpose-specific consent, data minimization, and retention defaults.
- Offline-First: Adjustments integrate with existing offline/sync architecture.
- Performance & Quality: 60 FPS budgets, no blank cells, and release health gates.

Design Changes by Epic

1. Calendar 2.0

- Add event types: Feeding, Flush, Top-Dress.
- Associate medium/phase targets with each plant (Soil/Coco/Hydro): pH target range, EC target range.
- Surface deviation badges on agenda items when latest pH/EC logs are out of range.

2. Harvest Workflow

- Add curing quality checklist (aroma, stem snap, jar humidity) before inventory booking.
- Atomic handoff: finalize curing → create/update inventory record with audit note and server timestamp.

3. Community Feed Improvements (DSA)

- Notice-and-Action: user reports enter a moderation inbox with decisions and appeal flow.
- Transparency Log: periodically publish aggregate counts (reports, acted, turnaround). No PII.
- Age gating & geo-visibility: restrict UGC surfaces where required, backed by policy config.

4. AI Photo Diagnosis (On-device-first)

- Add explicit post-training quantization step (e.g., INT8) in model lifecycle.
- State target latency: p95 < 300 ms on mid-range Android for device inference.
- Decision policy: prefer device; cloud only on OOM/timeout/low-quality; show policy in UI.
- Confidence & taxonomy UI: show calibrated confidence and class taxonomy tooltips.

5. Guided Grow Playbooks

- Medium/phase-specific nutrient corrections and pH guides included in templates.
- Gate corrective steps behind measurement preconditions (recent pH/EC, light checks).

6. Android Store Compliance

- Enforce explicit “no sale facilitation” scanning across strings and store copy.
- Age-gate enforced app-wide before cannabis content.

7. iOS Store Compliance

- Add geo-fence configuration for restricted regions prior to submission.
- Ensure age rating 18+ aligns with in-app age gate; add compliance lint.

8. Release Pipeline (EAS)

- Sentry release health as a hard gate: block if crash-free sessions fall below target.
- CI must verify sourcemap upload; fail builds on missing/failed uploads.
- Add synthetic flows (Maestro) for Offline Sync, AI Assessment, and Data Export.

Non-Goals

- Full nutrient engine implementation (see separate epic).
- Inventory and consumables system (separate epic).
