TASK_ID: {12} with subtasks (make sure task with sub task is fully implemented)
AUTO_CONTINUE: auto # set to "auto" to let the agent implement changes after the plan

CONTEXT

- Feature: 5. privacy-consent-and-telemetry
- Task index: .kiro\specs\5. privacy-consent-and-telemetry\tasks.md
- Design spec: .kiro\specs\5. privacy-consent-and-telemetry\design.md
- Requirements spec: .kiro\specs\5. privacy-consent-and-telemetry\requirements.md

CONTRACT (outputs)

- Requirements (verbatim lines from requirements.md)
- Design summary (≤8 bullets)
- Traceable implementation plan mapping steps → requirement IDs → repo file paths
- Optional small commits + verification when AUTO_CONTINUE=auto

STRICT PROCEDURE

1. Read only Task {TASK_ID} in the tasks index.
2. Extract requirement IDs or inline bullets. If IDs, read ONLY those lines from `requirements.md`. If inline bullets, treat those bullets as the requirements.
3. If Task {TASK_ID} does NOT explicitly reference design sections, SEARCH the design spec for phrases matching the task title (e.g., "background sync", "image upload") and read any matching sections. The design file is mandatory context for implementation details.
4. Inspect the task file for implementation hints/file paths.
5. Consult external package docs when required.

OUTPUT FORMAT

- REQUIREMENTS (VERBATIM): one per line
- DESIGN SUMMARY (concise — up to 8 bullets): scope, must-haves, constraints, acceptance criteria, edge cases, risks. If more detail is required, add an 'Expanded design notes' subsection (unbounded) after the concise summary or place extra detail in the appendix.
- IMPLEMENTATION PLAN: step-by-step; for each step list requirement IDs satisfied and repo-relative files to modify/create

AUTO-CONTINUE

- If AUTO_CONTINUE=auto and no blocking questions, implement the plan. Create commits and run typecheck/lint/tests. If failures occur, attempt up to 2 quick fixes and then report a blocker.

VERIFICATION (local)

- pnpm -s tsc --noEmit
- pnpm -s lint
- pnpm -s test

GUARDRAILS (must follow)

- TypeScript + Expo Router + Nativewind + React Query + Zustand
- Use @/\* imports and kebab-case filenames
- Keep UI components <80 LOC
- Ask only ONE short blocking question when essential
- Do not invent repo paths, public APIs, or dependency version
