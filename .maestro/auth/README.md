# Authentication E2E Tests

This directory contains Maestro E2E tests for the authentication flows in GrowBro.

## Test Files

### 1. `sign-up.yaml`

Tests the complete sign-up flow:

- Navigate to sign-up screen
- Fill email, password, and confirm password
- Submit form
- Verify success message
- Verify redirect to login screen

**Prerequisites:** None

**Test Data:**

- Email: `test+maestro-signup@growbro.app`
- Password: `TestPass123`

### 2. `sign-in.yaml`

Tests the complete sign-in flow:

- Fill credentials on login screen
- Submit form
- Verify navigation to home screen
- Verify auth state persists after app restart

**Prerequisites:** User account must exist with test credentials

**Test Data:**

- Email: `test+maestro@growbro.app`
- Password: `TestPass123`

### 3. `password-reset.yaml`

Tests the password reset request flow:

- Navigate to password reset screen
- Enter email
- Submit request
- Verify success message
- Verify navigation back to login

**Prerequisites:** None (success message shown regardless of email existence)

**Test Data:**

- Email: `test+maestro@growbro.app`

### 4. `revoke-session.yaml`

Tests the session revocation flow:

- Sign in
- Navigate to Settings → Security → Active Sessions
- Revoke all other sessions
- Verify success message

**Prerequisites:**

- User must be signed in
- Multiple sessions recommended for full test coverage

**Test Data:**

- Email: `test+maestro@growbro.app`
- Password: `TestPass123`

## Running Tests

### Run all auth tests

```bash
maestro test .maestro/auth/
```

### Run a specific test

```bash
maestro test .maestro/auth/sign-in.yaml
```

### Run with custom environment variables

```bash
maestro test .maestro/auth/sign-in.yaml --env EMAIL=custom@example.com --env PASSWORD=CustomPass123
```

## Test Setup

### Prerequisites

1. Install Maestro CLI: https://maestro.mobile.dev/getting-started/installing-maestro
2. Ensure app is built and installed on device/simulator
3. Set `APP_ID` environment variable (e.g., `com.growbro.app`)

### Test Data Setup

Before running tests, ensure test user accounts exist:

```bash
# Create test user via Supabase dashboard or API
# Email: test+maestro@growbro.app
# Password: TestPass123
```

## Notes

### OAuth Testing

OAuth flows (Apple/Google) are not included in automated tests due to:

- External provider dependencies
- Platform-specific authentication dialogs
- Credential management complexity

OAuth flows should be tested manually on real devices.

### Session Revocation Test

The session revocation test requires multiple active sessions. To set this up:

1. Sign in on multiple devices/simulators
2. Or sign in, sign out, sign in again to create multiple session records

### Test Isolation

Tests use `clearState` where appropriate to ensure clean state. However, some tests (like sign-in) require existing user accounts.

### Flakiness Mitigation

- Tests use `testID` props for reliable element selection
- Keyboard hiding is handled via utility flows
- Timeouts are set appropriately for async operations

## Troubleshooting

### "Element not found" errors

- Verify the app is running and on the correct screen
- Check that testID props match between test and component
- Ensure translations are loaded (tests use English strings)

### "App not installed" errors

- Verify APP_ID environment variable is set correctly
- Ensure app is built and installed on target device/simulator

### Test timeouts

- Increase timeout values in test files if needed
- Check network connectivity for API-dependent tests
- Verify Supabase backend is accessible

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Maestro Tests
  run: |
    maestro test .maestro/auth/ --format junit --output test-results/
```

## Related Documentation

- [Maestro Documentation](https://maestro.mobile.dev/)
- [GrowBro Auth Design](../../.kiro/specs/23.%20authentication-account-lifecycle/design.md)
- [GrowBro Auth Requirements](../../.kiro/specs/23.%20authentication-account-lifecycle/requirements.md)
