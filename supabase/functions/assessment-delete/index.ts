import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  assessmentId: string;
  reason?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: DeleteRequest = await req.json();
    const { assessmentId, reason = 'user_initiated' } = body;

    if (!assessmentId) {
      return new Response(JSON.stringify({ error: 'Missing assessmentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership (RLS will enforce this, but double-check)
    const { data: assessment, error: fetchError } = await supabaseClient
      .from('assessments')
      .select('id, user_id, images')
      .eq('id', assessmentId)
      .single();

    if (fetchError || !assessment) {
      return new Response(JSON.stringify({ error: 'Assessment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (assessment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete assessment images from storage
    const images = assessment.images as string[];
    if (images && images.length > 0) {
      const { error: storageError } = await supabaseClient.storage
        .from('assessment-images')
        .remove(images);

      if (storageError) {
        console.error('Failed to delete images:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // Delete assessment record from database (soft delete via RLS)
    const { error: deleteError } = await supabaseClient
      .from('assessments')
      .delete()
      .eq('id', assessmentId);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete assessment' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log deletion audit
    await supabaseClient.from('audit_log').insert({
      user_id: user.id,
      action: 'assessment_delete',
      resource_type: 'assessment',
      resource_id: assessmentId,
      metadata: { reason },
    });

    return new Response(
      JSON.stringify({
        success: true,
        assessmentId,
        deletedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Assessment deletion error:', error);
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
