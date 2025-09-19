# AGENTS.md — Agent Operating Rules for Kiro (Expo 54 / TypeScript / pnpm)

## Mission

Process each Spec in `.kiro/specs/*/tasks.md`. Use `design.md` as the source of truth, enforce requirement coverage, and skip tasks already implemented. Work on a Draft PR with deterministic gates; do not rely on GitHub API access during execution.

---

## Authoritative Context

- Project rules: `/projectrules.mdc`, `/styling-guidelines.mdc`, `/structure.mdc`, `/tests.mdc`, `/product.mdc`
- Cursor/Codex ruleset: `/.cursor/rules/*` (if present) — read to align with Cursor agent expectations
- Per Spec directory (e.g., `.kiro/specs/<num>. <slug>/`):
  - `design.md`
  - `requirements.md`
  - `tasks.md` (each task may list requirement IDs like `10.2`, `15.3`)
  - `progress.md` (optional; prefer PR body checklist + comments for progress)

---

## Quality Gates (cadence & honesty)

- Run gates per task group, not per tiny change. A "task group" maps to a meaningful feature slice (e.g., interfaces+config, store, screen, i18n+tests).
- Preferred locally: `pnpm check-all` (lint, type-check, translations/i18n, privacy, tests). If local execution isn't available, push and rely on CI to run the same gates.
- Never claim PASS unless you actually ran the command and saw it succeed. If deferred to CI, state so explicitly and proceed.
- Individual scripts (as defined in package.json):
  - `pnpm lint`
  - `pnpm type-check`
  - `pnpm lint:translations`
  - `pnpm i18n:validate`
  - `pnpm privacy:validate`
  - `pnpm test`
- Code review gates:
  - CodeRabbit "0 open improvement comments" is required before moving PR from Draft to Ready (finalization), not on every commit.
  - PR must pass all required status checks before Ready.

---

## Branch & PR Workflow

1. Determine the Spec offline (no GitHub API)

   - Derive `SPEC_NUM` and `SPEC_SLUG` from either the current branch name `spec/<number>-<slug>` or local directory `.kiro/specs/<number>. <slug>/`.
   - Set `SPEC_DIR=.kiro/specs/<number>. <slug>/`.
   - Record the chosen values in the PR body under “Spec Resolution (offline)”.

2. Create or reuse the feature branch `spec/<number>-<slug>`, based on `main`

   - Keep the feature branch up-to-date with `main` before pushing updates

3. Ensure a Draft PR exists from the feature branch → `main` with:

   - Title: `spec(<number>): <slug>`
   - Body contains: `Closes #<ISSUE_NUMBER>`, and links to `design.md`, `requirements.md`, `tasks.md`
   - Task checklist pasted from `tasks.md` so GitHub renders checkboxes

   Offline default (no GH API):

   - Always write the 3‑line Session Plan to `docs/session-plan.md` in the branch and proceed without waiting. If API access is present (optional), also post it as a PR comment.

4. Execute tasks from `tasks.md` in order
   a) First check if a task is already implemented:

   - Functionality already exists; tests/visible UI present; requirement IDs satisfied
   - If yes: mark `[x] <Task title> — already implemented` in the PR checklist (and `progress.md` if used)
     b) Otherwise implement fully:
     i. Extract requirement IDs from the task
     ii. Quote verbatim lines from `requirements.md` for those IDs
     iii. Summarize relevant constraints (≤8 bullets) from `design.md`
     iv. Plan steps with file paths
     v. Run quality gates (see above) — per task group. If local gates cannot run, push and rely on CI; do not claim PASS locally.
     vi. Commit: `feat(spec<NUMBER>): <task title>`
     vii. Update PR checklist; optionally update `progress.md`
     viii. Add PR comment: `- [x] <Task title> — summary / how to test`

5. When all tasks are done or marked
   - Resolve all CodeRabbit comments (0 open) before moving PR to Ready
   - Call `@coderabbitai review`; then call `@codex review` to cross-check after CodeRabbit
   - Move PR from Draft → Ready for review

---

## Spec Resolution Rules (critical, offline-first)

Always determine the Spec from the Issue content, never from the GitHub issue number.

Priority order for deriving SPEC_NUM, SPEC_SLUG, SPEC_DIR (without API):

1. Current branch name `spec/<number>-<slug>` (preferred offline)
2. Local directory `.kiro/specs/<number>. <slug>/` if present

Rules:

- Do not rely on GitHub Issue metadata during execution.
- Note chosen values in the PR body under “Spec Resolution (offline)”.

---

## Task → Requirements Enforcement

- If the task lists requirement IDs: quote those lines from `requirements.md`
- If none listed: infer likely ones, document them, ensure coverage
- Ensure `design.md` specifications are respected

---

## Research and validation (no MCP)

- Use web search only for major uncertainty or security-sensitive work; prefer official docs. If search is unavailable, proceed offline and add `RESEARCH-TODO:` in the PR to validate later.
- Favor `npx expo install <package>` for Expo-managed versions.

Long-run execution guidance:

- Prefer running in CI (e.g., GitHub Actions) with extended timeouts (≥ 5h) for uninterrupted multi-slice work. Cache `pnpm` and build artifacts to reduce cycle time.

---

## Completion Criteria

- All tasks are done or marked already implemented
- Quality gates green (`pnpm check-all` preferred)
- CodeRabbit: 0 open improvement comments
- Codex review: no more improvements comments
- always run Coderabbit review and Codex review until no more comments appear
- PR in “Ready for review”

---

## Guardrails

- Conventional Commits
- UI components < 80 LOC
- Naming conventions
- No secrets
- Follow product constraints (age-gated 18+, no commerce, privacy-first)
- Always follow the project rules & style files
