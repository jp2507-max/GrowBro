import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './watermelon-migrations';
import { NotificationQueueModel } from './watermelon-models/notification-queue';
import { OccurrenceOverrideModel } from './watermelon-models/occurrence-override';
import { SeriesModel } from './watermelon-models/series';
import { TaskModel } from './watermelon-models/task';
import { schema } from './watermelon-schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Enable JSI for production performance. Keep disabled in Jest.
  jsi: process.env.JEST_WORKER_ID === undefined,
  onSetUpError: (error: unknown) => {
    console.error('[WatermelonDB] setup error', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    SeriesModel,
    TaskModel,
    OccurrenceOverrideModel,
    NotificationQueueModel,
  ],
});
