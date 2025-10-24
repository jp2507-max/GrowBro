# Database Schema Documentation

## Overview

GrowBro uses Supabase (PostgreSQL) as the primary database with WatermelonDB for offline-first local storage on mobile devices. This document provides an overview of the database schema structure.

## Schema Organization

The database schema is organized into logical domains:

### Core Application Tables

- **User Management**: Authentication and user profiles
- **Plants & Harvests**: Cultivation tracking and inventory management
- **Calendar**: Task scheduling and reminders
- **Community**: Posts, comments, and social features

### Moderation & Compliance

- **Content Moderation**: DSA-compliant content moderation system
- **Audit Trails**: Complete audit logging for compliance
- **Privacy**: Data processing events and retention management

### Infrastructure

- **Sync System**: Offline/online synchronization
- **Notifications**: Push notification management
- **Analytics**: Usage analytics and reporting

## Migration History

Database schema changes are managed through Supabase migrations located in `supabase/migrations/`. Key migration files include:

### Recent Migrations (2025)

- **20251027**: Add user_id to trusted_flaggers table
- **20251026**: Create SOR submission trail view
- **20251025**: Create moderation metrics table
- **20251024**: Create moderation claims table
- **20251024**: add_unique_index_active_moderation_claims
- **20251023**: sla_alerts_incidents
- **20251023**: privacy_retention_schema
- **20251023**: notification_logging_tables
- **20251023**: monitoring_tables
- **20251022**: moderation_action_tables
- **20251022**: geo_location_schema
- **20251022**: age_verification_schema
- **20251022**: signing_key_versioning
- **20251021**: operational_tooling
- **20251021**: ods_bodies
- **20251021**: ods_escalations
- **20251021**: rpc updates
- **20251021**: export queue fix
- **20251021**: rls audit
- **20251019**: Create content reports, snapshots, moderation core schema
- **20251017**: Create community posts, comments, likes tables
- **20251015**: Create inventory tables
- **20251013**: Create nutrient engine tables
- **20251007**: Create harvests inventory tables
- **20251005**: Create community playbook templates
- **20250930**: Create analytics views, push tokens, notification queue
- **20250919**: Create notification requests
- **20250918**: Create DSR jobs, curing inventory RPC
- **20250910**: Create privacy data processing events schema

### Legacy Migrations (2024-2025)

- Various harvest, plant, and sync-related schema updates

## Key Relationships

### User-Centric Schema

```
users (auth.users)
├── plants
├── harvests
├── inventory_items
├── calendar_events
├── posts
├── comments
├── notifications
└── moderation_actions
```

### Content Moderation Schema

```
content_reports
├── moderation_claims
├── moderation_actions
├── content_snapshots
├── statements_of_reasons
└── audit_log_entries
```

## Data Flow Architecture

See `docs/architecture/data-flow.md` for detailed data flow diagrams showing how data moves between mobile clients, Supabase, and external services.

## Row Level Security (RLS)

All tables implement Row Level Security policies to ensure data privacy and access control:

- Users can only access their own data
- Moderators have controlled access to reported content
- Public content has appropriate read permissions
- Audit trails are immutable and append-only

## Performance Optimizations

- Strategic indexing on frequently queried columns
- Partitioning for large audit and log tables
- Connection pooling and query optimization
- Real-time subscriptions for live updates

## Backup and Recovery

- Point-in-time recovery enabled
- Automated daily backups
- Cross-region replication for high availability
- Comprehensive audit logging for compliance

## Related Documentation

- [Supabase Migrations](../supabase/migrations/)
- [Data Flow Architecture](data-flow.md)
- [Privacy Retention Implementation](../privacy-retention-implementation.md)
- [RLS Policy Testing Guide](../rls-policy-testing-guide.md)

## Schema Version

This documentation reflects the database schema as of October 2025. For the latest schema, refer to the most recent migrations in `supabase/migrations/`.
