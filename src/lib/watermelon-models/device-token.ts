import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

export class DeviceTokenModel extends Model {
  static table = 'device_tokens';

  @field('token') token!: string;
  @field('platform') platform!: string;
  @field('user_id') userId!: string;
  @date('created_at') createdAt!: Date;
  @date('last_used_at') lastUsedAt!: Date;
  @field('is_active') isActive!: boolean;
}
