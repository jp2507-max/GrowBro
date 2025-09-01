TASK_ID: {9}

CONTEXT

- Feature: calendar-2.0
- Tasks index: .kiro/specs/1. calendar-2.0/tasks.md
- Design spec: .kiro/specs/1. calendar-2.0/design.md

READ FIRST — STRICT SCOPE

1. Open the tasks index and navigate to Task {TASK_ID}. Read ONLY that task’s section.
2. From that task’s “_Requirements: ..._” line:
   - Extract the requirement IDs (e.g., 1.5, 6.7). Read ONLY those items from the requirements source.
   - If the task inlines bullets instead of IDs, treat ONLY those bullets as requirements.
3. Open the design spec and read ONLY the section(s) relevant to Task {TASK_ID}/{task title}. If unclear, ask a single blocking question, then proceed.
4. Check task file for additional infos for implementation or so
5. If you are working with any packages like reanimated, rrule or any other always get fresh context and up to date infos with brave search and context 7

OUTPUT — REQUIREMENTS & DESIGN

- Requirements (verbatim, one per line): ONLY the items/IDs referenced by Task {TASK_ID}.
- ≤8 bullets: scope, must-haves, acceptance criteria, constraints, edge cases, risks.

OUTPUT — PLAN (SCOPED AND COMPLETE)

- Provide a complete, scoped implementation plan that covers ALL referenced requirements and the relevant design details.
- Map each plan step to requirement IDs to avoid gaps.
- List exact repo-relative files you will touch (existing first, then new). Keep components <80 LOC and reuse existing utils/components.

AUTO-CONTINUE — IMPLEMENT NOW

- Do NOT wait for approval. If there are no blocking questions, start implementing immediately after the plan.
- Keep diffs small and reviewable; match existing style; ask before adding new dependencies/config.
- After each logical edit: report changed files, risks, and exact local verification commands:
  - Lint
  - Type-check
  - Tests (for non-trivial logic)
  - Run app
- If verification fails, fix and re-run until green or blocked.

GUARDRAILS

- Follow project rules (TypeScript, Expo Router, Nativewind, Zustand, React Query, @/\* imports).
- Do not invent paths/APIs/versions—use only what’s in the repo and the referenced requirement items and design.
- Pause ONLY for true blockers (missing paths/ambiguous requirement IDs).
- after you REALLY completed the Full task mark the checkbox as done
