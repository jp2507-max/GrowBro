/**
 * Integration Tests for Authentication Edge Functions
 *
 * Tests the following Edge Functions:
 * - capture-device-metadata: Device metadata capture on sign in
 * - enforce-auth-lockout: Lockout enforcement after failed attempts
 * - send-lockout-notification: Lockout notification email
 * - revoke-session: Session revocation
 * - revoke-all-sessions-except: Bulk session revocation
 *
 * Requirements:
 * - 6.1: Test device metadata capture on sign in
 * - 8.1: Test lockout enforcement after 5 failed attempts
 * - 8.5: Test lockout notification email sent
 *
 * Note: These are integration tests that require a running Supabase instance.
 * Run with: deno test --allow-net --allow-env
 */

import { assertEquals, assertExists } from 'jsr:@std/assert';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Test configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TEST_EMAIL = 'test-auth-lockout@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const WRONG_PASSWORD = 'WrongPassword123!';

let supabase: SupabaseClient;

// Helper to hash email for database operations
async function hashEmailForLookup(email: string): Promise<string> {
  const salt = 'growbro_auth_lockout_salt_v1';
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Helper to clean up test data
async function cleanupTestData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Delete test user if exists
  const { data: users } = await supabase
    .from('auth.users')
    .select('id')
    .eq('email', TEST_EMAIL);

  if (users && users.length > 0) {
    const userId = users[0].id;

    // Delete user sessions
    await supabase.from('user_sessions').delete().eq('user_id', userId);

    // Delete lockout records (use email hash)
    const emailHash = await hashEmailForLookup(TEST_EMAIL);
    await supabase.from('auth_lockouts').delete().eq('email_hash', emailHash);

    // Delete audit logs
    await supabase.from('auth_audit_log').delete().eq('user_id', userId);

    // Delete user
    await supabase.rpc('delete_user', { user_id: userId });
  }
}

// Setup before tests
Deno.test('Setup: Initialize Supabase client', () => {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  assertExists(supabase);
});

// Cleanup before running tests
Deno.test('Setup: Clean up test data', async () => {
  await cleanupTestData();
});

/**
 * Test 1: Device Metadata Capture (Requirement 6.1)
 */
Deno.test('Edge Function: capture-device-metadata - captures device info on sign in', async () => {
  // Create test user first
  const { data: signUpData, error: signUpError } =
    await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

  assertEquals(signUpError, null, 'User creation should succeed');
  assertExists(signUpData.user);

  // Sign in to get refresh token
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

  assertEquals(signInError, null, 'Sign in should succeed');
  assertExists(signInData.session);

  // Call capture-device-metadata Edge Function
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/capture-device-metadata`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'User-Agent': 'Test-Agent/1.0 (iOS 17.0; iPhone 14 Pro)',
      },
      body: JSON.stringify({
        userId: signUpData.user.id,
        sessionKey: await deriveSessionKey(signInData.session.refresh_token),
        userAgent: 'Test-Agent/1.0 (iOS 17.0; iPhone 14 Pro)',
        appVersion: '1.0.0',
      }),
    }
  );

  assertEquals(response.status, 200, 'Device metadata capture should succeed');

  const result = await response.json();
  assertEquals(result.success, true);

  // Verify session was recorded in database
  const { data: sessions, error: sessionsError } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', signUpData.user.id);

  assertEquals(sessionsError, null);
  assertEquals(sessions?.length, 1, 'Should have one session recorded');
  assertExists(sessions?.[0].device_name);
  assertExists(sessions?.[0].os);
  assertEquals(sessions?.[0].app_version, '1.0.0');
});

/**
 * Test 2: Lockout Enforcement (Requirement 8.1)
 */
Deno.test('Edge Function: enforce-auth-lockout - locks account after 5 failed attempts', async () => {
  // Ensure test user exists
  const { data: userData } = await supabase.auth.admin.listUsers();
  const testUser = userData.users.find((u) => u.email === TEST_EMAIL);
  assertExists(testUser, 'Test user should exist');

  // Attempt 5 failed logins
  for (let i = 0; i < 5; i++) {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/enforce-auth-lockout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: WRONG_PASSWORD,
          appVersion: '1.0.0',
        }),
      }
    );

    assertEquals(response.status, 401, 'Failed login should return 401');

    const result = await response.json();
    assertEquals(result.code, 'INVALID_CREDENTIALS');

    // Check if locked on 5th attempt
    if (i === 4) {
      assertExists(result.metadata?.lockout);
      assertEquals(
        result.metadata.lockout,
        true,
        'Account should be locked after 5 attempts'
      );
      assertExists(result.metadata.minutes_remaining);
    }
  }

  // Verify lockout record exists in database
  const emailHash = await hashEmailForLookup(TEST_EMAIL);
  const { data: lockout, error: lockoutError } = await supabase
    .from('auth_lockouts')
    .select('*')
    .eq('email_hash', emailHash)
    .single();

  assertEquals(lockoutError, null);
  assertExists(lockout);
  assertEquals(lockout.failed_attempts, 5);
  assertExists(lockout.locked_until);

  // Try to login again - should still be locked
  const lockedResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/enforce-auth-lockout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD, // Even with correct password
        appVersion: '1.0.0',
      }),
    }
  );

  assertEquals(lockedResponse.status, 401);
  const lockedResult = await lockedResponse.json();
  assertEquals(
    lockedResult.metadata?.lockout,
    true,
    'Account should remain locked'
  );
});

/**
 * Test 3: Lockout Notification Email (Requirement 8.5)
 */
Deno.test('Edge Function: send-lockout-notification - sends email on lockout', async () => {
  // Get lockout record
  const emailHash = await hashEmailForLookup(TEST_EMAIL);
  const { data: lockout } = await supabase
    .from('auth_lockouts')
    .select('*')
    .eq('email_hash', emailHash)
    .single();

  assertExists(lockout);

  // Call send-lockout-notification Edge Function
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/send-lockout-notification`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        lockedUntil: lockout.locked_until,
        ipAddress: '192.168.1.0', // Truncated IP
        userAgent: 'Test-Agent/1.0',
        failedAttempts: lockout.failed_attempts,
      }),
    }
  );

  assertEquals(response.status, 200, 'Notification should be sent');

  const result = await response.json();
  assertEquals(result.success, true);

  // Verify audit log entry was created
  const { data: auditLogs } = await supabase
    .from('auth_audit_log')
    .select('*')
    .eq('event_type', 'lockout')
    .order('created_at', { ascending: false })
    .limit(1);

  assertExists(auditLogs);
  assertEquals(auditLogs.length, 1);
  assertEquals(auditLogs[0].event_type, 'lockout');
  assertExists(auditLogs[0].metadata);
});

/**
 * Test 4: Session Revocation (Requirement 6.3)
 */
Deno.test('Edge Function: revoke-session - revokes specific session', async () => {
  // Get test user
  const { data: userData } = await supabase.auth.admin.listUsers();
  const testUser = userData.users.find((u) => u.email === TEST_EMAIL);
  assertExists(testUser);

  // Get user session
  const { data: sessions } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', testUser.id)
    .limit(1);

  assertExists(sessions);
  assertEquals(sessions.length >= 1, true, 'Should have at least one session');

  const sessionToRevoke = sessions[0];

  // Sign in to get auth token
  // First reset lockout
  await supabase.rpc('reset_lockout_counter', { p_email: TEST_EMAIL });

  const { data: signInData } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  assertExists(signInData.session);

  // Call revoke-session Edge Function
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/revoke-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signInData.session.access_token}`,
      },
      body: JSON.stringify({
        sessionKey: sessionToRevoke.session_key,
      }),
    }
  );

  assertEquals(response.status, 200, 'Session revocation should succeed');

  const result = await response.json();
  assertEquals(result.success, true);
  assertExists(result.revoked_at);

  // Verify session was marked as revoked
  const { data: revokedSession } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('id', sessionToRevoke.id)
    .single();

  assertExists(revokedSession);
  assertExists(revokedSession.revoked_at);

  // Verify audit log
  const { data: auditLogs } = await supabase
    .from('auth_audit_log')
    .select('*')
    .eq('event_type', 'session_revoked')
    .order('created_at', { ascending: false })
    .limit(1);

  assertExists(auditLogs);
  assertEquals(auditLogs.length >= 1, true);
});

/**
 * Test 5: Revoke All Sessions Except Current (Requirement 6.4)
 */
Deno.test('Edge Function: revoke-all-sessions-except - revokes all but current', async () => {
  // Get test user
  const { data: userData } = await supabase.auth.admin.listUsers();
  const testUser = userData.users.find((u) => u.email === TEST_EMAIL);
  assertExists(testUser);

  // Create multiple sessions by signing in multiple times
  // (In reality this would be from different devices)
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    assertExists(signInData.session);
    sessions.push(signInData.session);

    // Capture device metadata for each session
    await fetch(`${SUPABASE_URL}/functions/v1/capture-device-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        userId: testUser.id,
        sessionKey: await deriveSessionKey(signInData.session.refresh_token),
        appVersion: '1.0.0',
      }),
    });
  }

  // Use last session as "current"
  const currentSession = sessions[sessions.length - 1];

  // Derive current session key
  const currentSessionKey = await deriveSessionKey(
    currentSession.refresh_token
  );

  // Call revoke-all-sessions-except Edge Function
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/revoke-all-sessions-except`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({
        currentSessionKey,
      }),
    }
  );

  assertEquals(response.status, 200, 'Bulk revocation should succeed');

  const result = await response.json();
  assertEquals(result.success, true);
  assertEquals(result.revoked_count >= 2, true, 'Should revoke at least 2 sessions');

  // Verify only current session is not revoked
  const { data: activeSessions } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', testUser.id)
    .is('revoked_at', null);

  assertEquals(activeSessions?.length, 1, 'Only one session should be active');
  assertEquals(activeSessions?.[0].session_key, currentSessionKey);
});

/**
 * Cleanup after all tests
 */
Deno.test('Cleanup: Remove test data', async () => {
  await cleanupTestData();
});

/**
 * Helper to derive session key (matches app logic)
 */
async function deriveSessionKey(refreshToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(refreshToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
