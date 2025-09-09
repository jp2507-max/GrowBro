# Implementation Plan — Adjustments to Existing Epics

Note: Each task amends an existing epic; update corresponding spec folders to reference these adjustments.

- [ ] A1. Calendar: Feeding/Flush/Top-Dress events

  - Add new event types and icons; extend create/edit task flows
  - Show pH/EC targets per plant medium/phase; deviation badge when last log out-of-range
  - Tests: creation/edit, agenda rendering, deviation badges

- [ ] A2. Calendar: pH/EC targets surfacing

  - Inject target ranges in detail sheet; add quick link to logging screen
  - Tests: target display, i18n, a11y

- [ ] A3. Harvest: curing quality checklist & atomic inventory handoff

  - Add checklist gating; finalize-curing→create/update inventory in one TX with audit
  - Tests: gating, audit note, transaction rollback

- [ ] A4. Community: DSA Notice-and-Action + appeals

  - Report→inbox processing→decision→appeal; role checks via JWT claims
  - SLA: initial review within 24h, final decision within 72h, appeal window 7 days
  - Log retention: 7 years, anonymize PII after 30 days, auto-delete after retention expiry
  - Role mappings: 'mod_role'=['admin','moderator'] → RLS: `auth.jwt()->>'mod_role' IN ('admin','moderator')`
  - Tests: flows, RLS, appeal time windows, SLA assertions, retention cleanup

- [ ] A5. Community: Transparency Log (aggregated)

  - Periodic job emits counts (reports, actions, turnaround); no PII
  - SLA: daily aggregation within 24h of previous day, publish within 48h
  - Log retention: 2 years, aggregate-only (no raw logs), auto-delete after retention expiry
  - Role mappings: 'transparency_role'=['viewer','admin'] → RLS: `auth.jwt()->>'transparency_role' IN ('viewer','admin')`
  - Tests: aggregation correctness, privacy filtering, SLA timing, retention cleanup

- [ ] A6. Community: age gate & geo-visibility enforcement

  - Gate UGC behind 18+ and region flags; config-driven
  - Tests: gating toggles, region overrides

- [ ] A7. AI: quantization + latency budget

  - Add PTQ/QAT step to model pipeline; enforce device p95 < 300 ms budget
  - Tests: telemetry asserts latency ceilings; model load/quantization checks

- [ ] A8. AI: device-first decision policy UI

  - Expose “device vs cloud” rationale in results; fallback on OOM/timeout/quality
  - Tests: policy branches, UI copy (EN/DE)

- [ ] A9. AI: calibrated confidence + taxonomy UI

  - Display calibrated confidence with tooltips; link to taxonomy info
  - Tests: calibration display, a11y, i18n

- [ ] A10. Playbooks: nutrient corrections & pH guides

  - Insert medium/phase-specific corrections and guides; add preconditions (recent pH/EC)
  - Tests: template validation, precondition gating

- [ ] A11. Android compliance: no-sale-facilitation checks

  - CI rule scanning strings and store copy for sale/commerce language
  - Tests: fixtures for violation detection

- [ ] A12. iOS compliance: geo-fence + 18+ lint

  - Pre-submit geo fence config check; ensure store rating 18+ matches in-app gate
  - Tests: config validator, rating lint

- [ ] A13. Release pipeline: Sentry gates

  - Block release if crash-free users < 98% OR crash-free sessions < 99.5% OR ANR rate > 1%
  - Auto-pause mechanism: POST /api/releases/{id}/pause with scope releases:write or org-admin role
  - On-call owner: Release Engineering team (mobile-oncall rotation)
  - Fail builds on missing/failed sourcemaps; enforce crash-free threshold
  - Tests: pipeline unit tests; dry-run sourcemap failure; threshold validation

- [ ] A14. Release pipeline: synthetic flows (Maestro)
  - Add CI jobs running Offline Sync, AI Assessment, Data Export flows
  - Tests: CI green on flows; artifacts uploaded for review

Cross-cutting

- i18n (EN/DE), a11y (44pt/48dp), performance budgets (60 FPS lists), privacy consent honoring.
