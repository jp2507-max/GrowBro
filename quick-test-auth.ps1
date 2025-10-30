# Quick Test Script for Auth Edge Functions
# Usage: .\quick-test-auth.ps1

Write-Host "=== GrowBro Auth Edge Functions - Quick Test ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
Write-Host "Please provide the following information:" -ForegroundColor Yellow
$SUPABASE_URL = Read-Host "Supabase URL (e.g., https://abc123.supabase.co)"
$SERVICE_ROLE_KEY = Read-Host "Service Role Key (from Supabase Dashboard → Settings → API)" -AsSecureString
$SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SERVICE_ROLE_KEY))

$TEST_EMAIL = "test.user@example.com"

Write-Host ""
Write-Host "Testing with email: $TEST_EMAIL" -ForegroundColor Green
Write-Host ""

# Test 1: Send Lockout Notification
Write-Host "[Test 1/3] Testing lockout notification email..." -ForegroundColor Yellow

$lockedUntil = (Get-Date).AddMinutes(15).ToString("o")
$body = @{
    email = $TEST_EMAIL
    lockedUntil = $lockedUntil
    ipAddress = "192.168.1.0"
    userAgent = "PowerShell-QuickTest/1.0"
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
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "  ✓ SUCCESS: Lockout notification sent!" -ForegroundColor Green
    Write-Host "  → Check your email: $TEST_EMAIL" -ForegroundColor Cyan
    Write-Host "  → Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
}
catch {
    Write-Host "  ✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  → Status Code: $statusCode" -ForegroundColor Gray
    }
}

Write-Host ""

# Test 2: Verify Function Deployment
Write-Host "[Test 2/3] Checking if functions are deployed..." -ForegroundColor Yellow

$functions = @(
    "send-lockout-notification",
    "revoke-session",
    "revoke-all-sessions-except"
)

foreach ($func in $functions) {
    try {
        $response = Invoke-WebRequest `
            -Uri "$SUPABASE_URL/functions/v1/$func" `
            -Method GET `
            -Headers @{
                "Authorization" = "Bearer $SERVICE_ROLE_KEY"
            } `
            -ErrorAction Stop
        
        # GET should return 405 Method Not Allowed if function exists
        if ($response.StatusCode -eq 405) {
            Write-Host "  ✓ $func is deployed" -ForegroundColor Green
        }
    }
catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq 405) {
            Write-Host "  ✓ $func is deployed" -ForegroundColor Green
        }
        elseif ($statusCode -eq 404) {
            Write-Host "  ✗ $func NOT FOUND - needs deployment" -ForegroundColor Red
        }
        else {
            Write-Host "  ? $func - Status: $statusCode" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  ✗ $func - ERROR: No response received - $($_.Exception.Message)" -ForegroundColor Red
    }
}
}

Write-Host ""

# Test 3: Check Database Tables
Write-Host "[Test 3/3] Verifying database schema..." -ForegroundColor Yellow
Write-Host "  Run these SQL queries in Supabase Dashboard → SQL Editor:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  -- Check lockout record" -ForegroundColor Gray
Write-Host "  SELECT * FROM auth_lockouts WHERE email = '$TEST_EMAIL';" -ForegroundColor White
Write-Host ""
Write-Host "  -- Check audit log" -ForegroundColor Gray
Write-Host "  SELECT event_type, metadata, created_at" -ForegroundColor White
Write-Host "  FROM auth_audit_log" -ForegroundColor White
Write-Host "  WHERE event_type = 'lockout'" -ForegroundColor White
Write-Host "  ORDER BY created_at DESC LIMIT 5;" -ForegroundColor White
Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Check your email inbox (test.user@example.com) for lockout notification" -ForegroundColor White
Write-Host "  2. Verify audit logs in Supabase Dashboard" -ForegroundColor White
Write-Host "  3. If functions not deployed, run:" -ForegroundColor White
Write-Host "     npx supabase functions deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "For detailed testing, see: TESTING-AUTH-EDGE-FUNCTIONS.md" -ForegroundColor Cyan
Write-Host ""

# Pause to keep window open
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
