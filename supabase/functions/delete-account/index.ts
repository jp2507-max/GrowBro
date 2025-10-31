import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DeleteAccountRequest {
  user_id: string;
}

interface DeleteAccountResponse {
  success: boolean;
  deleted_counts?: {
    user_sessions: number;
    auth_lockouts: number;
    auth_audit_logs: number;
    // Add other entity counts as needed
  };
  error?: string;
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { user_id }: DeleteAccountRequest = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const deletedCounts = {
      user_sessions: 0,
      auth_lockouts: 0,
      auth_audit_logs: 0,
    };

    // Log deletion event to audit log before deleting user (GDPR compliance)
    await supabase.from('auth_audit_log').insert({
      user_id,
      event_type: 'account_deleted',
      metadata: {
        timestamp: new Date().toISOString(),
        initiated_by: 'user',
      },
    });

    // Delete user sessions
    const { error: sessionsError, count: sessionsCount } = await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', user_id);

    if (sessionsError) {
      console.error('Failed to delete user_sessions:', sessionsError);
      // Continue with deletion even if this fails
    } else {
      deletedCounts.user_sessions = sessionsCount || 0;
    }

    // Delete auth lockouts
    // Note: This deletes by email_hash, so we need to get user email first
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (userData?.user?.email) {
      const { error: lockoutsError, count: lockoutsCount } = await supabase
        .from('auth_lockouts')
        .delete()
        .eq('email', userData.user.email);

      if (lockoutsError) {
        console.error('Failed to delete auth_lockouts:', lockoutsError);
      } else {
        deletedCounts.auth_lockouts = lockoutsCount || 0;
      }
    }

    // Delete audit logs for this user (except the deletion event we just created)
    const { error: auditError, count: auditCount } = await supabase
      .from('auth_audit_log')
      .delete()
      .eq('user_id', user_id)
      .neq('event_type', 'account_deleted');

    if (auditError) {
      console.error('Failed to delete auth_audit_log:', auditError);
    } else {
      deletedCounts.auth_audit_logs = auditCount || 0;
    }

    // TODO: Add deletion for other user data tables
    // - plants
    // - harvests
    // - posts
    // - photos
    // - tasks
    // - etc.
    // These should have ON DELETE CASCADE in the schema for automatic cleanup

    // Delete user from auth.users (triggers cascading deletes)
    const { error: deleteUserError } =
      await supabase.auth.admin.deleteUser(user_id);

    if (deleteUserError) {
      console.error('Failed to delete user from auth:', deleteUserError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to delete user account',
        } as DeleteAccountResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `Successfully deleted account for user ${user_id}. Counts:`,
      deletedCounts
    );

    return new Response(
      JSON.stringify({
        success: true,
        deleted_counts: deletedCounts,
      } as DeleteAccountResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error deleting account:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as DeleteAccountResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
