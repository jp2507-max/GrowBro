# WatermelonDB Setup Guide

## Overview

GrowBro uses WatermelonDB for offline-first local storage, including the inventory and consumables feature. WatermelonDB requires **custom native code** (JSI adapter) and therefore **cannot run in Expo Go**. You must create a development build.

## Prerequisites

- **Development build required**: The app uses `@morrowdigital/watermelondb-expo-plugin` to enable the JSI adapter for native performance
- **Cannot use Expo Go**: Native code modifications require a custom development build
- Expo SDK 54 or later
- React Native 0.81.4 or later

## Setup Instructions

### 1. Dependencies

Dependencies are already configured in `package.json`:

```json
{
  "dependencies": {
    "@nozbe/watermelondb": "^0.28.0",
    "@nozbe/simdjson": "^3.9.4",
    "expo-build-properties": "1.0.9"
  }
}
```

If you need to reinstall:

```bash
npx expo install @nozbe/watermelondb @nozbe/simdjson expo-build-properties
```

### 2. Expo Config Plugin

WatermelonDB native requirements are configured in `app.config.cjs`:

```javascript
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    // ... other plugins
    [
      'expo-build-properties',
      {
        ios: {
          extraPods: [
            {
              name: 'simdjson',
              path: '../node_modules/@nozbe/simdjson',
              modular_headers: true,
            },
          ],
        },
        android: {
          packagingOptions: {
            pickFirst: ['**/libc++_shared.so'],
          },
        },
      },
    ],
  ],
});
```

**IMPORTANT**: A CI guard (`scripts/ci-watermelondb-plugin-guard.js`) validates this configuration and will fail if simdjson or the libc++ `pickFirst` entry is missing.

### 3. Create Development Build

Since WatermelonDB requires native code, you must create a development build:

#### Local Development Build

**iOS:**

```bash
pnpm run prebuild:development
pnpm run ios
```

**Android:**

```bash
pnpm run prebuild:development
pnpm run android
```

#### EAS Development Build

**iOS:**

```bash
pnpm run build:development:ios
```

**Android:**

```bash
pnpm run build:development:android
```

After the build completes, install it on your device and use `pnpm start` to connect.

### 4. Verify Setup

The CI guard script checks configuration automatically:

```bash
pnpm run compliance:watermelondb-guard
```

This script verifies:

- ✅ Plugin is in `app.config.cjs`
- ✅ Dependencies are in `package.json`
- ✅ Configuration matches requirements

## Database Schema

WatermelonDB tables are defined in `src/lib/watermelon-schema.ts`. Current schema version: **20**

### Inventory Tables (Added in v20)

- **`inventory_items`**: Items/products with category, unit, tracking mode
- **`inventory_batches`**: Lot-based batches with expiry dates and costs
- **`inventory_movements`**: Immutable audit trail of all inventory changes

### Models

Models are in `src/lib/watermelon-models/`:

- `inventory-item.ts` - InventoryItemModel
- `inventory-batch.ts` - InventoryBatchModel
- `inventory-movement.ts` - InventoryMovementModel

## Migrations

Migrations are in `src/lib/watermelon-migrations.ts`. Schema versions:

- **v1-19**: Previous features (tasks, harvest, nutrients, etc.)
- **v20**: Inventory and consumables tables (current)

WatermelonDB automatically runs migrations on app start.

## JSI Adapter

The JSI (JavaScript Interface) adapter provides native performance:

- **Configured via**: `@morrowdigital/watermelondb-expo-plugin`
- **Enabled in**: `src/lib/watermelon.ts` (`jsi: true` when not in Jest)
- **Performance**: ~10x faster than legacy adapter for large datasets
- **Requirement**: Custom native build (not Expo Go)

## Sync Architecture

WatermelonDB syncs with Supabase using:

- **Pull**: Server → Local with cursor pagination (`updated_at` timestamps)
- **Push**: Local → Server with mutation queue
- **Conflict Resolution**: Last-Write-Wins (LWW) using `server_updated_at_ms`
- **Soft Deletes**: `deleted_at` tombstones for sync

Sync implementation will be added in Task 13 (sync integration).

## Development Workflow

### Testing

WatermelonDB is mocked in Jest (`__mocks__/@nozbe/watermelondb/`):

```bash
pnpm test
```

### Schema Changes

1. Update `src/lib/watermelon-schema.ts` (increment version)
2. Add migration in `src/lib/watermelon-migrations.ts`
3. Update models in `src/lib/watermelon-models/`
4. Register models in `src/lib/watermelon.ts`
5. Run `pnpm run prebuild` to apply changes
6. Rebuild development build

### Reset Database (Development Only)

To reset the local database during development:

```bash
# iOS
rm -rf ios/build
pnpm run prebuild:development
pnpm run ios

# Android
rm -rf android/.gradle android/build android/app/build
pnpm run prebuild:development
pnpm run android
```

## Troubleshooting

### "Cannot find native module" Error

You're trying to run in Expo Go. Create a development build:

```bash
pnpm run prebuild:development
pnpm run ios  # or pnpm run android
```

### Schema Version Mismatch

Database schema changed without migration:

```bash
# Uninstall app from device, then:
pnpm run prebuild:development
pnpm run ios  # or pnpm run android
```

### CI Guard Failing

Plugin removed or misconfigured:

```bash
pnpm run compliance:watermelondb-guard
```

Check `app.config.cjs` and ensure plugin is in the `plugins` array.

## References

- [WatermelonDB Documentation](https://watermelondb.dev/)
- [Expo Config Plugins](https://docs.expo.dev/guides/config-plugins/)
- [WatermelonDB Expo Plugin](https://github.com/morrowdigital/watermelondb-expo-plugin)

## Support

For issues specific to GrowBro's WatermelonDB setup:

1. Check CI guard output: `pnpm run compliance:watermelondb-guard`
2. Verify development build: Must NOT use Expo Go
3. Check schema version: Current version in `watermelon-schema.ts`
4. Review migrations: All changes in `watermelon-migrations.ts`
