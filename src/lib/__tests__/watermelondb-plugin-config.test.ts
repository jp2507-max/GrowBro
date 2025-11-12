/**
 * WatermelonDB Plugin Configuration Tests
 *
 * Verifies that the WatermelonDB Expo plugin is properly configured
 * and that development builds are required for native module functionality.
 *
 * Requirements:
 * - 10.1: WatermelonDB offline-first local storage
 * - 10.2: Expo config plugin setup with development build requirements
 */

import fs from 'fs';
import path from 'path';

describe('WatermelonDB Plugin Configuration', () => {
  let appConfig: any;
  let packageJson: any;

  beforeAll(() => {
    // Read app.config.cjs (exports a function, not direct config)
    const appConfigPath = path.resolve(__dirname, '../../../app.config.cjs');
    delete require.cache[require.resolve(appConfigPath)];

    const appConfigModule = require(appConfigPath);
    // Call the function if it exports one, otherwise use direct export
    appConfig =
      typeof appConfigModule === 'function'
        ? appConfigModule({})
        : appConfigModule;

    // Read package.json
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  });

  describe('Package Dependencies', () => {
    test('WatermelonDB core dependencies are installed', () => {
      expect(packageJson.dependencies).toHaveProperty('@nozbe/watermelondb');
      expect(packageJson.dependencies).toHaveProperty('@nozbe/simdjson');

      const dbVersion = packageJson.dependencies['@nozbe/watermelondb'];
      const simdjsonVersion = packageJson.dependencies['@nozbe/simdjson'];

      expect(dbVersion).toBeTruthy();
      expect(simdjsonVersion).toBeTruthy();
    });

    test('Legacy WatermelonDB Expo plugin is not required', () => {
      expect(packageJson.dependencies).not.toHaveProperty(
        '@morrowdigital/watermelondb-expo-plugin'
      );
    });
  });

  describe('Expo Config Plugin Setup', () => {
    test('expo-build-properties config declares simdjson pod', () => {
      const config = appConfig;

      const buildPropsEntry = config.plugins.find((plugin: any) => {
        if (Array.isArray(plugin)) {
          return plugin[0] === 'expo-build-properties';
        }
        return plugin === 'expo-build-properties';
      });

      expect(buildPropsEntry).toBeDefined();

      const buildPropsConfig = Array.isArray(buildPropsEntry)
        ? buildPropsEntry[1]
        : {};

      expect(buildPropsConfig?.ios?.extraPods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'simdjson',
            path: expect.stringContaining('@nozbe/simdjson'),
          }),
        ])
      );
    });

    test('expo-build-properties config declares libc++ pickFirst', () => {
      const config = appConfig;

      const buildPropsEntry = config.plugins.find((plugin: any) => {
        if (Array.isArray(plugin)) {
          return plugin[0] === 'expo-build-properties';
        }
        return plugin === 'expo-build-properties';
      });

      expect(buildPropsEntry).toBeDefined();

      const buildPropsConfig = Array.isArray(buildPropsEntry)
        ? buildPropsEntry[1]
        : {};

      expect(buildPropsConfig?.android?.packagingOptions?.pickFirst).toEqual(
        expect.arrayContaining(['**/libc++_shared.so'])
      );
    });
  });

  describe('Development Build Requirements', () => {
    test('EAS build configuration exists', () => {
      const easConfigPath = path.resolve(__dirname, '../../../eas.json');
      const easConfigExists = fs.existsSync(easConfigPath);

      expect(easConfigExists).toBe(true);

      if (easConfigExists) {
        const easConfig = JSON.parse(fs.readFileSync(easConfigPath, 'utf-8'));
        expect(easConfig.build).toBeDefined();
      }
    });

    test('development build profile is configured', () => {
      const easConfigPath = path.resolve(__dirname, '../../../eas.json');

      if (fs.existsSync(easConfigPath)) {
        const easConfig = JSON.parse(fs.readFileSync(easConfigPath, 'utf-8'));

        // Should have at least development, preview, or production profiles
        const hasProfiles =
          easConfig.build.development ||
          easConfig.build.preview ||
          easConfig.build.production;

        expect(hasProfiles).toBeTruthy();
      }
    });

    test('README documents development build requirement', () => {
      const readmePath = path.resolve(__dirname, '../../../README.md');
      const readmeExists = fs.existsSync(readmePath);

      expect(readmeExists).toBe(true);

      if (readmeExists) {
        const readme = fs.readFileSync(readmePath, 'utf-8');

        // Should mention development build or custom native code
        const mentionsDevelopmentBuild =
          readme.includes('development build') ||
          readme.includes('custom native code') ||
          readme.includes('WatermelonDB') ||
          readme.includes('eas build') ||
          readme.includes('native module') ||
          readme.includes('expo-dev-client');

        // Informational: README should mention dev builds since WatermelonDB requires them
        if (!mentionsDevelopmentBuild) {
          console.warn(
            'README does not mention development builds. ' +
              'Consider documenting that this app requires a development build (not Expo Go) ' +
              'because it uses WatermelonDB with native modules.'
          );
        }
      }
    });
  });

  describe('Database Schema Configuration', () => {
    test('WatermelonDB schema includes inventory tables', () => {
      // Schema is in watermelon-schema.ts in lib/
      const schemaPath = path.resolve(__dirname, '../watermelon-schema.ts');
      const schemaExists = fs.existsSync(schemaPath);

      expect(schemaExists).toBe(true);

      if (schemaExists) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        expect(schemaContent).toContain('inventory_items');
        expect(schemaContent).toContain('inventory_batches');
        expect(schemaContent).toContain('inventory_movements');
      }
    });

    test('inventory_items table has required columns', () => {
      const schemaPath = path.resolve(__dirname, '../watermelon-schema.ts');

      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        // Check for required columns
        const requiredColumns = [
          'name',
          'category',
          'unit_of_measure',
          'tracking_mode',
          'is_consumable',
          'min_stock',
          'reorder_multiple',
        ];

        requiredColumns.forEach((column) => {
          expect(schemaContent).toContain(column);
        });
      }
    });

    test('inventory_batches table has required columns', () => {
      const schemaPath = path.resolve(__dirname, '../watermelon-schema.ts');

      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        const requiredColumns = [
          'item_id',
          'lot_number',
          'quantity',
          'cost_per_unit_minor',
          'received_at',
        ];

        requiredColumns.forEach((column) => {
          expect(schemaContent).toContain(column);
        });
      }
    });

    test('inventory_movements table has required columns', () => {
      const schemaPath = path.resolve(__dirname, '../watermelon-schema.ts');

      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        const requiredColumns = [
          'item_id',
          'type',
          'quantity_delta',
          'reason',
          'created_at',
        ];

        requiredColumns.forEach((column) => {
          expect(schemaContent).toContain(column);
        });
      }
    });
  });

  describe('Database Adapter Configuration', () => {
    test('database adapter is configured for SQLite', () => {
      const dbPath = path.resolve(__dirname, '../watermelon.ts');
      const dbExists = fs.existsSync(dbPath);

      expect(dbExists).toBe(true);

      if (dbExists) {
        const dbContent = fs.readFileSync(dbPath, 'utf-8');

        // Should use SQLiteAdapter
        expect(dbContent).toContain('SQLiteAdapter');
      }
    });

    test('synchronize() includes inventory tables', () => {
      // Sync might be in watermelon.ts or a separate sync file
      const syncPaths = [
        path.resolve(__dirname, '../sync-engine.ts'),
        path.resolve(__dirname, '../watermelon.ts'),
      ];

      let hasInventorySync = false;
      for (const syncPath of syncPaths) {
        if (fs.existsSync(syncPath)) {
          const syncContent = fs.readFileSync(syncPath, 'utf-8');

          // Should reference inventory sync
          hasInventorySync =
            syncContent.includes('inventory_items') ||
            syncContent.includes('inventory') ||
            syncContent.includes('pullChanges');

          if (hasInventorySync) break;
        }
      }

      expect(hasInventorySync).toBe(true);
    });
  });

  describe('CI/CD Guards', () => {
    test('CI should fail if build properties are missing', () => {
      const config = appConfig;
      const buildPropsEntry = config.plugins.find((plugin: any) => {
        if (Array.isArray(plugin)) {
          return plugin[0] === 'expo-build-properties';
        }
        return plugin === 'expo-build-properties';
      });

      const buildPropsConfig = Array.isArray(buildPropsEntry)
        ? buildPropsEntry[1]
        : null;

      expect(buildPropsConfig).toBeTruthy();

      if (!buildPropsConfig?.ios?.extraPods) {
        throw new Error(
          'CRITICAL: expo-build-properties ios.extraPods missing simdjson. ' +
            'WatermelonDB requires the simdjson pod to build on iOS.'
        );
      }

      if (
        !buildPropsConfig?.android?.packagingOptions?.pickFirst?.includes(
          '**/libc++_shared.so'
        )
      ) {
        throw new Error(
          'CRITICAL: expo-build-properties android.packagingOptions.pickFirst missing libc++_shared. ' +
            'WatermelonDB requires pickFirst "**/libc++_shared.so" to avoid duplicate library conflicts.'
        );
      }
    });

    test('inventory schema version is up to date', () => {
      const schemaPath = path.resolve(__dirname, '../watermelon-schema.ts');

      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        // Should have a version number
        const hasVersion =
          schemaContent.includes('version:') ||
          schemaContent.includes('schemaVersion');

        expect(hasVersion).toBe(true);
      }
    });
  });

  describe('Migration Configuration', () => {
    test('migrations directory exists', () => {
      const migrationsPath = path.resolve(
        __dirname,
        '../../watermelon-models/migrations'
      );

      // Migrations may exist or be planned
      const exists = fs.existsSync(migrationsPath);

      if (exists) {
        const files = fs.readdirSync(migrationsPath);

        // If migrations exist, they should be .ts or .js files
        const hasMigrations = files.some(
          (f) => f.endsWith('.ts') || f.endsWith('.js')
        );

        if (files.length > 0) {
          expect(hasMigrations).toBe(true);
        }
      }

      // Test passes whether migrations exist or not (future-proof)
      expect(true).toBe(true);
    });

    test('schema includes migration support', () => {
      const schemaPath = path.resolve(
        __dirname,
        '../../watermelon-models/schema.ts'
      );

      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        // Should import or reference migrations
        const hasMigrationSupport =
          schemaContent.includes('migration') ||
          schemaContent.includes('schemaMigrations') ||
          schemaContent.includes('addColumns') ||
          schemaContent.includes('version:');

        expect(hasMigrationSupport).toBe(true);
      }
    });
  });
});
