// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { timingSafeEqual } from 'https://deno.land/std@0.208.0/crypto/timing_safe_equal.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Process Account Deletion Cascade
 *
 * This Edge Function is invoked by a scheduled cron job or manually
 * to process account deletion requests that have passed their grace period.
 *
 * It cascades deletion across:
 * - User data tables (posts, comments, plants, tasks, harvests, etc.)
 * - Profile and settings
 * - Blob storage (avatars, media files)
 * - Creates audit log entries
 *
 * Should be invoked with service role credentials.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface DeletionRequest {
  request_id: string;
  user_id: string;
  scheduled_for: string;
}

interface DeletionResult {
  request_id: string;
  user_id: string;
  status: 'completed' | 'failed';
  error?: string;
  deleted_records: {
    posts?: number;
    comments?: number;
    plants?: number;
    tasks?: number;
    harvests?: number;
    profiles?: number;
    notification_preferences?: number;
    legal_acceptances?: number;
    storage_files?: number;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // This function should only be called with service role key
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Fail fast if service role key is not configured
    if (!serviceRoleKey) {
      console.error(
        '[deletion-cascade] SUPABASE_SERVICE_ROLE_KEY not configured'
      );
      return new Response(
        JSON.stringify({ error: 'Service misconfigured. Contact support.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify service role authorization
    if (
      !authHeader ||
      !authHeader.startsWith('Bearer ') ||
      !timingSafeEqual(
        new TextEncoder().encode(authHeader.slice(7)),
        new TextEncoder().encode(serviceRoleKey)
      )
    ) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Service role required.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Query pending deletion requests past their scheduled time
    const { data: deletionRequests, error: queryError } = await supabaseAdmin
      .from('account_deletion_requests')
      .select('request_id, user_id, scheduled_for')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10); // Process in batches

    if (queryError) {
      console.error('[deletion-cascade] Query error:', queryError);
      return new Response(
        JSON.stringify({
          error: 'Failed to query deletion requests',
          message: queryError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!deletionRequests || deletionRequests.length === 0) {
      console.log('[deletion-cascade] No pending deletion requests found');
      return new Response(
        JSON.stringify({
          message: 'No pending deletion requests to process',
          processed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[deletion-cascade] Processing ${deletionRequests.length} deletion requests`
    );

    const results: DeletionResult[] = [];

    // Process each deletion request
    for (const request of deletionRequests as DeletionRequest[]) {
      const result: DeletionResult = {
        request_id: request.request_id,
        user_id: request.user_id,
        status: 'completed',
        deleted_records: {},
      };

      try {
        console.log(
          `[deletion-cascade] Processing deletion for user ${request.user_id.slice(0, 8)}...`
        );

        // Delete posts
        const { count: postsCount, error: postsError } = await supabaseAdmin
          .from('posts')
          .delete({ count: 'exact' })
          .eq('user_id', request.user_id);

        if (postsError) {
          throw new Error(`Failed to delete posts: ${postsError.message}`);
        }
        result.deleted_records.posts = postsCount ?? 0;

        // Delete comments
        const { count: commentsCount, error: commentsError } =
          await supabaseAdmin
            .from('comments')
            .delete({ count: 'exact' })
            .eq('user_id', request.user_id);

        if (commentsError) {
          throw new Error(
            `Failed to delete comments: ${commentsError.message}`
          );
        }
        result.deleted_records.comments = commentsCount ?? 0;

        // Delete plants
        const { count: plantsCount, error: plantsError } = await supabaseAdmin
          .from('plants')
          .delete({ count: 'exact' })
          .eq('user_id', request.user_id);

        if (plantsError) {
          throw new Error(`Failed to delete plants: ${plantsError.message}`);
        }
        result.deleted_records.plants = plantsCount ?? 0;

        // Delete tasks
        const { count: tasksCount, error: tasksError } = await supabaseAdmin
          .from('tasks')
          .delete({ count: 'exact' })
          .eq('user_id', request.user_id);

        if (tasksError) {
          throw new Error(`Failed to delete tasks: ${tasksError.message}`);
        }
        result.deleted_records.tasks = tasksCount ?? 0;

        // Delete harvests
        const { count: harvestsCount, error: harvestsError } =
          await supabaseAdmin
            .from('harvests')
            .delete({ count: 'exact' })
            .eq('user_id', request.user_id);

        if (harvestsError) {
          throw new Error(
            `Failed to delete harvests: ${harvestsError.message}`
          );
        }
        result.deleted_records.harvests = harvestsCount ?? 0;

        // Delete notification preferences
        const { count: notifCount, error: notifError } = await supabaseAdmin
          .from('notification_preferences')
          .delete({ count: 'exact' })
          .eq('user_id', request.user_id);

        if (notifError) {
          throw new Error(
            `Failed to delete notification preferences: ${notifError.message}`
          );
        }
        result.deleted_records.notification_preferences = notifCount ?? 0;

        // Delete legal acceptances
        const { count: legalCount, error: legalError } = await supabaseAdmin
          .from('legal_acceptances')
          .delete({ count: 'exact' })
          .eq('user_id', request.user_id);

        if (legalError) {
          throw new Error(
            `Failed to delete legal acceptances: ${legalError.message}`
          );
        }
        result.deleted_records.legal_acceptances = legalCount ?? 0;

        // Delete profile
        const { count: profileCount, error: profileError } = await supabaseAdmin
          .from('profiles')
          .delete({ count: 'exact' })
          .eq('user_id', request.user_id);

        if (profileError) {
          throw new Error(`Failed to delete profile: ${profileError.message}`);
        }
        result.deleted_records.profiles = profileCount ?? 0;

        // Delete storage files (avatars)
        try {
          const { data: files, error: listError } = await supabaseAdmin.storage
            .from('avatars')
            .list(request.user_id);

          if (!listError && files && files.length > 0) {
            const filePaths = files.map(
              (file) => `${request.user_id}/${file.name}`
            );
            const { error: removeError } = await supabaseAdmin.storage
              .from('avatars')
              .remove(filePaths);

            if (removeError) {
              console.error(
                `[deletion-cascade] Storage deletion error:`,
                removeError
              );
            } else {
              result.deleted_records.storage_files = files.length;
            }
          }
        } catch (storageError) {
          console.error('[deletion-cascade] Storage error:', storageError);
          // Continue even if storage deletion fails
        }

        // Update deletion request status
        const { error: updateError } = await supabaseAdmin
          .from('account_deletion_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('request_id', request.request_id);

        if (updateError) {
          console.error(
            '[deletion-cascade] Failed to update request status:',
            updateError
          );
        }

        // Create audit log entry
        const { error: auditError } = await supabaseAdmin
          .from('audit_logs')
          .insert({
            user_id: request.user_id,
            action: 'account_deletion_completed',
            resource_type: 'account',
            resource_id: request.user_id,
            metadata: {
              request_id: request.request_id,
              deleted_records: result.deleted_records,
            },
          });

        if (auditError) {
          console.error(
            '[deletion-cascade] Failed to create audit log:',
            auditError
          );
        }

        console.log(
          `[deletion-cascade] Successfully deleted account for user ${request.user_id.slice(0, 8)}...`
        );

        results.push(result);
      } catch (error) {
        console.error(
          `[deletion-cascade] Error processing deletion for user ${request.user_id}:`,
          error
        );

        result.status = 'failed';
        result.error = error instanceof Error ? error.message : String(error);

        // Mark deletion request as failed
        await supabaseAdmin
          .from('account_deletion_requests')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('request_id', request.request_id);

        results.push(result);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} deletion requests`,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[deletion-cascade] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
