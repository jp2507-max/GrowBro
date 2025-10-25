// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-App-Platform, X-App-Version, X-Device-Tier, If-None-Match',
};

const headerSchema = z.object({
  authorization: z
    .string()
    .min(1, 'Authorization header required')
    .transform((value) => value.replace(/^Bearer\s+/i, 'Bearer ')),
  platform: z
    .string()
    .optional()
    .transform((value) => value?.toLowerCase())
    .pipe(z.enum(['ios', 'android', 'universal']).catch('universal')),
  deviceTier: z.string().trim().min(1).optional(),
});

const thresholdRowSchema = z.object({
  id: z.string().uuid(),
  platform: z.enum(['ios', 'android', 'universal']),
  device_tier: z.string().nullable(),
  blur_min_variance: z.number(),
  blur_severe_variance: z.number(),
  blur_weight: z.number(),
  exposure_under_max_ratio: z.number(),
  exposure_over_max_ratio: z.number(),
  exposure_range_min: z.number(),
  exposure_range_max: z.number(),
  exposure_weight: z.number(),
  white_balance_max_deviation: z.number(),
  white_balance_severe_deviation: z.number(),
  white_balance_weight: z.number(),
  composition_min_plant_coverage: z.number(),
  composition_min_center_coverage: z.number(),
  composition_weight: z.number(),
  acceptable_score: z.number(),
  borderline_score: z.number(),
  version: z.number(),
  rollout_percentage: z.number().int().min(0).max(100),
  updated_at: z.string(),
});

const thresholdsResponseSchema = z.object({
  thresholds: z.object({
    blur: z.object({
      minVariance: z.number(),
      severeVariance: z.number(),
      weight: z.number(),
    }),
    exposure: z.object({
      underExposureMaxRatio: z.number(),
      overExposureMaxRatio: z.number(),
      acceptableRange: z.tuple([z.number(), z.number()]),
      weight: z.number(),
    }),
    whiteBalance: z.object({
      maxDeviation: z.number(),
      severeDeviation: z.number(),
      weight: z.number(),
    }),
    composition: z.object({
      minPlantCoverage: z.number(),
      minCenterCoverage: z.number(),
      weight: z.number(),
    }),
    acceptableScore: z.number(),
    borderlineScore: z.number(),
  }),
  version: z.number(),
  updatedAt: z.string(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  etag: z.string().optional(),
});

export type QualityThresholdRow = z.infer<typeof thresholdRowSchema>;

export function pickBestThreshold(
  rows: QualityThresholdRow[],
  platform: 'ios' | 'android' | 'universal',
  deviceTier: string | undefined
): QualityThresholdRow | undefined {
  if (!rows.length) return undefined;
  const normalizedTier = deviceTier?.toLowerCase();

  const prioritisedMatches: ((row: QualityThresholdRow) => boolean)[] = [
    (row) =>
      row.platform === platform &&
      (row.device_tier?.toLowerCase() ?? null) === normalizedTier,
    (row) => row.platform === platform && row.device_tier === null,
    (row) =>
      row.platform === 'universal' &&
      (row.device_tier?.toLowerCase() ?? null) === normalizedTier,
    (row) => row.platform === 'universal' && row.device_tier === null,
  ];

  for (const matcher of prioritisedMatches) {
    const match = rows.find(matcher);
    if (match) return match;
  }

  return rows[0];
}

function mapRowToPayload(row: QualityThresholdRow) {
  return {
    thresholds: {
      blur: {
        minVariance: row.blur_min_variance,
        severeVariance: row.blur_severe_variance,
        weight: row.blur_weight,
      },
      exposure: {
        underExposureMaxRatio: row.exposure_under_max_ratio,
        overExposureMaxRatio: row.exposure_over_max_ratio,
        acceptableRange: [row.exposure_range_min, row.exposure_range_max] as [
          number,
          number,
        ],
        weight: row.exposure_weight,
      },
      whiteBalance: {
        maxDeviation: row.white_balance_max_deviation,
        severeDeviation: row.white_balance_severe_deviation,
        weight: row.white_balance_weight,
      },
      composition: {
        minPlantCoverage: row.composition_min_plant_coverage,
        minCenterCoverage: row.composition_min_center_coverage,
        weight: row.composition_weight,
      },
      acceptableScore: row.acceptable_score,
      borderlineScore: row.borderline_score,
    },
    version: row.version,
    updatedAt: row.updated_at,
    rolloutPercentage: row.rollout_percentage ?? undefined,
  } as const;
}

function createSupabaseClient(
  serviceKey: string,
  url: string,
  authorization?: string
) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authorization
      ? {
          headers: {
            Authorization: authorization,
          },
        }
      : undefined,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const headers = headerSchema.parse({
      authorization: req.headers.get('Authorization') ?? '',
      platform: req.headers.get('X-App-Platform') ?? undefined,
      deviceTier: req.headers.get('X-Device-Tier') ?? undefined,
    });
    const ifNoneMatch = req.headers.get('If-None-Match') ?? undefined;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Supabase configuration missing SUPABASE_URL or SERVICE_ROLE'
      );
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const supabaseAuthClient = createSupabaseClient(
      serviceRoleKey,
      supabaseUrl,
      headers.authorization
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          Vary: 'Authorization, X-App-Platform, X-Device-Tier',
        },
      });
    }

    const supabase = createSupabaseClient(serviceRoleKey, supabaseUrl);

    const platforms =
      headers.platform === 'universal'
        ? ['universal']
        : [headers.platform, 'universal'];

    const { data, error } = await supabase
      .from('quality_thresholds')
      .select('*')
      .in('platform', platforms)
      .order('version', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to query quality_thresholds:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to load configuration' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const rows = z.array(thresholdRowSchema).parse(data ?? []);
    const match = pickBestThreshold(rows, headers.platform, headers.deviceTier);

    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Quality configuration not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            Vary: 'Authorization, X-App-Platform, X-Device-Tier',
          },
        }
      );
    }

    const eTag = `${match.id}:${match.updated_at}`;

    if (ifNoneMatch && ifNoneMatch === eTag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          ETag: eTag,
          Vary: 'Authorization, X-App-Platform, X-Device-Tier',
        },
      });
    }

    const payload = thresholdsResponseSchema.parse({
      ...mapRowToPayload(match),
      etag: eTag,
    });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...corsHeaders,
        ETag: eTag,
        Vary: 'Authorization, X-App-Platform, X-Device-Tier',
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message =
      error instanceof z.ZodError ? 'Invalid request' : 'Internal server error';
    if (!(error instanceof z.ZodError)) {
      console.error('quality-config error:', error);
    }

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        Vary: 'Authorization, X-App-Platform, X-Device-Tier',
      },
    });
  }
});
