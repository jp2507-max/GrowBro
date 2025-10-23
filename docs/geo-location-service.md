# Geo-Location Service Documentation

## Overview

The Geo-Location Service provides privacy-first geographic content filtering with DSA compliance. It implements IP-based geolocation (default), optional GPS location with explicit consent, regional content filtering, VPN detection, and author notifications for geo-restrictions.

**Part of**: Task 10 - Community Moderation DSA Notice-and-Action  
**Requirements**: 9.1-9.7 (Geo-Visibility Controls)

## Key Features

- **IP Geolocation (Default)**: Server-side location detection without user consent
- **GPS Location (Opt-in)**: High-precision location with explicit user consent
- **Regional Content Filtering**: Automatic content visibility control based on location
- **VPN/Proxy Detection**: Configurable detection with 1-hour cache TTL
- **Signal Mismatch Resolution**: Most restrictive setting applied when IP and device region differ
- **Author Notifications**: Alerts to content creators about regional restrictions (Requirement 9.7)
- **Appeal Flow**: Process for contesting false positive restrictions (Requirement 9.6)
- **Cache Management**: 1-hour location cache with automatic expiry

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Client                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useGeoLocation Hook                                  │   │
│  │ - IP location (default)                              │   │
│  │ - GPS location (with consent)                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ useContentAvailability Hook                          │   │
│  │ - Check content visibility                           │   │
│  │ - Get geo-restriction explainer                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   GeoLocationService                         │
│  - detectUserLocationIP()                                    │
│  - requestGPSLocation()                                      │
│  - checkContentAvailability()                                │
│  - applyGeoRestriction()                                     │
│  - notifyGeoRestriction()                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions                     │
│  - ip-geolocation: IP lookup + VPN detection                │
│  - detect-vpn: Dedicated VPN/proxy detection                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL                         │
│  - geo_restrictions: Content restrictions by region          │
│  - geo_location_cache: Cached location data (1h TTL)        │
│  - geo_restriction_rules: Region-specific rules             │
│  - geo_restriction_appeals: Appeal tracking                 │
│  - geo_restriction_notifications: Notification audit        │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### `geo_restrictions`

Stores content-specific geographic restrictions with lawful basis.

| Column             | Type        | Description                                       |
| ------------------ | ----------- | ------------------------------------------------- |
| id                 | UUID        | Primary key                                       |
| content_id         | UUID        | Reference to restricted content                   |
| content_type       | TEXT        | Type: 'post', 'comment', 'user_content'           |
| restricted_regions | TEXT[]      | ISO 3166-1 alpha-2 codes (e.g., ['DE', 'FR'])     |
| permitted_regions  | TEXT[]      | Explicitly permitted regions (optional)           |
| lawful_basis       | TEXT        | Legal reference or policy citation                |
| reason_code        | TEXT        | Category: illegal_content, policy_violation, etc. |
| include_in_sor     | BOOLEAN     | Include in Statement of Reasons                   |
| applied_by         | UUID        | Moderator or system that applied restriction      |
| expires_at         | TIMESTAMPTZ | Optional expiry for time-limited restrictions     |

#### `geo_location_cache`

Caches user location data with configurable TTL (default 1 hour).

| Column           | Type        | Description                                      |
| ---------------- | ----------- | ------------------------------------------------ |
| id               | UUID        | Primary key                                      |
| user_id          | UUID        | Reference to user                                |
| location_method  | TEXT        | Method: 'ip', 'gps', 'device_region'             |
| location_data    | JSONB       | Location details (country, region, city, coords) |
| vpn_detected     | BOOLEAN     | VPN/proxy detection result                       |
| confidence_score | NUMERIC     | 0.0 to 1.0 confidence level                      |
| expires_at       | TIMESTAMPTZ | Cache expiry timestamp                           |

#### `geo_restriction_rules`

Defines region-specific content filtering rules with versioning.

| Column         | Type        | Description                                    |
| -------------- | ----------- | ---------------------------------------------- |
| id             | UUID        | Primary key                                    |
| region_code    | TEXT        | ISO 3166-1 alpha-2 or 'EU' for EU-wide         |
| rule_type      | TEXT        | e.g., 'cannabis_content', 'age_restricted'     |
| rule_config    | JSONB       | Flexible configuration (action, min_age, etc.) |
| lawful_basis   | TEXT        | Legal reference                                |
| priority       | INTEGER     | Higher priority = applied first                |
| effective_from | TIMESTAMPTZ | Rule effective date                            |
| expires_at     | TIMESTAMPTZ | Optional rule expiry                           |

#### `geo_restriction_appeals`

Tracks appeals for false positive geo-restrictions.

| Column              | Type        | Description                               |
| ------------------- | ----------- | ----------------------------------------- |
| id                  | UUID        | Primary key                               |
| restriction_id      | UUID        | Reference to geo_restrictions             |
| user_id             | UUID        | User submitting appeal                    |
| appeal_reason       | TEXT        | Explanation for appeal                    |
| supporting_evidence | JSONB       | Evidence documents (location proof, etc.) |
| status              | TEXT        | pending, under_review, upheld, rejected   |
| reviewer_id         | UUID        | Moderator reviewing appeal                |
| resolved_at         | TIMESTAMPTZ | Appeal resolution timestamp               |

## Usage

### Client-Side (React Native)

#### Get User Location (IP-based, default)

```typescript
import { useGeoLocation } from '@/lib/moderation/use-geo-location';

function MyComponent() {
  const { location, isLoading, error } = useGeoLocation();

  if (isLoading) return <Text>Detecting location...</Text>;
  if (error) return <Text>Location unavailable</Text>;

  return <Text>Your region: {location?.location.country}</Text>;
}
```

#### Request GPS Location (with consent)

```typescript
import { useGeoLocation } from '@/lib/moderation/use-geo-location';

function NearbyGrowersButton() {
  const { requestGpsLocation, isLoading } = useGeoLocation();

  const handlePress = async () => {
    const gpsLocation = await requestGpsLocation('Show nearby growers');
    if (gpsLocation) {
      console.log('GPS location:', gpsLocation.location.coords);
    }
  };

  return (
    <Button onPress={handlePress} disabled={isLoading}>
      Find Nearby Growers
    </Button>
  );
}
```

#### Check Content Availability

```typescript
import { useContentAvailability } from '@/lib/moderation/use-geo-location';

function ContentDisplay({ contentId }: { contentId: string }) {
  const { data: availability, isLoading } = useContentAvailability(contentId);

  if (isLoading) return <Loading />;

  if (!availability?.available) {
    return (
      <View>
        <Text>Content Not Available</Text>
        <Text>{availability?.explainerText}</Text>
        <Text>Lawful Basis: {availability?.lawfulBasis}</Text>
      </View>
    );
  }

  return <ContentView contentId={contentId} />;
}
```

#### Submit Geo-Restriction Appeal

```typescript
import { useSubmitGeoAppeal } from '@/lib/moderation/use-geo-location';

function AppealForm({ restrictionId }: { restrictionId: string }) {
  const { mutate, isLoading } = useSubmitGeoAppeal();
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    mutate({
      restrictionId,
      userId: currentUserId,
      appealReason: reason,
      supportingEvidence: {
        locationType: 'passport',
        locationProof: ['document-url-1'],
      },
    });
  };

  return (
    <View>
      <TextInput value={reason} onChangeText={setReason} placeholder="Appeal reason" />
      <Button onPress={handleSubmit} disabled={isLoading}>
        Submit Appeal
      </Button>
    </View>
  );
}
```

### Server-Side (Moderation)

#### Apply Geo-Restriction

```typescript
import { geoLocationService } from '@/lib/moderation/geo-location-service';

// Apply restriction to content
await geoLocationService.applyGeoRestriction(
  'content-123',
  ['FR', 'DE'], // Restricted regions
  true // Include in Statement of Reasons
);
```

#### Notify Author

```typescript
import { geoLocationService } from '@/lib/moderation/geo-location-service';

// Notify author about regional restriction
await geoLocationService.notifyGeoRestriction('author-user-id', 'content-123', [
  'FR',
  'DE',
]);
```

#### Check Content Availability (server-side)

```typescript
import { geoLocationService } from '@/lib/moderation/geo-location-service';

const location = { country: 'FR', region: 'Île-de-France' };
const availability = await geoLocationService.checkContentAvailability(
  'content-123',
  location
);

if (!availability.available) {
  console.log('Reason:', availability.reason);
  console.log('Explainer:', availability.explainerText);
}
```

## Configuration

### Environment Variables

Configuration is managed via `src/lib/moderation/geo-config.ts` and can be overridden with environment variables:

| Variable                   | Type    | Default  | Description                                          |
| -------------------------- | ------- | -------- | ---------------------------------------------------- |
| `GEO_VPN_BLOCKING_ENABLED` | boolean | false    | Enable VPN/proxy detection and blocking              |
| `GEO_CACHE_TTL_MS`         | number  | 3600000  | Cache TTL in milliseconds (1 hour)                   |
| `GEO_RULE_UPDATE_SLA_MS`   | number  | 14400000 | Rule update SLA in milliseconds (4 hours)            |
| `GEO_IP_PROVIDER`          | string  | supabase | IP geolocation provider: ipapi, supabase, cloudflare |
| `GEO_CONFIDENCE_THRESHOLD` | number  | 0.7      | Minimum confidence for location data (0.0-1.0)       |

### Region Codes

Use ISO 3166-1 alpha-2 codes for all region references:

- `EU`: Automatically expands to all EU member states
- `DE`: Germany
- `FR`: France
- `US`: United States
- etc.

## Compliance

### DSA Article 17 Integration

When `includeInSoR: true`, geo-restrictions are automatically included in Statement of Reasons sent to users. The system:

1. Applies geo-restriction to content
2. Generates SoR with affected regions and lawful basis
3. Notifies content author
4. Submits redacted SoR to EC Transparency Database

### Data Minimization (GDPR)

- **IP-based location**: No consent required; only stores country/region, not IP address
- **GPS location**: Explicit consent required; purpose logged for audit
- **Cache expiry**: Location data automatically deleted after TTL (default 1 hour)
- **Audit trail**: All access to location data is logged

### Appeal Rights (DSA Article 20)

Users can appeal geo-restrictions through:

1. In-app appeal submission (`useSubmitGeoAppeal` hook)
2. Supporting evidence upload (passport, travel documents)
3. Human review by moderator (different from original decision-maker)
4. Audit trail for compliance

## Testing

### Run Tests

```bash
# Run geo-location service tests
pnpm test geo-location-service

# Run with coverage
pnpm test geo-location-service -- --coverage

# Run hooks tests
pnpm test use-geo-location
```

### Test Coverage

Target: ≥85% for service layer, ≥75% for hooks

Current coverage:

- `geo-location-service.ts`: TBD
- `use-geo-location.ts`: TBD
- `geo-notification.ts`: TBD

## Troubleshooting

### GPS Permission Denied

**Problem**: GPS location request fails with permission denied error.

**Solution**: Ensure explicit consent flow is shown to user before requesting GPS. Check `useGpsPermission` hook for permission status.

### VPN Detection False Positives

**Problem**: Users on corporate networks flagged as VPN.

**Solution**:

1. Lower `GEO_CONFIDENCE_THRESHOLD` in configuration
2. Provide appeal flow for false positives
3. Consider disabling VPN blocking (`GEO_VPN_BLOCKING_ENABLED=false`)

### Cache Not Expiring

**Problem**: Location cache persists beyond TTL.

**Solution**:

1. Run cleanup function: `SELECT cleanup_expired_geo_location_cache();`
2. Check `GEO_CACHE_TTL_MS` configuration
3. Verify database trigger is active

### Content Visible in Restricted Region

**Problem**: Content appears despite geo-restriction.

**Solution**:

1. Check `geo_restrictions` table for active restrictions
2. Verify region code format (ISO 3166-1 alpha-2)
3. Clear location cache: `DELETE FROM geo_location_cache WHERE user_id = ?`
4. Check RLS policies on `geo_restrictions` table

## Performance Considerations

### Cache Strategy

- **IP location**: Cached for 1 hour (configurable)
- **VPN detection**: Cached for 1 hour
- **Content availability**: Queried on demand, cached by React Query

### Database Indexes

Key indexes for performance:

- `idx_geo_restrictions_content_active_regions`: Fast content availability checks
- `idx_geo_location_cache_user_active`: One active cache per user
- `idx_geo_restriction_rules_region_active`: Active rule lookups

### Optimization Tips

1. **Batch operations**: Use `batchNotifyAuthors` for bulk notifications
2. **Query caching**: React Query caches availability checks (1h staleTime)
3. **Edge functions**: IP geolocation runs at edge for low latency
4. **RLS policies**: Ensure indexes support RLS filters

## Roadmap

### Planned Enhancements

- [ ] Integration with EUDI wallet for privacy-preserving age verification
- [ ] Support for dynamic geo-fencing (real-time boundary checks)
- [ ] Advanced VPN detection using ML models
- [ ] Multi-region SoR translations
- [ ] Automated rule updates from legal compliance feeds

### Known Limitations

- IP geolocation accuracy: ~95% for country, ~75% for city
- VPN detection confidence: ~80% (free tier)
- GPS requires React Native client (not available server-side)

## Support

For issues or questions:

1. Check this documentation
2. Review test files for usage examples
3. Check Supabase logs for edge function errors
4. Open GitHub issue with reproduction steps
