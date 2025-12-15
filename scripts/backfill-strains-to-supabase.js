/**
 * One-off backfill script: fetch all strains from the proxy and upsert into Supabase strain_cache.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... STRAINS_API_KEY=... node scripts/backfill-strains-to-supabase.js
 *
 * Notes:
 * - Uses the strains-proxy to normalize formats and handle cursor pagination.
 * - Writes with service role key; do NOT ship this key to clients.
 * - Throttles requests and retries on transient failures.
 */

import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRAINS_API_KEY = process.env.STRAINS_API_KEY;
const STRAINS_API_HOST =
  process.env.STRAINS_API_HOST || 'the-weed-db.p.rapidapi.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
}

if (!STRAINS_API_KEY) {
  throw new Error('Missing STRAINS_API_KEY env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const API_BASE =
  process.env.STRAINS_API_URL || 'https://the-weed-db.p.rapidapi.com/api';
const PAGE_SIZE = 200; // tune down if you hit rate limits
const MAX_RETRIES = 3;

async function fetchPage(cursor) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
  });
  if (cursor) params.set('cursor', cursor);

  const url = `${API_BASE}/strains?${params.toString()}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'x-rapidapi-key': STRAINS_API_KEY,
          'x-rapidapi-host': STRAINS_API_HOST,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();

      // Normalize variants:
      // - Proxy style: { strains, hasMore, nextCursor }
      // - RapidAPI direct style: { data: [...], next: 'url' }
      // - Bare array
      let strains = [];
      let nextCursor = undefined;
      let hasMore = false;

      if (Array.isArray(data?.strains)) {
        strains = data.strains;
        hasMore = Boolean(data.hasMore);
        nextCursor = data.nextCursor;
      } else if (Array.isArray(data?.data)) {
        strains = data.data;
        hasMore = Boolean(data.next);
        if (data.next) {
          try {
            const nextUrl = new URL(data.next);
            nextCursor = nextUrl.searchParams.get('cursor') || undefined;
          } catch {
            nextCursor = undefined;
          }
        }
      } else if (Array.isArray(data)) {
        strains = data;
        hasMore = data.length === PAGE_SIZE;
      } else {
        throw new Error('Unexpected response shape');
      }

      return { strains, hasMore, nextCursor };
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      const delayMs = 500 * Math.pow(2, attempt);
      console.warn(`[fetchPage] attempt ${attempt + 1} failed: ${err.message}`);
      if (isLast) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function upsertBatch(strains) {
  if (!strains.length) return 0;

  const payload = strains.map((s) => {
    const id = s._id || s.id || s.slug || s.name;
    const slug =
      s.slug || s.name?.toString().trim().toLowerCase().replace(/\s+/g, '-');
    return {
      id: String(id),
      slug: String(slug),
      name: String(s.name || 'Unknown'),
      race: s.race || null,
      data: s,
    };
  });

  const { error, count } = await supabase
    .from('strain_cache')
    .upsert(payload, { onConflict: 'id', count: 'exact' });

  if (error) {
    console.error('[upsertBatch] failed', error);
    throw error;
  }

  return count ?? payload.length;
}

async function main() {
  console.log('Starting backfill...');
  let cursor = undefined;
  let total = 0;
  let page = 0;

  while (true) {
    page += 1;
    console.log(`Fetching page ${page} cursor=${cursor ?? '<start>'}`);
    const { strains, hasMore, nextCursor } = await fetchPage(cursor);
    console.log(`  fetched ${strains.length} strains`);

    const written = await upsertBatch(strains);
    total += written;
    console.log(`  upserted ${written} strains (total ${total})`);

    if (!hasMore || !nextCursor) {
      console.log('No more pages. Done.');
      break;
    }
    cursor = nextCursor;
    await new Promise((r) => setTimeout(r, 200)); // small pacing delay
  }

  console.log(`Backfill complete. Total strains upserted: ${total}`);
}

main().catch((err) => {
  console.error('Backfill failed', err);
  process.exit(1);
});
