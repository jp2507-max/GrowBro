---
name: perf_degradation_406_spam
overview: Stop the progressive slowdown by eliminating noisy 406/"0 rows" Supabase queries and preventing repeated background checks from hammering JS/network, especially for age status and pending deletion lookups.
todos:
  - id: audit-406-lookups
    content: Find and replace `.single()`/`.maybeSingle()` on `user_age_status` + `account_deletion_requests` where 0 rows is valid.
    status: pending
  - id: cache-age-status
    content: Add TTL cache for `ContentAgeGatingEngine.getUserAgeStatus()` to prevent repeated network calls.
    status: pending
  - id: throttle-pending-deletion-check
    content: Add min-interval + in-flight guard to `usePendingDeletion()` to avoid repeat checks on remount/redirect loops.
    status: pending
  - id: verify
    content: 'Validate locally: confirm no repeated 406s and scrolling stays smooth after 2+ minutes.'
    status: pending
---

# Fix perf regression from 406 query spam

## Working theory (based on your screenshots + current code)

- The repeated `406 Not Acceptable` calls are consistent with Supabase/PostgREST “expected 0 rows” lookups made via `.single()` / `.maybeSingle()` (they use an object accept header).
- Even if `.maybeSingle()` is handled in JS, it still produces a 406 response on the wire, and if it’s happening frequently it will degrade JS responsiveness over time.
- In this repo, `user_age_status` is still queried with `.maybeSingle()` in the age-gating engine, which can be invoked frequently (per access check) and would match the observed spam.
- `account_deletion_requests` still has a `.single()` path in the cancel flow, and your app-level layout runs `usePendingDeletion()` globally; if that logic is re-triggered (remount/redirect loop), it can spam too.

## Changes

- Replace “0-row expected” lookups from `.single()`/`.maybeSingle()` to `.limit(1)` + array indexing to avoid 406 on the wire.
- Update [`src/lib/moderation/content-age-gating.ts`](src/lib/moderation/content-age-gating.ts):
- `getContentRestriction()` currently uses `.maybeSingle()` (lines ~321–337).
- `getUserAgeStatus()` currently uses `.maybeSingle()` (lines ~342–370).
- Update [`src/api/auth/use-request-account-deletion.ts`](src/api/auth/use-request-account-deletion.ts):
- `useCancelAccountDeletion` fetch of pending request currently uses `.single()` (lines ~271–281).
- Add a small in-memory cache (per userId, TTL) inside `ContentAgeGatingEngine` so repeated access checks don’t refetch `user_age_status`.
- Cache key: `userId`
- TTL default: 2–5 minutes
- Invalidate cache when we detect an explicit status update path (e.g., after verification flow completes) or when app goes background→active.
- Add guardrails to ensure global “status checks” don’t rerun excessively if the layout remounts:
- Update [`src/lib/hooks/use-pending-deletion.tsx`](src/lib/hooks/use-pending-deletion.tsx) to enforce a minimum re-check interval (e.g., 60s) and to skip if a check is already in flight.

## Verification (what you’ll run locally)

- **Network**: open the in-app network inspector / devtools and confirm `account_deletion_requests` and `user_age_status` are no longer producing repeated **406** responses during idle and while scrolling.
- **Performance**: reproduce your “wait 1–2 minutes then scroll Strains” scenario and confirm JS/UI FPS stays stable.
- **Tests** (if present/fast): run the targeted unit tests for age-gating and auth deletion helpers.

## Notes / risks

- If any code path truly requires “exactly one row” semantics, we’ll keep `.single()` there. The planned changes target only lookups where “0 rows” is a normal state.
- Caching age status must respect updates; we’ll keep TTL short and add invalidation on known status-change events.
