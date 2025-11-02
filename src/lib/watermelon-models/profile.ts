import type { Database } from '@nozbe/watermelondb';
import { Model, Q } from '@nozbe/watermelondb';

/**
 * Editable profile fields - excludes WatermelonDB internals and auto-managed fields
 */
export type EditableProfileFields = Pick<
  ProfileModel,
  | 'displayName'
  | 'bio'
  | 'avatarUrl'
  | 'location'
  | 'showProfileToCommunity'
  | 'allowDirectMessages'
>;

/**
 * Profile WatermelonDB model
 * Requirements: 9.6
 *
 * Stores user profile information locally with sync to Supabase.
 * One-to-one mapping between users and profiles.
 */
export class ProfileModel extends Model {
  /**
   * Finds an existing profile record for the given user_id,
   * or creates a new one if none exists. This ensures one-to-one mapping
   * between users and their profiles.
   *
   * @param database - The WatermelonDB database instance
   * @param userId - The user ID to find or create profile for
   * @param defaults - Default values for the new record if created
   * @returns The existing or newly created profile record
   */
  static async findOrCreate(
    database: Database,
    userId: string,
    defaults: Partial<EditableProfileFields> = {}
  ): Promise<ProfileModel> {
    return database.write(async () => {
      const collection = database.collections.get<ProfileModel>('profiles');

      // Query for existing record by user_id
      const existingRecords = await collection
        .query(Q.where('user_id', userId))
        .fetch();

      if (existingRecords.length > 0) {
        return existingRecords[0];
      }

      // Create new record if none exists
      const now = new Date();
      return collection.create((record) => {
        record.userId = userId;
        record.displayName = defaults.displayName ?? 'User';
        record.bio = defaults.bio;
        record.avatarUrl = defaults.avatarUrl;
        record.location = defaults.location;
        record.showProfileToCommunity = defaults.showProfileToCommunity ?? true;
        record.allowDirectMessages = defaults.allowDirectMessages ?? true;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  /**
   * Alias for findOrCreate for consistency with common upsert patterns
   */
  static async upsert(
    database: Database,
    userId: string,
    defaults: Partial<EditableProfileFields> = {}
  ): Promise<ProfileModel> {
    return this.findOrCreate(database, userId, defaults);
  }

  /**
   * Updates the profile with new values
   * @param updates - Partial profile updates
   */
  async updateProfile(updates: Partial<EditableProfileFields>): Promise<void> {
    await this.update((record) => {
      if (updates.displayName !== undefined)
        record.displayName = updates.displayName;
      if (updates.bio !== undefined) record.bio = updates.bio;
      if (updates.avatarUrl !== undefined) record.avatarUrl = updates.avatarUrl;
      if (updates.location !== undefined) record.location = updates.location;
      if (updates.showProfileToCommunity !== undefined)
        record.showProfileToCommunity = updates.showProfileToCommunity;
      if (updates.allowDirectMessages !== undefined)
        record.allowDirectMessages = updates.allowDirectMessages;
      record.updatedAt = new Date();
    });
  }
}
