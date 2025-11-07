Here’s a crisp implementation plan you can review and iterate. I’m focusing on an MVP slice first, then phasing expansions.

## Plan: Support & Feedback MVP (Spec 26)

A phased plan that ships real value quickly: Help Center (offline cache + MiniSearch), Contact Support (offline queue with compression/EXIF strip), and a lightweight Rating Prompt. Everything behind feature flags. Second Opinion, full Status, and broad Educational flows move to later phases. Locale-aware Supabase FTS fix lands early to avoid DE search regressions later.

### Steps

1. Establish foundation types, flags, and storage: add `src/types/support.ts`, `src/lib/support/feature-flags.ts`, MMKV keys, and minimal WatermelonDB tables for help cache and support queue.
2. Build Help Center MVP: cache sync service + MiniSearch index + React Query hook + two screens (`help-center`, `help-article/[id]`), local “helpful/not” capture.
3. Build Contact Support MVP: device context, image compression/EXIF strip, local queue with backoff, React Query hook, and `support/contact` screen.
4. Add Rating Prompt MVP: 30‑day throttle, native wrappers, one “happy moment” trigger (behind flag).
5. Wire i18n EN/DE keys for these screens and run translation lint checks; ship behind feature flags.
6. Backend prep: Supabase FTS locale fix migration and stub Edge Function for support intake (Phase 2 activation).

### Further Considerations

1. Provider choices: Postmark for confirmation emails (Phase 2), Statuspage.io optional (Phase 2), Supabase Storage CDN for now.
2. iOS background fetch is opportunistic—rely on app resume/manual Sync Now in MVP.

Applied rules: Feature flags, TypeScript-first, Offline-first, i18n EN/DE, WatermelonDB queues, React Query hooks, Nativewind styling.

## Files to add/edit

- src/types/support.ts — Support types (HelpArticle, SupportTicket, DeviceContext, Rating states).
- src/lib/support/feature-flags.ts — Fetch/cache flags; keys: support.helpCenter, support.contact, support.ratingPrompt.
- src/lib/support/help-article-cache.ts — Fetch/cache/invalidate help articles; ETag support; LRU bounds.
- src/lib/support/help-search-index.ts — MiniSearch index serialize/deserialize in MMKV; debounce helpers.
- src/api/support/use-help-articles.ts — React Query hooks for list/detail, rating submit (local initially).
- src/app/support/help-center.tsx — Categories + search UI; offline banner.
- src/app/support/help-article/[id].tsx — Article detail; rating widget; “Contact Support” CTA.
- src/lib/support/device-context.ts — App/OS/device model, last route, optional Sentry lastEventId; strict minimization.
- src/lib/support/attachment-processor.ts — Image compression (target <10MB total, max 3), EXIF strip.
- src/lib/support/ticket-queue.ts — Queue CRUD, encryption flag, exponential backoff, idempotency clientRequestId.
- src/api/support/use-support-tickets.ts — Submit (queue-first), history (local), sync trigger.
- src/app/support/contact.tsx — Form (category, subject, description, attachments, preview metadata with opt-outs).
- src/lib/support/rating-prompt.ts — Throttle (30 days), Apple 3/365 guard, trigger hygiene.
- src/lib/support/native-rating.ts — iOS/Android wrappers.
- src/translations/en.json, src/translations/de.json — New keys (see below).
- src/lib/watermelon-schema.ts — Tables: help_articles_cache, support_tickets_queue (MVP subset).
- src/lib/storage.tsx — MMKV keys for help index, flags, rating throttle, queue meta.

Note: Match existing code style and folder aliases; use functional TS and Nativewind per project rules.

## Supabase changes

- Migration (early): Locale-aware FTS
  - Add stored generated tsvector `search_vector` switching by locale (en/de/simple).
  - Create a GIN index on `search_vector`.
- Phase 2: Edge Function `functions/support-intake` (idempotent, returns ticketReference, sends Postmark confirmation).
- Tables (Phase 2 if not present): support_tickets, feedback (with RLS). For MVP, client queues locally and syncs on resume/manual.

## Feature flags (remote-config keys)

- support.helpCenter — Gates Help Center screens and services.
- support.contact — Gates Contact Support form and queue sync.
- support.ratingPrompt — Gates rating triggers and modal.
- support.killSwitch.uploads (optional) — Global off switch for uploads/queues.

## i18n keys (EN/DE, examples)

- support.help.title, support.help.search.placeholder, support.help.offlineBanner
- support.article.rate.helpful, support.article.rate.notHelpful, support.article.contactCta
- support.contact.title, support.contact.category.label, support.contact.subject.placeholder, support.contact.description.placeholder, support.contact.attachments.add, support.contact.submit, support.contact.queued, support.contact.stripExif.prompt
- support.rating.title, support.rating.optOut.label, support.rating.later, support.rating.thanks
- common.sync.now, common.offline, common.retry, common.cancel

Run your translations check: pnpm script already exists per repo docs.

## Risks and mitigations

- iOS background sync unreliability: Prefer app resume + manual Sync Now; add background later.
- PII via screenshots: Default EXIF strip; warning/preview; block if >10MB; no GPS retained.
- Queue bloat: Cap 50 items and 100MB; show queue status in Settings (Phase 2 UI).
- DE search quality: Implement locale-aware Supabase FTS now to avoid regression later (even if MVP uses MiniSearch offline).
- Over-prompting ratings: 30-day throttle + respect platform quota; opt-out toggle in Settings.

If helpful, I can expand this into a phased backlog (MVP → Phase 2/3) mapped to your task IDs next.
