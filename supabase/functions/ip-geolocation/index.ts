/**
 * IP Geolocation Supabase Edge Function
 * Provides IP-based geolocation with VPN detection
 * Part of Task 10: Geo-Location Service (Requirement 9.1)
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

interface GeolocationResponse {
  country: string;
  region?: string;
  city?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  confidence: number;
  vpnDetected?: boolean;
}

interface IPApiResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  proxy?: boolean;
  hosting?: boolean;
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Parse request body
    const body = await req.json();
    const { ipAddress, includeVpnCheck } = body;

    // Get IP address from request if not provided
    const targetIp =
      ipAddress ||
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip');

    if (!targetIp) {
      return new Response(
        JSON.stringify({ error: 'Unable to determine IP address' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Call IP geolocation API (using ip-api.com free tier)
    // In production, consider using paid services like IPHub, MaxMind, or ipapi.co
    const geoResponse = await fetch(
      `http://ip-api.com/json/${targetIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting`
    );

    if (!geoResponse.ok) {
      throw new Error(`Geolocation API error: ${geoResponse.statusText}`);
    }

    const geoData: IPApiResponse = await geoResponse.json();

    if (geoData.status !== 'success') {
      throw new Error('Geolocation lookup failed');
    }

    // Check for VPN/proxy if requested
    let vpnDetected = false;
    if (includeVpnCheck) {
      // Basic VPN detection using hosting/proxy flags from ip-api.com
      // In production, use dedicated VPN detection services (IPHub, IPQualityScore)
      vpnDetected = geoData.proxy === true || geoData.hosting === true;

      // Additional check: suspicious ISP names
      const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud'];
      const ispLower = (geoData.isp || '').toLowerCase();
      const orgLower = (geoData.org || '').toLowerCase();

      if (
        vpnKeywords.some(
          (keyword) => ispLower.includes(keyword) || orgLower.includes(keyword)
        )
      ) {
        vpnDetected = true;
      }
    }

    // Build response
    const response: GeolocationResponse = {
      country: geoData.countryCode,
      region: geoData.regionName,
      city: geoData.city,
      timezone: geoData.timezone,
      latitude: geoData.lat,
      longitude: geoData.lon,
      confidence: 0.9, // Fixed confidence for IP-based lookup
      vpnDetected,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('IP geolocation error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to determine location',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
