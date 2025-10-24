/**
 * Migration Manager
 *
 * Manages database migrations and rollbacks for the moderation system.
 * Provides safe migration execution with rollback capabilities and
 * migration history tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Migration status
 */
export type MigrationStatus = 'pending' | 'applied' | 'failed' | 'rolled_back';

/**
 * Migration record
 */
export interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: string; // SQL for applying migration
  down: string; // SQL for rolling back migration
  appliedAt?: Date;
  rolledBackAt?: Date;
  status: MigrationStatus;
  checksum: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migration: Migration;
  error?: string;
  duration: number;
}

/**
 * Migration Manager
 */
export class MigrationManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all migrations
   */
  async getMigrations(): Promise<Migration[]> {
    const { data, error } = await this.supabase
      .from('moderation_migrations')
      .select('*')
      .order('version', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch migrations: ${error.message}`);
    }

    return (data || []).map(this.mapMigrationRecord);
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const { data, error } = await this.supabase
      .from('moderation_migrations')
      .select('*')
      .eq('status', 'pending')
      .order('version', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch pending migrations: ${error.message}`);
    }

    return (data || []).map(this.mapMigrationRecord);
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    const { data, error } = await this.supabase
      .from('moderation_migrations')
      .select('*')
      .eq('status', 'applied')
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch applied migrations: ${error.message}`);
    }

    return (data || []).map(this.mapMigrationRecord);
  }

  /**
   * Apply a migration
   */
  async applyMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Verify checksum
      const currentChecksum = await this.calculateChecksum(migration.up);
      if (currentChecksum !== migration.checksum) {
        throw new Error('Migration checksum mismatch');
      }

      // Execute migration SQL
      const { error: sqlError } = await this.supabase.rpc('execute_sql', {
        sql: migration.up,
      });

      if (sqlError) {
        throw new Error(`Migration SQL failed: ${sqlError.message}`);
      }

      // Update migration status
      const { error: updateError } = await this.supabase
        .from('moderation_migrations')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
        })
        .eq('id', migration.id);

      if (updateError) {
        throw new Error(
          `Failed to update migration status: ${updateError.message}`
        );
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        migration: {
          ...migration,
          status: 'applied',
          appliedAt: new Date(),
        },
        duration,
      };
    } catch (error) {
      // Mark migration as failed
      await this.supabase
        .from('moderation_migrations')
        .update({
          status: 'failed',
        })
        .eq('id', migration.id);

      const duration = Date.now() - startTime;

      return {
        success: false,
        migration: {
          ...migration,
          status: 'failed',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      if (migration.status !== 'applied') {
        throw new Error('Can only rollback applied migrations');
      }

      // Execute rollback SQL
      const { error: sqlError } = await this.supabase.rpc('execute_sql', {
        sql: migration.down,
      });

      if (sqlError) {
        throw new Error(`Rollback SQL failed: ${sqlError.message}`);
      }

      // Update migration status
      const { error: updateError } = await this.supabase
        .from('moderation_migrations')
        .update({
          status: 'rolled_back',
          rolled_back_at: new Date().toISOString(),
        })
        .eq('id', migration.id);

      if (updateError) {
        throw new Error(
          `Failed to update migration status: ${updateError.message}`
        );
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        migration: {
          ...migration,
          status: 'rolled_back',
          rolledBackAt: new Date(),
        },
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        migration,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Apply all pending migrations
   */
  async applyPendingMigrations(): Promise<MigrationResult[]> {
    const pending = await this.getPendingMigrations();
    const results: MigrationResult[] = [];

    for (const migration of pending) {
      const result = await this.applyMigration(migration);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Rollback last N migrations
   */
  async rollbackMigrations(count: number = 1): Promise<MigrationResult[]> {
    const applied = await this.getAppliedMigrations();
    const toRollback = applied.slice(0, count);
    const results: MigrationResult[] = [];

    for (const migration of toRollback) {
      const result = await this.rollbackMigration(migration);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Register a new migration
   */
  async registerMigration(
    migration: Omit<Migration, 'id' | 'status' | 'checksum'>
  ): Promise<Migration> {
    const checksum = await this.calculateChecksum(migration.up);

    const { data, error } = await this.supabase
      .from('moderation_migrations')
      .insert({
        name: migration.name,
        version: migration.version,
        description: migration.description,
        up: migration.up,
        down: migration.down,
        status: 'pending',
        checksum,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to register migration: ${error.message}`);
    }

    return this.mapMigrationRecord(data);
  }

  /**
   * Calculate checksum for migration SQL
   */
  private async calculateChecksum(sql: string): Promise<string> {
    // Simple checksum using hash
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Map database record to Migration
   */
  private mapMigrationRecord(record: any): Migration {
    return {
      id: record.id,
      name: record.name,
      version: record.version,
      description: record.description,
      up: record.up,
      down: record.down,
      status: record.status,
      checksum: record.checksum,
      appliedAt: record.applied_at ? new Date(record.applied_at) : undefined,
      rolledBackAt: record.rolled_back_at
        ? new Date(record.rolled_back_at)
        : undefined,
    };
  }
}

/**
 * Create migration manager
 */
export function createMigrationManager(
  supabase: SupabaseClient
): MigrationManager {
  return new MigrationManager(supabase);
}
