/**
 * Migration Module
 *
 * Exports migration manager and related types for database
 * migration management and rollback procedures.
 */

export {
  createMigrationManager,
  type Migration,
  MigrationManager,
  type MigrationResult,
  type MigrationStatus,
} from './migration-manager';
