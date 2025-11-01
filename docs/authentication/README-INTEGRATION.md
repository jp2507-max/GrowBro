# README Integration Instructions

This document provides instructions for integrating the authentication documentation into the main project README.

## Files Created

The following documentation files have been created in `docs/authentication/`:

1. **README.md** - Complete authentication documentation
2. **migration-guide.md** - Migration guide from legacy auth to new system
3. **oauth-setup.md** - Detailed OAuth provider setup instructions

## Integration Steps

### Option 1: Link from Main README

Add a link to the authentication documentation in the main `README.md`:

```markdown
## Authentication

GrowBro uses Supabase Auth for secure authentication. See the [Authentication Guide](./docs/authentication/README.md) for:

- Email/password and OAuth (Apple/Google) sign in
- Session management and offline support
- Device tracking and security features
- Setup and configuration instructions

Quick links:

- [Authentication Overview](./docs/authentication/README.md)
- [OAuth Setup Guide](./docs/authentication/oauth-setup.md)
- [Migration Guide](./docs/authentication/migration-guide.md)
```

### Option 2: Inline Authentication Section

Copy the content from `docs/authentication/README.md` and paste it into the main `README.md` as a new section.

**Recommended location**: After the "Stack" or "Features" section, before "Testing" or "Contributing".

### Option 3: Condensed Section with Links

Add a condensed authentication section to the main README:

````markdown
## Authentication

GrowBro provides secure authentication with:

- **Email/Password**: Sign up and sign in with email verification
- **OAuth**: Sign in with Apple or Google (iOS and Android)
- **Session Management**: Persistent sessions with offline support (up to 30 days)
- **Security**: Brute-force protection, device tracking, session revocation

### Quick Start

1. Configure environment variables:

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key

   # OAuth (optional)
   APPLE_CLIENT_SECRET=your-apple-jwt
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-secret
   ```
````

2. Update `supabase/config.toml` with auth settings
3. Configure deep links in `app.config.cjs`
4. Apply database migrations (automatic)

### Documentation

- [Complete Authentication Guide](./docs/authentication/README.md)
- [OAuth Setup (Apple/Google)](./docs/authentication/oauth-setup.md)
- [Migration Guide](./docs/authentication/migration-guide.md)

### Troubleshooting

Common issues and solutions:

- **Session not persisting**: Check MMKV initialization and SecureStore availability
- **OAuth not working**: Verify redirect URIs in provider console match Supabase config
- **Deep links not opening**: Rebuild app after config changes with `npx expo prebuild --clean`

See [Authentication Guide](./docs/authentication/README.md#troubleshooting) for detailed troubleshooting.

````

## Recommended Approach

**Use Option 3** (condensed section with links) for the main README to keep it concise while providing easy access to detailed documentation.

## Additional Updates

### Update .env.example

Ensure `.env.example` includes OAuth variables:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# OAuth (optional - only needed if using Apple/Google sign in)
APPLE_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
````

### Update Project Documentation Index

If you have a documentation index (e.g., `docs/README.md`), add links to the authentication docs:

```markdown
## Documentation

- [Authentication](./authentication/README.md)
  - [OAuth Setup Guide](./authentication/oauth-setup.md)
  - [Migration Guide](./authentication/migration-guide.md)
```

### Update Contributing Guide

If you have a contributing guide, mention authentication testing requirements:

```markdown
## Testing Authentication

Before submitting PRs that touch authentication:

1. Run unit tests: `pnpm test src/api/auth src/lib/auth`
2. Run E2E tests: `maestro test .maestro/auth/`
3. Test on physical devices (OAuth requires physical devices)
4. Verify deep link handling works
5. Test offline mode with airplane mode
```

## Verification Checklist

After integration, verify:

- [ ] Main README links to authentication documentation
- [ ] `.env.example` includes OAuth variables
- [ ] Documentation is accessible and well-organized
- [ ] Links between docs work correctly
- [ ] Code examples are accurate and up-to-date
- [ ] Troubleshooting section covers common issues
- [ ] Migration guide is clear for existing users

## Notes

- The main README should remain concise - detailed docs are in `docs/authentication/`
- Keep OAuth setup in separate guide due to complexity
- Migration guide is essential for existing users upgrading
- All documentation uses kebab-case filenames per project conventions
- Documentation is written for both developers and end users where applicable
