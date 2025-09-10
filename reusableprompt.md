TASK_ID: {15}

CONTEXT

- Feature: offline-first-sync
- Tasks index: C:\Users\Peter\GrowBro\.kiro\specs\2. offline-first-sync\tasks.md
- Design spec: C:\Users\Peter\GrowBro\.kiro\specs\2. offline-first-sync\design.md
- Requirements spec: C:\Users\Peter\GrowBro\.kiro\specs\2. offline-first-sync\requirements.md

READ FIRST — STRICT, STEPWISE

1. Open the tasks index and read ONLY the section for Task {TASK_ID}.
2. From that task's "Requirements:" line extract either:
   - a list of requirement IDs (e.g. 1.5, 6.7) — then read ONLY those numbered items from the requirements document; OR
   - an inlined bullet list — then treat those bullets (and only those bullets) as the requirements.
3. Open the design spec and read ONLY the section(s) explicitly referenced by Task {TASK_ID} (or the task title). If the task's design mapping is ambiguous, ask exactly one short blocking question and stop.
4. Inspect the task file for any implementation hints or file paths.
5. If an external package is required (reanimated, watermelondb, rrule, etc.), consult that package's official docs for exact API usage.

OUTPUT — REQUIREMENTS (VERBATIM)

- List each referenced requirement item (one per line), copied verbatim from the requirements source. Do NOT add or summarize other requirements.

OUTPUT — DESIGN SUMMARY (≤8 BULLETS)

- Up to eight concise bullets covering: scope, must-haves, acceptance criteria, constraints, important edge cases, and risks (each bullet 1–2 sentences).

IMPLEMENTATION PLAN (SCOPED & TRACEABLE)

- Deliver a complete step-by-step plan that implements ALL referenced requirements and the relevant design notes.
- For every plan step, include the requirement ID(s) it satisfies (e.g. "Step 2 — satisfies: 1.5, 1.7").
- List exact repo-relative file paths you will modify or create (existing files first). Keep any UI component <80 LOC and prefer reuse of utilities in `src/lib` and components in `src/components`.

AUTO-CONTINUE: APPLY CHANGES

- If there are no blocking questions, proceed to implement immediately after the plan. Make each change in a small, reviewable commit.
- After each logical edit, report:
  - Files changed (paths)
  - Risks introduced by the change
  - Exact local verification commands to run (lint, type-check, tests, run app)
- If verifications fail, iterate until green or report a true blocker.

GUARDRAILS (MANDATORY)

- Follow project rules: TypeScript, Expo Router, Nativewind, React Query, Zustand, @/\* imports. (Rule applied: "Project Rules: tech stack and import conventions")
- Do NOT invent new repo paths, public APIs, or dependency versions—use only files and requirements referenced by the task and design.
- Ask only one blocking question if essential; otherwise do not pause for optional clarifications.
- When you finish the full implementation, mark the task checkbox as done in the task index.

APPLICABLE PROJECT RULES USED

- "Code Style and Structure": functional TypeScript components, kebab-case filenames, @/\* imports.
- "Tech Stack": Expo + Nativewind + React Query + Zustand.
- "Testing": write focused Jest tests for non-trivial logic; test file naming: component-name.test.tsx.

KIRO Task Execution Protocol

PREREQUISITES

- Locate and read task {TASK_ID} from the specified tasks index.
- Extract requirements from either:
  - Referenced requirement IDs in `requirements.md`, or
  - Inline bullet list in the task description.
- Review relevant design spec sections.
- Check implementation hints and file paths.
- Validate external package requirements against official documentation when applicable.

REQUIREMENTS ANALYSIS

1. Extract and list verbatim requirements.
2. Document the source location for each requirement (file + ID or task bullet).
3. Note any dependencies or ordering between requirements.

DESIGN IMPLEMENTATION PLAN
Produce a concise design summary covering:

- Scope boundaries
- Core functionality
- Technical constraints
- Integration points
- Edge cases
- Performance considerations
- Security implications
- Testing strategy

IMPLEMENTATION EXECUTION
For each implementation step include:

1. Requirement(s) being satisfied.
2. Affected files (repo-relative paths).
3. Specific code changes (short description).
4. Verification steps:
   - Type checking
   - Linting
   - Unit tests
   - Integration tests (if applicable)
   - Manual verification steps

QUALITY CONTROLS

- Enforce TypeScript strict mode.
- Follow Expo Router conventions.
- Use Nativewind for styling.
- Implement React Query for server-state management where appropriate.
- Apply Zustand for lightweight client state where needed.
- Maintain @/\* import convention.
- Keep components under 80 LOC when possible.
- Write Jest tests for complex or logic-heavy modules.
- Use kebab-case for new filenames.

DELIVERABLES

1. Completed implementation satisfying all referenced requirements.
2. Passing test suite (unit + relevant integration tests).
3. Updated task index marking Task {TASK_ID} complete.
4. Short documentation of any technical decisions or trade-offs.

VERIFICATION
Before reporting completion:

- Confirm every listed requirement is implemented and traced to plan steps.
- Verify all tests pass and type-checking/linting are clean.
- Smoke-test the app flow affected by changes.
- Document any known limitations and suggested follow-ups.

Report completion only when all quality gates are satisfied.

END
