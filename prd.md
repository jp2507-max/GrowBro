# CanaBro Mobile App — Q3 2025 PRD (Launch v1.1)

Date: 2025-08-23
Owner: Product + Mobile Team
Version: 1.1 (translated + extended for launch)

## 1) Summary

CanaBro helps home growers plan, track, and optimize cultivation. This launch focuses on five epics:

- **A. Calendar 2.0** (recurring tasks, reminders, agenda UX)
- **B. Harvest Workflow** (staged drying/curing → inventory)
- **C. Community Feed Improvements** (engagement + moderation)
- **D. AI Photo Assessment (v1)** (leaf/plant issue detection → next-best-action)
- **E. Guided Grow Playbooks** (dynamic, step‑by‑step schedules by setup/strain)

## 2) Goals (What and Why)

- Increase daily active usage via reliable reminders and a clearer agenda.
- Reduce harvest logging friction and improve post‑harvest data quality.
- Boost community engagement with likes/comments and near‑real‑time updates.
- **New:** Reduce time‑to‑fix for common plant issues via on‑device/in‑cloud AI assessment and actionable guidance.
- **New:** Improve new‑grower outcomes with guided, editable playbooks that adapt to real‑world progress.

## 3) Non‑Goals (Launch v1)

- Marketplace or commerce features of any kind.
- Advanced analytics beyond basic charts and simple aggregates.
- Web app parity in this cycle.
- Pest‑control product recommendations with purchase links (keep content educational only).

## 4) Users & Personas

- **Hobby Grower:** wants simple schedules, reminders, and clear fixes when things go wrong.
- **Semi‑Pro Grower:** wants templated tasks, accurate harvest tracking, and inventory summaries.
- **Community Enthusiast:** shares updates, engages with others, values performance.

## 5) User Stories (selected)

- As a grower, I can create **recurring tasks** (e.g., water every 2 days) with reminders so I don’t forget.
- As a grower, I see a **clean agenda** for today and can drag‑to‑reschedule tasks.
- As a grower, I can **record harvest weights** and track **drying/curing** stages until inventory.
- As a user, I can **like and comment** on posts and see updates in near real‑time.
- **AI:** As a grower, I can **scan a leaf/plant photo** and get a likely assessment with **confidence** and **next steps**.
- **Guided:** As a new grower, I can pick a **playbook** (Auto/Photo; Indoor/Outdoor) that **creates my schedule** and **adapts** when the plan slips or the AI flags an issue.

## 6) Scope & Features

### EPIC A — Calendar 2.0

**A1.** Recurring tasks (daily/weekly/custom interval) with optional end dates.
**A2.** Local push notifications scheduled per task (one‑off and recurring).
**A3.** Agenda performance (FlashList‑backed day list, smooth 60fps).
**A4.** Drag & drop to reschedule tasks (day to day) with optimistic UI + undo.
**A5.** Apply **templates** (from playbooks) to auto‑create schedules per plant.

**Acceptance Criteria**

- Create/edit recurrence: daily, weekly (by weekday), every N days, end by date/occurrences.
- Reminder time per task; local notification fires reliably (foreground/background).
- Agenda lists >1,000 items remain responsive; no dropped frames in manual testing.
- Dragging a task across days updates schedule and persists; undo within 5s.
- Applying a template generates tasks linked to the plant/strain record.

### EPIC B — Harvest Workflow

**B1.** Harvest modal for inputs (wet/dry weight, trimmings, quality notes).
**B2.** Stage tracker: **Harvest → Drying → Curing → Inventory** with target durations.
**B3.** Inventory sync: summary record with final weights & stage completion dates.
**B4.** Charts: basic line chart of weight over time per plant/batch.

**Acceptance Criteria**

- Modal validates inputs, supports metric/imperial, works offline.
- Stage transitions persist with timestamps; editable with audit notes.
- Inventory record created/updated atomically with final dry weight.
- Chart renders for datasets 0–365 days.

### EPIC C — Community Feed Improvements

**C1.** Likes and comments with optimistic updates and error fallback.
**C2.** Near real‑time updates for counters and new comments (Supabase Realtime).
**C3.** Author moderation: delete own post/comment with 15s undo.
**C4.** Profile linking (tap handle → profile screen with avatar and recent posts).

**Acceptance Criteria**

- Like/unlike toggles instantly; reconciles with server on retry.
- New comments surface within \~1–3s; no duplicate events.
- Delete action reversible for 15s; content restored on undo.

### EPIC D — AI Photo Assessment (v1)

**Scope:** Focused classifier for the top 8–12 grow issues. Initial classes:

- **Deficiencies/Toxicities:** N, P, K, Mg, Ca (consider Fe as v1.1)
- **Stress:** over‑/under‑watering, light stress/bleaching, nutrient lockout/pH
- **Pathogens/Pests (binary presence):** powdery mildew, spider mites (visual cues)

**D1. Capture Flow:** Guided camera UX with prompts (leaf top/bottom, neutral light, macro focus); multiple shots per case.
**D2. Inference:** On‑device (where feasible) fallback to cloud; return **top‑1 class**, **confidence**.
**D3. Action Plan:** For each class, provide **Next‑Best‑Action** (diagnostic checks + 24–48h steps). Avoid product promotion; keep steps generic and safe.
**D4. Safety Rails:** Always include a **disclaimer**; for confidence <70% show **“Ask community / get second opinion”** CTA that deep‑links to a prefilled post with images.
**D5. Learning Loop:** Optional user feedback (“Was this helpful?”, “Issue resolved?”) to improve model.

**Acceptance Criteria**

- End‑to‑end flow from capture → result in <5s (cloud) on mid‑tier Android.
- Top‑1 accuracy (offline test set) ≥75% aggregated; per‑class metrics tracked.
- Conf <70% triggers community CTA automatically.
- All AI outputs are logged (privacy‑safe) for evaluation.

**Tech Notes (AI)**

- Start with a compact vision classifier (e.g., MobileNet‑family) exported to ONNX/TFLite where possible; cloud fallback via serverless.
- Data pipeline to curate labeled examples; store only with user consent; support deletion.
- Versioned model + rollout flags; remote config for thresholding.

### EPIC E — Guided Grow Playbooks

**E1. Playbooks:** Auto/Photo × Indoor/Outdoor baselines with week‑by‑week tasks (watering, feeding, pruning, training), metric defaults, and adjustable durations.
**E2. Templates → Calendar:** Applying a playbook generates a task schedule bound to the plant with sensible reminders.
**E3. Dynamic Adjustments:** Users can **shift** entire playbooks (e.g., “move everything by +3 days”), or the app proposes shifts when AI detects issues or when tasks slip.
**E4. Trichome Check Helper:** In‑app checklist describing clear/milky/amber and recommended harvest windows; user can log stage decision and (optionally) photos.

**Acceptance Criteria**

- Selecting a playbook creates tasks and reminders instantly.
- Bulk shift of schedules works with confirmation and undo.
- Trichome helper accessible from harvest flow; logs decision.

## 7) Technical Notes

- **Stack:** React Native 0.79, Expo 53, TypeScript (strict), Reanimated 3.19+, NativeWind 4, React Query 5, **WatermelonDB**, Supabase 2.x, Sentry RN.
- **Lists:** FlashList wrappers; follow perf helpers in `lib/utils/flashlist-performance.ts`.
- **Animations:** Follow reanimated best practices; cancel on unmount.
- **i18n:** No hardcoded strings in production UI; keep `en/de` in sync.
- **Errors:** Route notable exceptions through Sentry; structured logging for debug.
- **AI Services:** Modular provider to swap local vs. cloud inference; exponential backoff; queue on offline.

### 7A) Offline‑first & Sync (Launch scope)

**Local store:** WatermelonDB (SQLite, background thread). Requires Expo **development build** with the WatermelonDB config plugin. Not supported in Expo Go.

**Sync engine:** Use `synchronize()` with **pullChanges**/**pushChanges**. Backend via Supabase Edge Functions/RPC. Client keeps a **checkpoint** (`last_pulled_at`) and exchanges a **changes** object (created/updated/deleted) per table. Soft deletes use tombstones.

**Conflict resolution:** **Last‑Write‑Wins** using `updated_at` (server authoritative timestamps). Server must apply writes idempotently; rejected writes are reported with reasons; client marks record `needs_review`.

**Offline availability (MVP):**

- **Must (full offline R/W):**

  1. **Tasks/Calendar** (incl. recurrence, reminders metadata)
  2. **Plants & Grow data** (strain/setup, stages, notes)
  3. **Harvest workflow** (stages, weights, inventory handoff)
  4. **Playbooks/Templates** (applied schedules & bulk shift)
  5. **AI Assessments queue** (photos, pending requests/results; retries when online)

- **Should (read‑only cache + outbox):**
  6\) **Community feed** (last \~50 posts/comments cached); likes/comments queued offline and sent later.
- **Not stored as blobs in DB:**

  - **Images/Videos** are saved to the **file system**; the DB stores only URIs/metadata. Keep originals + a resized variant (\~1280px). Background cleanup (LRU) and per‑plant/assessment folders.

**Notifications:** Local scheduled notifications for tasks; rehydrate on app start; independent of network.

**Performance:** Batch DB ops; writes off UI thread; avoid N+1 queries; keep lists @ 60fps on mid‑tier Android.

**Telemetry:** Sync duration, checkpoint age, queued mutations, failure rates per table.

**Testing matrix:** Flight‑mode end‑to‑end (tasks/harvest/assessment queue), multi‑device conflict tests, large data sets (1k+ tasks), power‑saving modes.

**Security/Privacy:** Minimal PII in sync; per‑user RLS; assessments private by default; explicit opt‑in for sharing photos; user‑initiated deletion cascades local + remote.

### 7B) Image storage (implementation)

- Store under app cache/doc directories with content‑addressable names (hash of bytes + extension). Maintain a DB mapping (record ↔ file URIs).
- Use a thumbnail pipeline to avoid rendering full‑size images in lists.
- Periodic janitor: cap cache size and purge LRU; orphan detection on app start.

### 7C) Sync API — Edge Functions (Spec)

**Purpose:** Provide a minimal, robust pull/push protocol for WatermelonDB `synchronize()`.

**General**

- **Auth:** Bearer JWT from Supabase Auth. Edge Functions **must not** use the service key for user-scoped reads/writes; keep **RLS enforced**. Extract `user_id` via `auth.getUser()`.
- **Clock:** Server uses `now()` (ms) as the authoritative `server_timestamp` to avoid clock skew.
- **Tables in scope:** `plants`, `tasks`, `harvests`, `inventory`, `playbooks`, `assessments`, `posts`, `post_likes`, `post_comments` (read-only for some in pull). All tables have `id UUID`, `user_id UUID`, `updated_at timestamptz DEFAULT now()`, `deleted_at timestamptz NULL` (soft delete).
- **Order of operations (push):** `created → updated → deleted`. Idempotency via header `Idempotency-Key` (UUID). Max payload \~2MB; chunk if larger.
- **Pagination:** For large pulls, return `has_more: true` with `next_cursor` (opaque). Client retries with same body + `cursor`.

---

**Endpoint: `POST /sync/pull`**
_Request body_

```json
{
  "last_pulled_at": 1723500000000,
  "schema_version": "2025-08-23.v1",
  "tables": [
    "plants",
    "tasks",
    "harvests",
    "inventory",
    "playbooks",
    "assessments",
    "posts",
    "post_comments"
  ],
  "cursor": null
}
```

_Response_

```json
{
  "server_timestamp": 1755907200123,
  "changes": {
    "tasks": {
      "created": [
        {
          "id": "…",
          "title": "Water",
          "due_date": "2025-08-24",
          "user_id": "…",
          "updated_at": "2025-08-23T18:20:11Z",
          "deleted_at": null
        }
      ],
      "updated": [
        { "id": "…", "title": "Feed", "updated_at": "2025-08-23T18:22:31Z" }
      ],
      "deleted": [{ "id": "…", "deleted_at": "2025-08-23T18:25:00Z" }]
    },
    "plants": { "created": [], "updated": [], "deleted": [] },
    "harvests": { "created": [], "updated": [], "deleted": [] },
    "inventory": { "created": [], "updated": [], "deleted": [] },
    "playbooks": { "created": [], "updated": [], "deleted": [] },
    "assessments": { "created": [], "updated": [], "deleted": [] },
    "posts": { "created": [], "updated": [], "deleted": [] },
    "post_comments": { "created": [], "updated": [], "deleted": [] }
  },
  "has_more": false,
  "next_cursor": null,
  "migration_required": false
}
```

_Query logic (per table)_

- **created/updated:** rows where `updated_at > last_pulled_at` (or all if null), filtered by `user_id = auth.uid()` for private tables; community tables are public‑read but still filtered to recent changes.
- **deleted:** rows where `deleted_at IS NOT NULL AND deleted_at > last_pulled_at` returned as `{id, deleted_at}`.
- Use `cursor` to paginate by `(updated_at, id)`.

Note on public vs. private tables: the server should apply per‑user scoping for private tables (e.g., `tasks`, `plants`, `assessments`) by adding a `user_id = auth.uid()` filter to pull and delete queries. Community tables (e.g., `posts`, `post_comments`) are public‑read and must remain globally visible; the server should therefore skip the per‑user filter for those tables. A simple allowlist/denylist (as shown in the TypeScript sketch) is the recommended approach and keeps the logic explicit and auditable.

---

**Endpoint: `POST /sync/push`**
_Request body_

```json
{
  "last_pulled_at": 1723500000000,
  "changes": {
    "tasks": {
      "created": [
        {
          "id": "…",
          "title": "Water",
          "due_date": "2025-08-24",
          "user_id": "…",
          "updated_at_client": "2025-08-23T18:20:11Z"
        }
      ],
      "updated": [
        {
          "id": "…",
          "title": "Feed",
          "updated_at_client": "2025-08-23T18:22:31Z"
        }
      ],
      "deleted": [{ "id": "…", "deleted_at_client": "2025-08-23T18:25:00Z" }]
    },
    "plants": { "created": [], "updated": [], "deleted": [] },
    "harvests": { "created": [], "updated": [], "deleted": [] },
    "inventory": { "created": [], "updated": [], "deleted": [] },
    "playbooks": { "created": [], "updated": [], "deleted": [] },
    "assessments": { "created": [], "updated": [], "deleted": [] }
  }
}
```

_Response_

```json
{
  "server_timestamp": 1755907200456,
  "applied": { "tasks": { "created": 1, "updated": 1, "deleted": 1 } },
  "rejected": { "tasks": [{ "id": "…", "reason": "forbidden" }] },
  "conflicts": { "tasks": ["…"] }
}
```

_Apply rules_

- **Create/Update:** Upsert by `id`, always setting `updated_at = now()`. Enforce ownership (`user_id = auth.uid()`).
- **Delete:** Set `deleted_at = now()` (soft delete). Do not hard‑delete on push.
- **Conflicts (LWW):** If server row has `updated_at > last_pulled_at` and differs, you can either (a) still apply client changes and advance `updated_at` (pure LWW), or (b) reject and report in `conflicts`. For MVP choose **(a)**; keep `conflicts` mainly for diagnostics.
- **Idempotency:** If the same `Idempotency-Key` is seen again, return the previous result without re‑applying.

---

**TypeScript server sketch (pseudo)**

```ts
// pull
export default async function pull(req: Request) {
  const { last_pulled_at, tables, cursor } = await req.json();
  const supa = createClientWithAuth(req); // uses user JWT
  const since = last_pulled_at ? new Date(last_pulled_at) : new Date(0);

  // Allowlist / denylist for public‑read tables. These tables are globally visible
  // on pull and should NOT be scoped by user_id. Add any other public tables here.
  const publicReadTables = new Set(['posts', 'post_comments']);

  // Extract the authenticated user id once and reuse. See "General" above: use
  // auth.getUser() (or equivalent) to obtain the user's id from the request/JWT.
  // This is pseudo code for the sketch.
  const { user } = await supa.auth.getUser?.();
  const uid = user?.id ?? null;

  const out = { changes: {}, has_more: false, next_cursor: null } as any;
  for (const t of tables) {
    out.changes[t] = { created: [], updated: [], deleted: [] };

    // created/updated
    // Build the base query then apply per‑user RLS scoping for private tables.
    let upQuery = supa
      .from(t)
      .select('*')
      .gt('updated_at', since.toISOString())
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true });

    // Apply user filter for non‑public tables so RLS scoping matches expectations.
    if (!publicReadTables.has(t) && uid) {
      upQuery = upQuery.eq('user_id', uid);
    }

    const up = await upQuery;

    // deleted
    let delQuery = supa
      .from(t)
      .select('id, deleted_at')
      .not('deleted_at', 'is', null)
      .gt('deleted_at', since.toISOString());

    if (!publicReadTables.has(t) && uid) {
      delQuery = delQuery.eq('user_id', uid);
    }

    const del = await delQuery;

    out.changes[t].created =
      up.data?.filter((r) => r.created_at === r.updated_at) ?? [];
    out.changes[t].updated =
      up.data?.filter((r) => r.created_at !== r.updated_at) ?? [];
    out.changes[t].deleted = del.data ?? [];
  }
  return json({ server_timestamp: Date.now(), ...out });
}

// push
export default async function push(req: Request) {
  const { changes } = await req.json();
  const supa = createClientWithAuth(req);
  const applied = {};
  const rejected = {};
  const conflicts = {};

  // Extract authenticated user id once and reuse. Do NOT trust client-supplied user_id.
  const { user } = await supa.auth.getUser?.();
  const uid = user?.id ?? null;

  for (const [t, diff] of Object.entries(changes)) {
    applied[t] = { created: 0, updated: 0, deleted: 0 };

    // created/updated: treat client user_id as untrusted; inject server-side
    for (const row of [...diff.created, ...diff.updated]) {
      const { id, ...rest } = row; // ignore any user_id from client

      // Quick existence check to count created vs updated correctly.
      const exists = await supa.from(t).select('id').eq('id', id).maybeSingle();
      if (exists.error) {
        // If the existence check fails, treat as a rejected row and continue.
        (rejected[t] ??= []).push({ id, reason: exists.error.message });
        continue;
      }

      const up = await supa
        .from(t)
        .upsert({
          id,
          user_id: uid,
          ...rest,
          updated_at: new Date().toISOString(),
        });

      if (up.error) {
        // Keep existing error handling: push rejected entries on up.error
        (rejected[t] ??= []).push({ id, reason: up.error.message });
      } else {
        // Increment created if the row didn't exist, otherwise updated
        if (!exists.data) applied[t].created++;
        else applied[t].updated++;
      }
    }

    // deleted
    for (const row of diff.deleted) {
      const up = await supa
        .from(t)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', row.id)
        // scope to the authenticated user's rows (server-side uid)
        .eq('user_id', uid)
        // only update rows that are not already soft-deleted (idempotent)
        .is('deleted_at', null);

      if (up.error) {
        (rejected[t] ??= []).push({ id: row.id, reason: up.error.message });
      } else if (up.data && up.data.length > 0) {
        // Only count as deleted if the update actually affected rows
        applied[t].deleted++;
      }
    }
  }

  return json({ server_timestamp: Date.now(), applied, rejected, conflicts });
}
```

**Errors & codes**

- `401` unauthenticated; `403` RLS denied; `409` version conflict (optional); `413` payload too large.

**Versioning & migrations**

- Client sends `schema_version`. Server can respond with `migration_required: true` (block sync) and an optional `min_app_version`.

**Notes**

- Images are **not** synced here; only file URIs/metadata live in DB. Upload flows are separate.
- Community tables (`posts`, `post_comments`) are pulled read‑only; writes go through their dedicated endpoints (already in scope).

## 8) Data Model (Supabase) — Additions (Supabase) — Additions

- `tasks`: id, plant_id, title, due_date, recurrence_rule, reminder_at, status, created_at
- `task_templates`: id, name, json_schema, created_at
- `harvests`: id, plant_id, wet_weight, dry_weight, notes, stage, stage_started_at, stage_completed_at, created_at
- `inventory`: id, plant_id, harvest_id, final_weight, created_at
- **New `assessments`:** id, plant_id, images\[], predicted_class, confidence, actions_json, created_at, resolved_at, helpful_vote
- **New `playbooks`:** id, name, setup (auto/photo × indoor/outdoor), locale, steps_json, created_at
- `posts`, `post_likes`, `post_comments` (unchanged)

**RLS:** Per‑user isolation where applicable; community content is public‑read, owner‑write. AI `assessments` are private by default; sharing creates a redacted community post.

## 9) Analytics & Success Metrics

**Activation & Engagement**

- +20% 30‑day retention among active growers (Calendar users vs. non‑users).
- Time‑to‑Task: median <10s from create → first reminder set.

**Harvest & Inventory**

- +30% harvest logs with complete weights & stages.
- ≥80% of harvests end with an inventory record.

**Community**

- +25% increase in feed interactions (likes/comments per MAU).

**AI & Guidance**

- Top‑1 accuracy ≥75% across v1 classes on a held‑out dataset.
- ≥40% of AI assessments result in a task or playbook adjustment within 48h.
- “Helpful” rate ≥60% on AI result cards.

## 10) Accessibility & Localization

- A11y labels, sufficient contrast, 44pt hit areas.
- `en/de` translations updated and validated with the script.

## 11) Privacy, Safety & Store Compliance

- **Age‑gate 18+.**
- **No commerce:** No ordering, delivery, or THC product sales; no purchase links.
- **Educational tone:** Avoid language that encourages consumption.
- **Legal hints (Germany/EU):** Inline tips for personal home‑grow limits; no legal advice.
- **Disclaimers:** AI outputs are suggestions, not professional advice.
- **Data:** Opt‑in for sharing photos to improve models; allow deletion; privacy policy updated.

## 12) Milestones (8 weeks)

- **M1 (W2):** Recurring tasks + reminders MVP behind a flag.
- **M2 (W4):** Harvest modal + stages end‑to‑end; charts basic.
- **M2.5 (W5):** **Offline‑first baseline** — WatermelonDB integrated; schema migrated; image file storage; `pullChanges`/`pushChanges` endpoints live; LWW conflicts; flight‑mode QA (tasks/harvest/assessment queue) passes.
- **M3 (W6):** Community likes/comments + realtime baseline.
- **M4 (W7):** AI Assessment (v1) behind a flag; internal eval ≥75% top‑1.
- **M5 (W8):** Playbooks → Calendar integration; polish, a11y, localization, QA → RC.

## 13) Risks & Mitigations

- **Android notification reliability** → device‑matrix testing; fallback local alarms; analytics on delivery rate.
- **Realtime duplication** → client de‑dup; idempotent server updates.
- **Offline conflicts** → last‑write‑wins with user‑visible conflict notes.
- **AI misassessment** → confidence thresholds, safe baseline actions, community CTA.
- **App store policy changes** → internal checklist; copy review before release.

## 14) Out of Scope (explicit)

- Seed/equipment sales, dispensary/club integrations, or delivery.
- Medical claims (no promises of yield/health outcomes).

## 15) Open Questions

- Should we add Fe (iron) as a v1 class or hold for v1.1?
- Do we want a “Club mode” later (roles & shared calendars) without touching commerce?
- Should drying/curing durations be templated per strain in playbooks?

---

## 16) MVP Launch Scope (YES — sufficient for launch)

**Included:**

- Calendar 2.0 (recurrence, reminders, drag‑drop, templates)
- Harvest Workflow (stages → inventory, charts)
- Community (likes/comments, realtime, author moderation)
- **AI Photo Assessment v1** (focused classes, confidence, action plan, community CTA)
- **Guided Grow Playbooks** (Auto/Photo × Indoor/Outdoor baselines → calendar)
- Age‑gate, disclaimers, privacy options; EN/DE localization

**Deferred (post‑launch):**

- Additional AI classes (iron deficiency, thrips, leaf septoria), multi‑leaf blending
- Club mode (shared calendars), advanced analytics, web app
- Export (PDF/CSV) and bulk edits for recurring exceptions
