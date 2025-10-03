# Strains Feature Quick Reference

Quick reference guide for developers working with the Strains feature.

## File Locations

```
supabase/functions/strains-proxy/    # Edge Function
src/api/strains/                     # API client and hooks
src/components/strains/              # UI components
src/lib/strains/                     # Utilities and stores
src/lib/feature-flags.ts             # Feature flag utilities
docs/strains-*.md                    # Documentation
```

## Environment Variables

```bash
# Development (.env.development)
STRAINS_API_URL=https://the-weed-db.p.rapidapi.com/api
STRAINS_API_KEY=your_key
STRAINS_API_HOST=the-weed-db.p.rapidapi.com
STRAINS_USE_PROXY=false
FEATURE_STRAINS_ENABLED=true

# Production (.env.production)
STRAINS_USE_PROXY=true
FEATURE_STRAINS_ENABLED=false  # Start disabled
```

## Common Commands

```bash
# Deploy Edge Function
supabase functions deploy strains-proxy

# Set secrets
supabase secrets set STRAINS_API_KEY=your_key

# Run tests
pnpm test strains

# Build for staging
APP_ENV=staging pnpm build:staging:ios

# Build for production
APP_ENV=production pnpm build:production:ios
```

## API Usage

```typescript
// Fetch strains list
import { useStrainsInfinite } from '@/api/strains/use-strains-infinite';

const { data, fetchNextPage, hasNextPage } = useStrainsInfinite({
  searchQuery: 'og kush',
  filters: { race: 'hybrid' },
});

// Fetch single strain
import { useStrain } from '@/api/strains/use-strain';

const { data: strain } = useStrain('strain-id');

// Manage favorites
import { useFavorites } from '@/lib/strains/use-favorites';

const { addFavorite, removeFavorite, isFavorite } = useFavorites();
```

## Feature Flags

```typescript
import { isFeatureEnabled, useFeatureFlag } from '@/lib/feature-flags';

// Check if feature is enabled
if (isFeatureEnabled('strainsEnabled')) {
  // Show strains feature
}

// Use in React component
const strainsEnabled = useFeatureFlag('strainsEnabled');
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test integration.test.ts

# Run with coverage
pnpm test:ci

# Watch mode
pnpm test:watch
```

## Debugging

```bash
# View Edge Function logs
supabase functions logs strains-proxy

# Check secrets
supabase secrets list

# Test locally
supabase functions serve strains-proxy

# Test request
curl "http://localhost:54321/functions/v1/strains-proxy?endpoint=list"
```

## Performance Targets

- Time to Interactive: < 600ms
- List Render (100 items): < 500ms
- Frame Rate: 60fps
- API Response (p95): < 2s
- Cache Hit Rate: > 70%

## Common Issues

**Edge Function not responding:**

```bash
supabase functions logs strains-proxy
```

**API errors:**

- Check API key in secrets
- Verify rate limits
- Check network connectivity

**Performance issues:**

- Check cache hit rates
- Review image optimization
- Monitor FlashList performance

## Quick Links

- [Deployment Guide](./strains-deployment-guide.md)
- [Testing Guide](./strains-testing-guide.md)
- [Integration Checklist](./strains-integration-checklist.md)
- [Implementation Summary](./strains-implementation-summary.md)
- [Edge Function README](../supabase/functions/strains-proxy/README.md)
