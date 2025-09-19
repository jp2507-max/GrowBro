# AGENTS.md — Agent Operating Rules for Kiro (Expo 54 / TypeScript / pnpm)

## Mission

Process each Spec in `.kiro/specs/*/tasks.md`. Use `design.md` as the source of truth, enforce requirement coverage, and skip tasks already implemented. Work from an assigned GitHub Issue to a Draft PR with deterministic gates.

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

## Quality Gates (must pass before every commit / PR update)

- Preferred: `pnpm check-all` (runs lint, type-check, translations/i18n validators, privacy validators, and tests)
- Or individual scripts (as defined in package.json):
  - `pnpm lint`
  - `pnpm type-check`
  - `pnpm lint:translations`
  - `pnpm i18n:validate`
  - `pnpm privacy:validate`
  - `pnpm test`
- **CodeRabbit must have 0 open improvement comments**
- PR must pass all required status checks

---

## Branch & PR Workflow

1. Start from an assigned GitHub Issue titled `Spec <number> – <slug>`

   - Derive `SPEC_NUM=<number>`, `SPEC_SLUG=<slug>`
   - Derive `SPEC_DIR=.kiro/specs/<number>. <slug>/` (if not provided explicitly)
   - Fetch issue title/body/labels via GitHub API/MCP (do not rely on local repo search)

2. Create or reuse the feature branch `spec/<number>-<slug>`, based on `main`

   - Keep the feature branch up-to-date with `main` before pushing updates

3. Ensure a Draft PR exists from the feature branch → `main` with:

   - Title: `spec(<number>): <slug>`
   - Body contains: `Closes #<ISSUE_NUMBER>`, and links to `design.md`, `requirements.md`, `tasks.md`
   - Task checklist pasted from `tasks.md` so GitHub renders checkboxes

4. Execute tasks from `tasks.md` in order
   a) First check if a task is already implemented:

   - Functionality already exists; tests/visible UI present; requirement IDs satisfied
   - If yes: mark `[x] <Task title> — already implemented` in the PR checklist (and `progress.md` if used)
     b) Otherwise implement fully:
     i. Extract requirement IDs from the task
     ii. Quote verbatim lines from `requirements.md` for those IDs
     iii. Summarize relevant constraints (≤8 bullets) from `design.md`
     iv. Plan steps with file paths
     v. Run quality gates (see above)
     vi. Commit: `feat(spec<NUMBER>): <task title>`
     vii. Update PR checklist; optionally update `progress.md`
     viii. Add PR comment: `- [x] <Task title> — summary / how to test`

5. When all tasks are done or marked
   - Resolve all CodeRabbit comments
   - Call `@coderabbitai review`; then call `@codex review` to cross-check after CodeRabbit
   - Move PR from Draft → Ready for review

---

## Spec Resolution Rules (critical)

Always determine the Spec from the Issue content, never from the GitHub issue number.

Priority order for deriving SPEC_NUM, SPEC_SLUG, SPEC_DIR:

1. Issue title pattern `Spec <number> – <slug>` (preferred)
2. Issue body links (e.g., “Kontext / Dateien” or “Spec file links”) pointing to
   `/.kiro/specs/<number>. <slug>/design.md` etc. — infer `<number>. <slug>` from these
3. Issue Form fields if present: `spec_number`, `spec_slug`, `spec_dir`
4. Label `spec:<number>` for SPEC_NUM only (slug still required from title/body/fields)

Rules:

- NEVER infer `SPEC_NUM` from the GitHub issue ID
- On conflicts, prefer the title; note the chosen values in the PR body under “Spec Resolution”

---

## Task → Requirements Enforcement

- If the task lists requirement IDs: quote those lines from `requirements.md`
- If none listed: infer likely ones, document them, ensure coverage
- Ensure `design.md` specifications are respected

---

## MCP servers and external validation

- Use MCP servers (when available to the coding agent) to fetch up-to-date docs for libraries and validate package choices before adding dependencies.
- For packages and APIs, validate breaking changes and compatibility. Favor `npx expo install <package>` for Expo-managed versions.

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
