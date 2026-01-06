# Test Cases for Strain and Category Validation

## Test 1: Valid strain and category

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-post \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Test post with valid strain and category",
    "strain": "Blue Dream",
    "category": "Hybrid"
  }'
```

Expected: 201 Created

## Test 2: Invalid strain (too long)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-post \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Test post with long strain",
    "strain": "This is a very long strain name that exceeds one hundred characters and should be rejected by the validation"
  }'
```

Expected: 400 Bad Request - "Strain name cannot exceed 100 characters"

## Test 3: Invalid category

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-post \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Test post with invalid category",
    "category": "InvalidCategory"
  }'
```

Expected: 400 Bad Request - "Invalid category. Must be one of: Indica, Sativa, Hybrid"

## Test 4: Non-existent strain

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-post \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Test post with non-existent strain",
    "strain": "NonExistentStrain123"
  }'
```

Expected: 400 Bad Request - "Invalid strain name"

## Test 5: Valid category (case-sensitive)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-post \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Test post with valid category",
    "category": "Indica"
  }'
```

Expected: 201 Created
