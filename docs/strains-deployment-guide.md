# Strains Feature Deployment Guide

This guide covers the deployment process for the Strains Browser feature, including environment configuration, Edge Function deployment, and gradual rollout strategy.

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Supabase project set up
- RapidAPI account with The Weed DB API access (for development)
- EAS CLI installed (`npm install -g eas-cli`)

## 1. Environment Configuration

### Development Environment

Development uses direct API access for faster iteration:

```bash
# .env.development
STRAINS_API_URL=https://the-weed-db.p.rapidapi.com/api
STRAINS_API_KEY=your_rapidapi_key_here
STRAINS_API_HOST=the-weed-db.p.rapidapi.com
STRAINS_USE_PROXY=false

FEATURE_STRAINS_ENABLED=true
FEATURE_STRAINS_FAVORITES_SYNC=true
FEATURE_STRAINS_OFFLINE_CACHE=true
```

### Staging Environment

Staging uses the proxy to test production-like behavior:

```bash
# .env.staging
STRAINS_USE_PROXY=true

FEATURE_STRAINS_ENABLED=true
FEATURE_STRAINS_FAVORITES_SYNC=true
FEATURE_STRAINS_OFFLINE_CACHE=true
```

### Production Environment

Production always uses the proxy and starts with feature disabled:

```bash
# .env.production
STRAINS_USE_PROXY=true

# Start with feature disabled for gradual rollout
FEATURE_STRAINS_ENABLED=false
FEATURE_STRAINS_FAVORITES_SYNC=true
FEATURE_STRAINS_OFFLINE_CACHE=true
```

## 2. Deploy Supabase Edge Function

### Step 1: Link Supabase Project

```bash
supabase link --project-ref your-project-ref
```

### Step 2: Set Environment Secrets

```bash
# Set API credentials
supabase secrets set STRAINS_API_KEY=your_rapidapi_key_here
supabase secrets set STRAINS_API_HOST=the-weed-db.p.rapidapi.com
supabase secrets set STRAINS_API_BASE_URL=https://the-weed-db.p.rapidapi.com
```

### Step 3: Deploy Edge Function

```bash
# Deploy strains-proxy function
supabase functions deploy strains-proxy

# Verify deployment
supabase functions list
```

### Step 4: Test Edge Function

```bash
# Test list endpoint
curl "https://your-project.supabase.co/functions/v1/strains-proxy?endpoint=list&pageSize=5"

# Test detail endpoint
curl "https://your-project.supabase.co/functions/v1/strains-proxy?endpoint=detail&strainId=some-strain-id"

# Test with filters
curl "https://your-project.supabase.co/functions/v1/strains-proxy?endpoint=list&type=hybrid&pageSize=10"
```

## 3. EAS Build Configuration

The strains feature is automatically included in all build profiles. No changes to `eas.json` are required.

### Build for Development

```bash
pnpm build:development:ios
pnpm build:development:android
```

### Build for Staging

```bash
pnpm build:staging:ios
pnpm build:staging:android
```

### Build for Production

```bash
pnpm build:production:ios
pnpm build:production:android
```

## 4. Gradual Rollout Strategy

### Phase 1: Internal Testing (Week 1)

1. Deploy to staging with feature enabled
2. Test all functionality with internal team
3. Monitor Edge Function performance and costs
4. Verify offline functionality
5. Test on various devices and network conditions

```bash
# Staging build
APP_ENV=staging pnpm build:staging:ios
APP_ENV=staging pnpm build:staging:android
```

### Phase 2: Beta Testing (Week 2-3)

1. Deploy to production with feature disabled
2. Enable feature for beta testers using feature flag
3. Monitor analytics and error rates
4. Collect user feedback
5. Fix any critical issues

```bash
# Production build with feature disabled
APP_ENV=production pnpm build:production:ios
APP_ENV=production pnpm build:production:android
```

### Phase 3: Gradual Rollout (Week 4-6)

1. Enable feature for 10% of users
2. Monitor for 2-3 days
3. Increase to 25% if stable
4. Monitor for 2-3 days
5. Increase to 50% if stable
6. Monitor for 2-3 days
7. Increase to 100% if stable

To enable for all users, update `.env.production`:

```bash
FEATURE_STRAINS_ENABLED=true
EXPO_PUBLIC_FEATURE_STRAINS_ENABLED=true
```

Then rebuild and submit:

```bash
APP_ENV=production pnpm build:production:ios
APP_ENV=production pnpm build:production:android
```

## 5. Monitoring and Observability

### Key Metrics to Monitor

1. **Edge Function Performance**
   - Request latency (p50, p95, p99)
   - Error rate
   - Cache hit rate
   - Rate limit hits

2. **Client Performance**
   - Time to first strain load
   - FlashList FPS
   - Image load times
   - Offline cache hit rate

3. **User Engagement**
   - Strains viewed
   - Search queries
   - Filters used
   - Favorites added
   - Detail page views

4. **Error Tracking**
   - API errors
   - Network errors
   - Parsing errors
   - Cache errors

### Monitoring Tools

- **Supabase Dashboard**: Edge Function logs and metrics
- **Sentry**: Error tracking and performance monitoring
- **Analytics**: Custom events for user behavior

### Alerts to Set Up

1. Edge Function error rate > 5%
2. Edge Function p95 latency > 2s
3. Rate limit hits > 100/hour
4. Client error rate > 2%

## 6. Rollback Plan

If critical issues are discovered:

### Quick Rollback (Feature Flag)

Disable feature immediately without new build:

```bash
# Update production environment
FEATURE_STRAINS_ENABLED=false
EXPO_PUBLIC_FEATURE_STRAINS_ENABLED=false
```

Note: This requires an OTA update or app restart to take effect.

### Full Rollback (App Update)

1. Revert to previous app version in App Store/Play Store
2. Investigate and fix issues
3. Re-deploy when ready

## 7. Cost Considerations

### RapidAPI Costs

- Monitor API usage in RapidAPI dashboard
- Set up billing alerts
- Consider upgrading plan if needed

### Supabase Costs

- Edge Function invocations
- Bandwidth usage
- Database storage (for favorites)

### Optimization Tips

1. Leverage caching to reduce API calls
2. Use ETag headers for efficient cache validation
3. Implement rate limiting to prevent abuse
4. Monitor and optimize image sizes
5. Use CDN for static assets

## 8. Post-Deployment Checklist

- [ ] Edge Function deployed and tested
- [ ] Environment variables configured for all stages
- [ ] Feature flags set appropriately
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Team trained on rollout process
- [ ] Rollback plan tested
- [ ] Beta testers identified
- [ ] Communication plan ready
- [ ] Support team briefed

## 9. Troubleshooting

### Edge Function Not Responding

```bash
# Check function logs
supabase functions logs strains-proxy

# Verify secrets are set
supabase secrets list

# Test locally
supabase functions serve strains-proxy
```

### High Error Rate

1. Check Sentry for error patterns
2. Review Edge Function logs
3. Verify API credentials
4. Check rate limits
5. Review network conditions

### Poor Performance

1. Check cache hit rates
2. Review image optimization
3. Monitor FlashList performance
4. Check network latency
5. Review database query performance

## 10. Future Enhancements

- [ ] Implement A/B testing framework
- [ ] Add user-specific feature flags
- [ ] Implement progressive rollout automation
- [ ] Add more granular analytics
- [ ] Optimize caching strategy
- [ ] Add CDN for images
- [ ] Implement GraphQL for more efficient queries
