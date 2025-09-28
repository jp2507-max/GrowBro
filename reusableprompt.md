TASK_ID: {3.1} with subtasks (make sure task with sub task is fully implemented)
AUTO_CONTINUE: auto # set to "auto" to let the agent implement changes after the plan

CONTEXT

- Feature: 10. ui-refinement-visual-qa
- Task index: .kiro\specs\10. ui-refinement-visual-qa\tasks.md
- Design spec: .kiro\specs\10. ui-refinement-visual-qa\design.md
- Requirements spec: .kiro\specs\10. ui-refinement-visual-qa\requirements.md

CONTRACT (outputs)

- Requirements (verbatim lines from requirements.md)
- Design summary: Executive summary (≤8 bullets) + Expanded design notes when large/complex
- Traceable implementation plan mapping steps → requirement IDs → repo file paths
- Optional small commits + verification when AUTO_CONTINUE=auto

STRICT PROCEDURE

1. Read only Task {TASK_ID} in the tasks index.
2. Extract requirement IDs or inline bullets. If IDs, read ONLY those lines from `requirements.md`. If inline bullets, treat those bullets as the requirements.
3. If Task {TASK_ID} does NOT explicitly reference design sections, SEARCH the design spec for phrases matching the task title (e.g., "background sync", "image upload") and read any matching sections. The design file is mandatory context for implementation details. When the design is long (≈200+ lines), has multiple subsystems, or contains non‑trivial code/config blocks, prepare both an Executive summary and an Expanded design notes section (see Output Format) so no critical implementation detail is lost to a hard bullet cap but dont present it to me, its just for you.
4. Inspect the task file for implementation hints/file paths.
5. Consult external package docs when required.

OUTPUT FORMAT

- REQUIREMENTS (VERBATIM): one per line
- DESIGN SUMMARY
  - Executive summary (≤8 bullets): scope, must-haves, constraints, acceptance criteria, edge cases, risks.
  - Expanded design notes (REQUIRED when the design file > ~200 lines, covers 3+ subsystems, or includes code/config blocks): structured bullets grouped by component (e.g., Build, Runtime/Permissions, Documentation/Data Safety, Moderation/UGC, Deletion, App Access/Review, Policy/Compliance). Include key APIs, interfaces/types, data models, control flows, constraints, acceptance criteria, edge cases, known risks, and test strategy. Add lightweight citations like [design.md#Section Title] or [design.md line ~123] where practical.
  - API/Model digest (IF PRESENT): list interfaces/functions/types with 1‑line contracts (inputs/outputs, side‑effects).
  - Appendix (OPTIONAL): short quoted snippets for tricky algorithms/config with file/section references.
- Summarization scaling rules
  - Do not drop critical implementation logic to satisfy bullet limits. Use grouping instead of truncation.
  - If the design mentions N distinct components (N≥3), allow up to 2 bullets per component in the Expanded notes.
  - Prefer hierarchical bullets to keep the Executive summary concise while preserving detail below.
- IMPLEMENTATION PLAN: step-by-step; for each step list requirement IDs satisfied and repo-relative files to modify/create

AUTO-CONTINUE

- When AUTO_CONTINUE=auto and no blocking questions exist, execute the plan and continue through commits, typecheck/lint/tests; on failures attempt up to two quick fixes then report a blocker.

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
