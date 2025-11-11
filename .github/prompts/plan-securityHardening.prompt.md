Plan: Security Verification & Hardening (Nov 2025)

Purpose: Execute an ordered pass to modernize and verify 2025 security controls across auth, Edge Functions, RBAC/RLS, sensitive data handling, error & input validation, database posture, mobile platform specifics, and monitoring. Each step produces evidence (diffs, queries, logs) and marks status in a tracking sheet (Implemented / Verified / Owner / Date).

Actions by category

Authentication

- Best practices:
  - Enforce MFA or step-up auth for sensitive flows (AAL2) using Supabase MFA; store authorization data only in app_metadata (not user_metadata).
  - Use short-lived access tokens; rely on automatic refresh via supabase-js; avoid storing tokens in insecure persistent storage (use encrypted platform storage).
  - Configure secure redirect and deep link URIs (Expo scheme + universal links / Android App Links) for password reset, magic links, OAuth; prevent token leakage via logs.
  - Rate limiting & bot protection for auth endpoints; monitor failed login trends via auth_logs.
  - Rotate JWT signing keys; prefer asymmetric keys; respect JWKS cache windows during rotation.
- Verification steps:
  - Review Supabase Auth settings: redirect URLs include prod universal links and dev scheme; avoid wildcards.
  - Inspect JWT payload: role claim mapping (authenticated/anon) and custom claims limited to app_metadata.
  - Attempt unauthorized access with expired token → must fail; verify refresh token process.
  - Confirm MFA enforcement for privileged operations (policy checks referencing aal claim).
  - Simulate brute force to see rate limits trigger (auth_logs reflect throttling).

Middleware / Route Protection (Edge Functions & Client Guards)

- Best practices:
  - Validate Authorization header before any side-effect; reject when auth.uid() is null.
  - Centralize input validation and error schema ({ error: { code, message } }); method/content-type allowlists.
  - Apply rate limiting for public functions; ensure idempotency for POST webhooks.
  - Never use service_role in mobile; only inside Edge Functions via secrets; keep CORS minimal if exposed to web.
- Verification steps:
  - Review each function for auth guard and validation; ensure service_role usage is justified.
  - Hit endpoints without/with malformed JWT → 401/403 expected; test OPTIONS preflight.
  - Confirm rate limiting produces 429 under load; check logs for absence of PII.

Role-Based Access Control (RBAC)

- Best practices:
  - Maintain roles and permissions in tables (user_roles, role_permissions); expose via JWT custom claim through Auth Hook.
  - Use security definer authorize() helper; mix restrictive and permissive policies as needed.
  - Avoid user_metadata for authorization.
- Verification steps:
  - Inspect Auth Hook; ensure only privileged roles can execute.
  - Ensure policies specify TO authenticated as appropriate.
  - Scenario test: moderator vs admin operations; verify index coverage on policy columns.

Sensitive Data Handling

- Best practices:
  - Use secure storage (Expo SecureStore / Keychain / Keystore) for refresh tokens; never AsyncStorage.
  - Prevent screenshots on sensitive screens; avoid logging tokens or PII.
  - Use private buckets with signed URLs; short TTLs.
  - Consider pgcrypto/pgsodium for especially sensitive columns.
- Verification steps:
  - Static scan for token logs; confirm SecureStore usage.
  - Verify Storage bucket visibility; attempt unauthorized download fails.
  - Ensure production builds disable verbose logging.

Error Handling

- Best practices:
  - Standardize status codes; structured, user-safe error messages.
  - Leverage Supabase client error types for UX; enable Sentry with scrubbing.
- Verification steps:
  - Trigger validation & server errors; verify status and schema.
  - Confirm Sentry captures with environment/release tags and no PII.

Input Validation

- Best practices:
  - Client pre-validation + authoritative server-side validation; parameterized queries only.
  - Validate enums, lengths, ranges; reject unknown object keys (zod or JSON schema for JSON columns).
- Verification steps:
  - Inject meta-characters; verify no SQL injection or crashes.
  - Test oversize payload rejection; search for dynamic SQL concatenation.

Database Security (Supabase Postgres / RLS)

- Best practices:
  - RLS enabled on all public tables; default deny; index policy predicates.
  - Use security definer carefully in private schema; avoid joins in policies where possible.
  - Separate administrative bypass via service_role only in controlled server contexts.
- Verification steps:
  - List all tables and confirm relrowsecurity=true; negative tests via anon key.
  - EXPLAIN common queries to confirm index usage; check for bypassrls roles.
  - Validate role changes require re-login for new claims.

Hosting / Infrastructure

- Best practices:
  - Store Edge Function secrets via supabase secrets; rotate; prohibit plaintext in repo.
  - Monitor edge/auth logs; define alert thresholds.
  - CI dependency scanning (pnpm audit, osv-scanner/semgrep); separate envs and keys.
- Verification steps:
  - Compare secrets list vs repo; scan for service_role leakage.
  - Observe logs for error spikes and geo anomalies; ensure action plan.

Supabase RLS & Policy Examples (concise)

- Row ownership:
  - SELECT/UPDATE/DELETE using: ( (select auth.uid()) = user_id )
  - INSERT with check: ( (select auth.uid()) = user_id )
- Public read to authenticated:
  - policy "Profiles read" on profiles for select to authenticated using (true)
- Permission-based:
  - policy "Delete channels" on channels for delete to authenticated using ((select authorize('channels.delete')))
- Team-based:
  - using ( team_id in (select team_id from team_user where user_id = (select auth.uid())) )
- Performance:
  - create index on team_user(user_id); create index on channels(team_id)

Mobile-specific Security (Expo / RN)

- Secure storage for tokens; biometric/lock screen gating for critical actions.
- EAS Update: enable code signing; enforce integrity checks; monitor rollbacks.
- Release hardening: Hermes, minification/obfuscation as acceptable; disable debug in release; root/jailbreak heuristics if policy requires.
- Deep links: whitelist hosts/schemes; validate and sanitize parameters; reject open redirects.
- FLAG_SECURE on sensitive screens; blur on backgrounding for iOS.

Logging & Monitoring

- Initialize Sentry early; set tracesSampleRate/profile rates conservatively.
- Add Supabase breadcrumbs/tracing; scrub PII in beforeSend.
- Define alert thresholds: auth failure spikes, 5xx spikes, function latency.
- Supabase logs: query auth_logs/edge_logs with filters; avoid storing sensitive fields.

References

- OWASP ASVS 5.0; OWASP MASVS/MASTG
- Supabase: Auth, JWTs, RLS, RBAC custom claims, Functions, Logs & Telemetry
- React Native linking, Expo security docs, Deno Deploy security, Android Keystore, iOS Keychain

Adoption Order

1. Harden auth flows (redirects, MFA, token storage)
2. Enforce comprehensive RLS + RBAC with performance tuning
3. Secure mobile storage & deep link handling; remove insecure logging
4. Standardize Edge Function validation, errors, rate limiting
5. Sentry + Supabase logging with PII scrubbing and alerts
6. Continuous dependency/secret scans; environment separation
7. Tamper resilience & code integrity
8. Periodic policy/index performance review
