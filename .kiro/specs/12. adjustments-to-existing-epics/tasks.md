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

  - Add checklist gating; finalize-curing→create/update inventory in one DB transaction
  - DB isolation: SERIALIZABLE (or minimum REPEATABLE READ) for inventory handoff transaction
  - Idempotency: unique constraint on handoff_id (or composite external_handoff_id + target_inventory_id)
  - API must accept/persist idempotency key to prevent double-creation
  - Retry policy: idempotent retries only, exponential backoff (max 3 attempts), safe retry on transient errors
  - Audit schema: performed_by, performed_at, operation_id/idempotency_key, operation_type, status/result, before_snapshot, after_snapshot, error_message
  - Tests: gating enforcement, audit record creation/verification, full transaction rollback on failure

- [ ] A4. Community: DSA Notice-and-Action + appeals

  - Report→inbox processing→decision→appeal; role checks via JWT claims
  - SLA: initial review within 24h, final decision within 72h, appeal window 7 days
  - Log retention: 7 years, anonymize PII after 30 days, auto-delete after retention expiry
  - Role mappings: 'mod_role'=['admin','moderator'] → RLS: `auth.jwt()->>'mod_role' IN ('admin','moderator')`
  - Tests: flows, RLS, appeal time windows, SLA assertions, retention cleanup

- [ ] A5. Community: Transparency Log (aggregated)

  - Periodic job emits aggregate-only outputs with anti-re-identification safeguards
  - Privacy controls: minimum-count suppression (threshold: N=5) and binning (0, 1-5, 6-20, 21-100, 100+)
  - Suppression applied at source: counts < 5 suppressed before emitting; never returns raw logs or PII
  - SLA: daily aggregation within 24h of previous day, publish within 48h
  - Log retention: 2 years, aggregate-only with privacy controls, auto-delete after retention expiry
  - Role mappings: 'transparency_role'=['viewer','admin'] → RLS: `auth.jwt()->>'transparency_role' IN ('viewer','admin')`
  - Tests: aggregation correctness, privacy filtering, suppression/binning edge cases, SLA timing, retention cleanup

- [ ] A6. Community: age gate & geo-visibility enforcement

  - Gate UGC behind 18+ and region flags; config-driven
  - Age source: OS parental controls or verified DOB; deny if unknown
  - Geo source: server-side IP + device region; if mismatch → most restrictive
  - Evasion: cache TTL 1h; re-check on app start; block when VPN detected (config flag)
  - Appeals for false positives; audit trail
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

- a11y: WCAG 2.2 AA; min touch target 44x44pt; contrast ≥ 4.5:1
- Perf: lists p95 < 16ms/frame on mid-tier device; cold start < 1200ms
- Privacy: all telemetry/AI/cloud calls behind consent gate; revoke → hard stop + data deletion request flow
- CI: lighthouse/a11y/perf checks must pass budgets; fail pipeline on regressions
