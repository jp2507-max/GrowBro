# AGENTS.md — Spec Runner & Coding Agent Playbook

This document is the binding reference for coding agents (e.g., Cursor, other MCP clients).
Goal: execute 22 specifications under `.kiro/specs/` safely and quickly—with strict guardrails, minimal change size, and verifiable evidence.

## 1) Scope & Actor

- **Actor:** Automated coding agent with read access to the whole repo and **write access only within the allowed paths** (see below).
- **Risk profile:** Conservative. Prefer the smallest viable change; no speculative refactors.
- **Definition of Done:** Typecheck, lint, and tests pass; small focused commits; PR description includes plan, changes, and evidence.

## 2) Sources of Truth

- **Tasks:** `.kiro/specs/*/tasks.md`
- **Requirements:** `.kiro/specs/*/requirements.md`
- **Design:** `.kiro/specs/*/design.md`
- **Protocol:** `reusableprompt.md`
- **Project rules:** `.cursor/rules/*.mdc`

## 3) Environment & Reproducibility

- **Node / Package manager**
  - Project uses **pnpm** via **Corepack**. The root `package.json` **must** contain:
    ```json
    { "packageManager": "pnpm@<EXACT_VERSION>" }
    ```
  - Local setup (once): `corepack enable` → then use normal pnpm commands.
- **Install:** `pnpm install` must succeed locally and in CI without lockfile drift.
- **Scripts (canonical)**
  - Typecheck: `pnpm -s tsc --noEmit`
  - Lint: `pnpm -s lint`
  - Tests: `pnpm -s test`

## 4) Execution Protocol (Design-first)

**Follow `reusableprompt.md` (STRICT PROCEDURE & GUARDRAILS) verbatim.**

1. **Select the Task**  
   Identify the exact `Task ID` in `.kiro/specs/<epic>/tasks.md`.
2. **Read in this order (minimum principle):**
   1. the **task** lines,
   2. the **referenced requirements** lines,
   3. the **`design.md`** for this spec — extract everything needed (flows, UI states, data contracts, edge cases, acceptance criteria, non-functional constraints).  
      Treat `design.md` as the **primary guidance for implementation details** and for deriving tests/verification steps. If anything in requirements vs. design conflicts, **pause and ask one concise question** (see Blocker Policy) before proceeding.
3. **Draft a plan**  
   Bullet list of expected files/changes, risks, and tests explicitly mapped to sections of `design.md`.
4. **Implement in small steps**
   - Keep UI components **< 80 LOC** per file; if larger, split into smaller components.
   - Use `@/*` imports; **kebab-case** filenames.
5. **Verify after each step**
   - `pnpm -s tsc --noEmit`
   - `pnpm -s lint`
   - `pnpm -s test`
6. **Post an EVIDENCE block**
   - Last relevant lines of the three commands, plus short summary of changes and why they’re safe.
   - Include a “Design Trace” listing the `design.md` headings/anchors you implemented (e.g., `design.md#sync-queue`).
7. **Commit (small & focused)**
   - See Commit Policy.
8. **On blocker**
   - Ask **one** concise question with a suggested assumption; then stop.

## 4.1) Required Output Blocks (before implementation)

- **REQUIREMENTS (VERBATIM):** copy the exact lines referenced from `requirements.md`.
- **DESIGN SUMMARY (≤8 bullets):** scope, must-haves, constraints, acceptance criteria, edge cases, risks.
- **IMPLEMENTATION PLAN:** step-by-step; for each step list requirement IDs satisfied and repo file paths to modify/create.

## 4.2) AUTO_CONTINUE Behavior

When `AUTO_CONTINUE=auto`, implement minimal, low‑risk edits after the plan. After each edit run:

- `pnpm -s tsc --noEmit`
- `pnpm -s lint`
- `pnpm -s test`
  Attempt up to two quick fixes if failures occur; then stop and ask one concise blocker question with a proposed assumption.

## 5) Read/Write Scopes

- **Read:** Only the files listed under “Read in this order” plus directly referenced implementation sites.
- **Write (allowlist):**
  - `app/**/*`, `src/**/*`, `packages/**/*`, `scripts/**/*`, `e2e/**/*`, `__tests__/**/*`
- **Forbidden without a dedicated task:**
  - `android/**`, `ios/**`, CI workflows, DB schemas/migrations, ENV/secrets, package-manager changes, introducing new third-party deps.

## 5.1) Special Write Rules

- Database migrations and new dependencies are allowed only if the selected Task requires them.
- For RN/Expo packages use: `npx expo install <package-name>`.
- Otherwise, ask one blocker question before adding dependencies or modifying schema.

## 6) Guardrails

Follow these without rephrasing:

- `.cursor/rules/structure.mdc`
- `.cursor/rules/tests.mdc`
- `.cursor/rules/styling-guidelines.mdc`
- `.cursor/rules/projectrules.mdc`

## 6.1) Additional Guardrails

- Stack: TypeScript + Expo Router + Nativewind + React Query + Zustand.
- Imports/Files: use `@/*` aliases; kebab-case filenames.
- Components: keep UI components < 80 LOC; split otherwise.
- Do not invent repo paths, public APIs, or dependency versions. Consult docs via MCP.

## 6.2) Internationalization

All user‑visible strings must be internationalized in English and German.

## 6.3) Testing Essentials

- Follow testing hierarchy from `.cursor/rules/tests.mdc`.
- Name tests as `<component>.test.ts(x)`.
- Test utilities/complex components; avoid testing implementation details.

## 7) Commit Policy (Conventional Commits)

- **Types:** `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `perf`, `build`, `ci`.
- **Format:** `type(scope): message`
- **Examples:**
  - `feat(sync): add optimistic updates for offline queue`
  - `fix(ui): handle null reading in nutrient card`
  - `test(api): add contract tests for harvest workflow`
- Prefer **small commits**. One commit = one clearly testable change.

## 8) CI Gate

- Expect a PR workflow (e.g., GitHub Actions).
- A PR is **not mergeable** unless typecheck/lint/tests are green in CI.
- Agent may create a concise PR body: _Plan → Change list → Risks → Evidence_.

## 9) ADR Policy (Architecture Decision Records)

- New library/pattern or significant alternative?  
  → Create `docs/adr/NNNN-title.md` with context, options, decision, consequences.
- Reference the ADR from the PR.

## 10) Tools & Integrations (MCP)

- **MCP servers** are used to access tools/data in a controlled way.
- **Allowed:** reading docs/DB/HTTP, code queries, safe code mods.
- **Not allowed:** leaking secrets, writes outside the allowlist.
- **Config:** Use the same server names/commands/args/ENV across clients (e.g., Cursor and local). Keep timeouts and rate limits conservative.

## 10.1) MCP Servers (tools)

- Config file: `.cursor/mcp.json`
- Currently enabled: `Sentry`
- Optional (if cloud supports and secrets provided): `brave-search`, `context7`
- Secrets: set `BRAVE_API_KEY`, `CONTEXT7_API_KEY` in the cloud environment; do not commit secrets.

## 11) Blocker Policy & Communication

- If information is missing (API key, unknown domain model, unclear success metric):
  - Ask **one** precise question with a suggested assumption (“I will proceed with X if that’s correct.”).
  - Do not continue until clarified.
- If tests are missing: propose a minimal test and include it.

## 12) Invocation Examples

- _“Execute Task 15 from `.kiro/specs/15. nutrient-engine-and-ph-ec/tasks.md` using `reusableprompt.md`. `AUTO_CONTINUE=auto`. Produce plan, then implement.”_
- _“Run offline-first sync Task ID 2 per protocol. Stop on blockers with one concise question.”_
