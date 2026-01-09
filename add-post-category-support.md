# Add Category/Strain Support to Community Posts

## Summary

The hardcoded "Sativa" badge in post cards has been removed and replaced with conditional rendering based on optional `strain` or `category` fields. However, these fields need to be properly implemented in the backend and database schema.

## Current State

- ✅ Post type now includes optional `strain?: string` and `category?: string` fields
- ✅ Post card conditionally renders badge only when these fields exist
- ✅ Database schema includes `strain` and `category` fields
- ❌ Backend API doesn't handle these fields yet

## Required Changes

### 1. Database Schema

Add `strain` and `category` columns to the `posts` table:

```sql
ALTER TABLE public.posts
ADD COLUMN strain TEXT,
ADD COLUMN category TEXT;
```

### 2. Backend API

Update post creation and retrieval endpoints to handle the new fields.

### 3. Frontend Integration

- Update post creation form to include strain/category selection
- Integrate with existing `strain_cache` table for strain data
- Consider adding validation for strain names against the cache

## Implementation Notes

### Strain Data Source

The `strain_cache` table already exists with strain information including:

- `id`: Primary identifier
- `name`: Display name (e.g., "Blue Dream")
- `race`: Strain type (Sativa/Indica/Hybrid)
- `data`: JSON with additional strain metadata

### UI Considerations

- Badge should prioritize `strain` over `category` if both exist
- Consider using `race` from strain_cache for automatic categorization
- Ensure consistent styling with existing badge design

## Acceptance Criteria

- [x] Database schema updated with strain/category columns
- [ ] API endpoints support strain/category fields
- [ ] Post creation UI includes strain selection
- [ ] Badge displays correct strain/category information
- [ ] Strain data is validated against strain_cache where applicable

## Related Issues

- This builds on the existing `strain_cache` table infrastructure
- Consider integration with plant tracking features for strain consistency
