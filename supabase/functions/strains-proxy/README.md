# Strains Proxy Edge Function

This Supabase Edge Function acts as a secure proxy for The Weed DB API, providing:

- **API Key Protection**: Keeps API credentials server-side
- **Rate Limiting**: 30 requests per minute per IP address
- **Response Caching**: 5 minutes for lists, 24 hours for details
- **ETag Support**: Efficient cache validation with If-None-Match headers
- **Request Normalization**: Consistent response format across different API versions

## Environment Variables

Required environment variables (set in Supabase dashboard):

```bash
STRAINS_API_KEY=your_rapidapi_key_here
STRAINS_API_HOST=the-weed-db.p.rapidapi.com
STRAINS_API_BASE_URL=https://the-weed-db.p.rapidapi.com
```

## API Endpoints

### GET /strains-proxy

Query parameters:

- `endpoint`: 'list' | 'detail' (required)
- `strainId`: Strain ID (required for detail endpoint)
- `page`: Page number (default: 0)
- `pageSize`: Items per page (default: 20)
- `cursor`: Pagination cursor (optional)
- `search`: Search query (optional)
- `type`: Filter by race (indica/sativa/hybrid)
- `effects`: Comma-separated effects
- `flavors`: Comma-separated flavors
- `difficulty`: Filter by difficulty (beginner/intermediate/advanced)
- `thc_min`, `thc_max`: THC percentage range
- `cbd_min`, `cbd_max`: CBD percentage range
- `sort_by`: Sort field (optional)
- `sort_direction`: 'asc' | 'desc' (default: 'asc')

### POST /strains-proxy

Request body:

```json
{
  "endpoint": "list",
  "page": 0,
  "pageSize": 20,
  "searchQuery": "og kush",
  "filters": {
    "race": "hybrid",
    "effects": ["relaxed", "happy"],
    "difficulty": "beginner",
    "thcMin": 15,
    "thcMax": 25
  },
  "sortBy": "name",
  "sortDirection": "asc"
}
```

## Response Format

### List Response

```json
{
  "strains": [...],
  "hasMore": true,
  "nextCursor": "abc123",
  "cached": false
}
```

### Detail Response

```json
{
  "strain": {...},
  "cached": false
}
```

### Error Response

```json
{
  "error": "Error message"
}
```

## Rate Limiting

- **Limit**: 30 requests per minute per IP
- **Response**: 429 Too Many Requests
- **Headers**: `Retry-After` header indicates seconds to wait

## Caching

- **List endpoints**: 5 minute TTL
- **Detail endpoints**: 24 hour TTL
- **ETag support**: Send `If-None-Match` header for cache validation
- **304 Not Modified**: Returned when cached content is still valid

## Deployment

Deploy using Supabase CLI:

```bash
supabase functions deploy strains-proxy
```

Set environment variables:

```bash
supabase secrets set STRAINS_API_KEY=your_key_here
supabase secrets set STRAINS_API_HOST=the-weed-db.p.rapidapi.com
supabase secrets set STRAINS_API_BASE_URL=https://the-weed-db.p.rapidapi.com
```

## Testing

Test locally:

```bash
supabase functions serve strains-proxy
```

Test request:

```bash
curl "http://localhost:54321/functions/v1/strains-proxy?endpoint=list&pageSize=10"
```

## Performance Considerations

- In-memory cache limited to 100 entries (LRU eviction)
- Rate limit map cleaned up automatically on window expiry
- Responses compressed automatically by Supabase Edge Runtime
- CDN-friendly Cache-Control headers for client-side caching
