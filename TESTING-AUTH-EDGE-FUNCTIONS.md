# Testing Authentication Edge Functions

This guide provides step-by-step instructions for testing the authentication Edge Functions you just implemented.

## Setup

### 1. Configure Environment Variables

Create or update your `.env.local` file with:

```bash
# Add to your existing .env.local file
RESEND_API_KEY=re_your_resend_api_key_here
```

**Get Resend API Key**:

1. Sign up at https://resend.com
2. Create an API key
3. Verify your domain or use Resend's test domain

### 2. Deploy the Edge Functions

Deploy all three new functions to your Supabase project:

```powershell
# Deploy individual functions
npx supabase functions deploy send-lockout-notification
npx supabase functions deploy revoke-session
npx supabase functions deploy revoke-all-sessions-except

# Or deploy all functions at once
npx supabase functions deploy
```

### 3. Set Environment Variables in Supabase

```powershell
# Set Resend API key
npx supabase secrets set RESEND_API_KEY=re_your_key_here

# Verify secrets are set
npx supabase secrets list
```

## Test Scenarios

### Test 1: Lockout Notification Email

**Objective**: Test that lockout notification emails are sent when an account is locked.

**Steps**:

1. **Create a test account** (use your email: jan-blohm@gmx.de):

```powershell
# Using Supabase CLI
npx supabase sql --db-url "your-db-url" --command "SELECT * FROM auth.users WHERE email = 'jan-blohm@gmx.de'"
```

Or via Supabase Dashboard → Authentication → Users → Add User

2. **Trigger lockout by failing login 5 times**:

```powershell
# PowerShell script to trigger lockout
$url = "https://your-project-id.supabase.co/functions/v1/enforce-auth-lockout"
$serviceRoleKey = "your-service-role-key"

for ($i = 1; $i -le 5; $i++) {
    Write-Host "Attempt $i of 5..."

    $body = @{
        email = "jan-blohm@gmx.de"
        password = "WrongPassword123!"
        appVersion = "1.0.0-test"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri $url -Method POST `
        -Headers @{
            "Authorization" = "Bearer $serviceRoleKey"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "Response: $($response | ConvertTo-Json)"
    Start-Sleep -Seconds 1
}
```

3. **Check your email** (jan-blohm@gmx.de) for the lockout notification

4. **Verify in database**:

```sql
-- Check lockout record
SELECT * FROM auth_lockouts WHERE email = 'jan-blohm@gmx.de';

-- Check audit log
SELECT
    event_type,
    metadata,
    created_at
FROM auth_audit_log
WHERE event_type = 'lockout'
ORDER BY created_at DESC
LIMIT 5;
```

### Test 2: Manual Lockout Notification Test

**Objective**: Test the notification function directly without triggering actual lockout.

```powershell
# Call send-lockout-notification directly
$url = "https://your-project-id.supabase.co/functions/v1/send-lockout-notification"
$serviceRoleKey = "your-service-role-key"

$lockedUntil = (Get-Date).AddMinutes(15).ToString("o")

$body = @{
    email = "jan-blohm@gmx.de"
    lockedUntil = $lockedUntil
    ipAddress = "192.168.1.0"
    userAgent = "Test-Agent/1.0"
    failedAttempts = 5
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{
        "Authorization" = "Bearer $serviceRoleKey"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "Response: $($response | ConvertTo-Json)"
```

**Expected**: You should receive an email at jan-blohm@gmx.de with lockout details.

### Test 3: Session Revocation

**Objective**: Test revoking a specific session.

**Steps**:

1. **Sign in and get a session**:

```powershell
# First, reset lockout if needed
npx supabase sql --command "SELECT reset_lockout_counter('jan-blohm@gmx.de')"

# Sign in
$url = "https://your-project-id.supabase.co/auth/v1/token?grant_type=password"
$body = @{
    email = "jan-blohm@gmx.de"
    password = "YourCorrectPassword123!"
} | ConvertTo-Json

$authResponse = Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{
        "apikey" = "your-anon-key"
        "Content-Type" = "application/json"
    } `
    -Body $body

$accessToken = $authResponse.access_token
$refreshToken = $authResponse.refresh_token
Write-Host "Access Token: $accessToken"
```

2. **Get session key** (SHA-256 of refresh token):

```powershell
# PowerShell: Calculate SHA-256
$stringAsStream = [System.IO.MemoryStream]::new()
$writer = [System.IO.StreamWriter]::new($stringAsStream)
$writer.write($refreshToken)
$writer.Flush()
$stringAsStream.Position = 0
$hash = Get-FileHash -InputStream $stringAsStream -Algorithm SHA256
$sessionKey = $hash.Hash.ToLower()
Write-Host "Session Key: $sessionKey"
```

3. **Check sessions in database**:

```sql
SELECT
    session_key,
    device_name,
    os,
    created_at,
    revoked_at
FROM user_sessions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'jan-blohm@gmx.de')
ORDER BY created_at DESC;
```

4. **Revoke the session**:

```powershell
$url = "https://your-project-id.supabase.co/functions/v1/revoke-session"

$body = @{
    sessionKey = $sessionKey
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "Revocation Response: $($response | ConvertTo-Json)"
```

5. **Verify revocation**:

```sql
-- Check session is now revoked
SELECT
    session_key,
    revoked_at
FROM user_sessions
WHERE session_key = 'your-session-key-here';

-- Check audit log
SELECT * FROM auth_audit_log
WHERE event_type = 'session_revoked'
ORDER BY created_at DESC
LIMIT 1;
```

### Test 4: Revoke All Sessions Except Current

**Objective**: Test bulk session revocation.

**Steps**:

1. **Create multiple sessions** (sign in 3 times):

```powershell
# Sign in multiple times to create multiple sessions
$sessions = @()

for ($i = 1; $i -le 3; $i++) {
    $url = "https://your-project-id.supabase.co/auth/v1/token?grant_type=password"
    $body = @{
        email = "jan-blohm@gmx.de"
        password = "YourCorrectPassword123!"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri $url -Method POST `
        -Headers @{
            "apikey" = "your-anon-key"
            "Content-Type" = "application/json"
        } `
        -Body $body

    $sessions += $response
    Write-Host "Created session $i"
    Start-Sleep -Seconds 1
}

$currentSession = $sessions[-1]  # Use last session as current
Write-Host "Current session access token: $($currentSession.access_token)"
```

2. **Calculate current session key**:

```powershell
# Calculate SHA-256 of current refresh token
$stringAsStream = [System.IO.MemoryStream]::new()
$writer = [System.IO.StreamWriter]::new($stringAsStream)
$writer.write($currentSession.refresh_token)
$writer.Flush()
$stringAsStream.Position = 0
$hash = Get-FileHash -InputStream $stringAsStream -Algorithm SHA256
$currentSessionKey = $hash.Hash.ToLower()
Write-Host "Current Session Key: $currentSessionKey"
```

3. **Revoke all other sessions**:

```powershell
$url = "https://your-project-id.supabase.co/functions/v1/revoke-all-sessions-except"

$body = @{
    currentSessionKey = $currentSessionKey
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{
        "Authorization" = "Bearer $($currentSession.access_token)"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "Bulk Revocation Response: $($response | ConvertTo-Json)"
```

4. **Verify only current session remains**:

```sql
-- Check only one session is active (not revoked)
SELECT
    session_key,
    device_name,
    created_at,
    revoked_at
FROM user_sessions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'jan-blohm@gmx.de')
ORDER BY created_at DESC;

-- Should see 1 session with revoked_at = NULL (current)
-- and others with revoked_at timestamp
```

## Quick Test Script

Create a file `test-auth-functions.ps1`:

```powershell
# Configuration
$SUPABASE_URL = "https://your-project-id.supabase.co"
$SERVICE_ROLE_KEY = "your-service-role-key"
$ANON_KEY = "your-anon-key"
$TEST_EMAIL = "jan-blohm@gmx.de"
$TEST_PASSWORD = "YourPassword123!"  # Use your actual password

Write-Host "=== Testing Auth Edge Functions ===" -ForegroundColor Cyan

# Test 1: Send Lockout Notification
Write-Host "`n[Test 1] Sending lockout notification..." -ForegroundColor Yellow

$lockedUntil = (Get-Date).AddMinutes(15).ToString("o")
$body = @{
    email = $TEST_EMAIL
    lockedUntil = $lockedUntil
    ipAddress = "192.168.1.0"
    userAgent = "PowerShell-Test/1.0"
    failedAttempts = 5
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/send-lockout-notification" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $SERVICE_ROLE_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✓ Lockout notification sent successfully!" -ForegroundColor Green
    Write-Host "  Check your email: $TEST_EMAIL" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Sign in and create session
Write-Host "`n[Test 2] Creating test session..." -ForegroundColor Yellow

try {
    $authBody = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $authResponse = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
        -Method POST `
        -Headers @{
            "apikey" = $ANON_KEY
            "Content-Type" = "application/json"
        } `
        -Body $authBody

    Write-Host "✓ Session created successfully!" -ForegroundColor Green
    Write-Host "  User ID: $($authResponse.user.id)" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Make sure to reset lockout first if account is locked" -ForegroundColor Yellow
}

Write-Host "`n=== Testing Complete ===" -ForegroundColor Cyan
Write-Host "Check Supabase Dashboard → Database → auth_audit_log for event logs" -ForegroundColor Gray
```

Run the script:

```powershell
.\test-auth-functions.ps1
```

## Monitoring & Verification

### Check Function Logs

```powershell
# View logs for each function
npx supabase functions logs send-lockout-notification --tail
npx supabase functions logs revoke-session --tail
npx supabase functions logs revoke-all-sessions-except --tail
```

### Database Queries

```sql
-- View recent lockouts
SELECT
    email,
    failed_attempts,
    locked_until,
    updated_at
FROM auth_lockouts
ORDER BY updated_at DESC
LIMIT 10;

-- View audit log
SELECT
    event_type,
    user_id,
    ip_address,
    metadata->>'email_hash' as email_hash,
    created_at
FROM auth_audit_log
WHERE event_type IN ('lockout', 'session_revoked')
ORDER BY created_at DESC
LIMIT 20;

-- View active sessions
SELECT
    u.email,
    s.device_name,
    s.os,
    s.created_at,
    s.revoked_at
FROM user_sessions s
JOIN auth.users u ON u.id = s.user_id
WHERE u.email = 'jan-blohm@gmx.de'
ORDER BY s.created_at DESC;
```

## Troubleshooting

### Email not received?

1. Check spam folder
2. Verify RESEND_API_KEY is set: `npx supabase secrets list`
3. Check function logs: `npx supabase functions logs send-lockout-notification`
4. Verify Resend domain is verified at https://resend.com/domains

### Session revocation not working?

1. Verify session key calculation matches (SHA-256 of refresh token)
2. Check user_sessions table has records
3. Verify Authorization header includes valid access token
4. Check function logs for errors

### "Method not allowed" errors?

- Ensure you're using POST method
- Check URL is correct with `/functions/v1/` path

## Clean Up Test Data

```sql
-- Remove test data
DELETE FROM user_sessions WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'jan-blohm@gmx.de'
);

DELETE FROM auth_lockouts WHERE email = 'jan-blohm@gmx.de';

-- Optional: Delete test user
-- DELETE FROM auth.users WHERE email = 'jan-blohm@gmx.de';
```

## Next Steps

Once testing is complete:

1. ✅ Verify all functions work as expected
2. ✅ Check email notifications arrive correctly
3. ✅ Confirm audit logs are created
4. ✅ Test session revocation in mobile app
5. ✅ Update environment variables for production
6. ✅ Deploy to production environment

---

For more details, see `supabase/functions/README-auth-functions.md`
