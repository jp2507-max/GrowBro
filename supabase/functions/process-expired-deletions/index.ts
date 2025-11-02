/**
 * Supabase Edge Function: Process Expired Deletion Requests
 * Requirements: 6.8 - Permanent deletion after grace period
 *
 * Scheduled function that runs daily to process account deletion requests
 * that have passed their grace period (30 days).
 *
 * Flow:
 * 1. Find all pending deletion requests where scheduled_for <= NOW()
 * 2. For each expired request:
 *    - Mark request as 'completed'
 *    - Call delete-account Edge Function to perform actual deletion
 *    - Log audit entry
 *    - Send confirmation email (if email available)
 * 3. Return summary of processed/failed deletions
 *
 * This function should be invoked by Supabase pg_cron:
 * SELECT cron.schedule(
 *   'process-expired-deletions',
 *   '0 2 * * *', -- Run at 2 AM daily
 *   $$SELECT net.http_post(
 *     url:='https://your-project.supabase.co/functions/v1/process-expired-deletions',
 *     headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
 *   ) AS request_id;$$
 * );
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ProcessedResult {
  success: boolean;
  processed_count: number;
  failed_count: number;
  errors?: {
    request_id: string;
    user_id: string;
    error: string;
  }[];
}

Deno.serve(async (req: Request) => {
  try {
    // Verify this is a POST request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify service role authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Service role required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all pending deletion requests that have expired
    const { data: expiredRequests, error: fetchError } = await supabase
      .from('account_deletion_requests')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      console.error('Failed to fetch expired deletion requests:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch expired deletion requests',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!expiredRequests || expiredRequests.length === 0) {
      console.log('No expired deletion requests to process');
      return new Response(
        JSON.stringify({
          success: true,
          processed_count: 0,
          failed_count: 0,
        } as ProcessedResult),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `Processing ${expiredRequests.length} expired deletion requests`
    );

    let processedCount = 0;
    let failedCount = 0;
    const errors: {
      request_id: string;
      user_id: string;
      error: string;
    }[] = [];

    // Process each expired deletion request
    for (const request of expiredRequests) {
      try {
        console.log(
          `Processing deletion request ${request.request_id} for user ${request.user_id}`
        );

        // Mark request as completed first to prevent reprocessing
        const { error: updateError } = await supabase
          .from('account_deletion_requests')
          .update({ status: 'completed' })
          .eq('request_id', request.request_id);

        if (updateError) {
          throw new Error(
            `Failed to update request status: ${updateError.message}`
          );
        }

        // Get user data before deletion for email notification
        const { data: userData } = await supabase.auth.admin.getUserById(
          request.user_id
        );
        const userEmail = userData?.user?.email;

        // Delete the user account (this triggers CASCADE deletes)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(
          request.user_id
        );

        if (deleteError) {
          throw new Error(`Failed to delete user: ${deleteError.message}`);
        }

        // Log successful deletion to audit log
        await supabase.from('audit_logs').insert({
          user_id: request.user_id,
          event_type: 'account_deleted',
          payload: {
            request_id: request.request_id,
            scheduled_for: request.scheduled_for,
            deleted_at: new Date().toISOString(),
            automated: true,
          },
        });

        // Send confirmation email if email is available
        if (userEmail) {
          try {
            // TODO: Implement email sending via your email service
            // await sendDeletionConfirmationEmail(userEmail, request.request_id);
            console.log(
              `Would send deletion confirmation email to ${userEmail}`
            );
          } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't fail the deletion if email fails
          }
        }

        processedCount++;
        console.log(
          `Successfully processed deletion request ${request.request_id}`
        );
      } catch (error) {
        failedCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Failed to process deletion request ${request.request_id}:`,
          errorMessage
        );

        errors.push({
          request_id: request.request_id,
          user_id: request.user_id,
          error: errorMessage,
        });

        // Revert status back to pending if deletion failed
        try {
          await supabase
            .from('account_deletion_requests')
            .update({ status: 'pending' })
            .eq('request_id', request.request_id);
        } catch (revertError) {
          console.error('Failed to revert request status:', revertError);
        }
      }
    }

    console.log(`Processed ${processedCount} deletions, ${failedCount} failed`);

    const result: ProcessedResult = {
      success: failedCount === 0,
      processed_count: processedCount,
      failed_count: failedCount,
    };

    if (errors.length > 0) {
      result.errors = errors;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in process-expired-deletions function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
