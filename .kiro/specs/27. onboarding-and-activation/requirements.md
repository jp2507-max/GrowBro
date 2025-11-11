# Onboarding & Activation — Requirements

Applies to: first-run experience, pre-permission primers, and early-life guidance to reach first value fast.

Product rules alignment

- Privacy-First: pre-permission primers; no SDK initialization before consent; clear opt-outs
- Offline-First: works without network; defers cloud sync; queues actions
- Educational Focus: show safe, instructional content; no commerce
- Accessibility: WCAG-informed labels, touch targets, readable empty states

Success metrics (define in analytics taxonomy)

- Activation: user completes any 2 of 3 core actions on day 0
  - Creates first calendar item OR adopts a playbook template
  - Views a strains detail OR bookmarks a favorite
  - Captures or selects a plant photo for AI diagnosis
- Time-to-First-Value: ≤ 2 minutes median from first launch to first core action
- Early retention leading: 1-day return ≥ 45%

Operational requirements

- No blocking network calls during onboarding; everything (copy, steps, sample content) loads from local bundle
- All strings localized (EN/DE)
- Telemetry gated behind consent; noop if disabled
- Deep links supported for support/legal screens
