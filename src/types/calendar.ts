export type TaskStatus = 'pending' | 'completed' | 'skipped';

export type OccurrenceOverrideStatus = 'skip' | 'reschedule' | 'complete';

export type TaskMetadata = Record<string, unknown>;

export type Series = {
  id: string;
  title: string;
  description?: string;
  dtstartLocal: string; // ISO with timezone
  dtstartUtc: string; // ISO UTC
  timezone: string; // IANA timezone
  rrule: string; // RFC-5545
  untilUtc?: string; // ISO UTC
  count?: number;
  plantId?: string;
  createdAt: string; // ISO timestamptz
  updatedAt: string; // ISO timestamptz
  deletedAt?: string; // ISO timestamptz
};

export type OccurrenceOverride = {
  id: string;
  seriesId: string;
  occurrenceLocalDate: string; // YYYY-MM-DD
  dueAtLocal?: string; // ISO with timezone
  dueAtUtc?: string; // ISO UTC
  reminderAtLocal?: string; // ISO with timezone
  reminderAtUtc?: string; // ISO UTC
  status?: OccurrenceOverrideStatus;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  seriesId?: string;
  title: string;
  description?: string;
  // Dual timezone fields per design (DST-safe)
  dueAtLocal: string; // ISO with timezone
  dueAtUtc: string; // ISO UTC
  timezone: string; // IANA timezone
  reminderAtLocal?: string; // ISO with timezone
  reminderAtUtc?: string; // ISO UTC
  plantId?: string;
  status: TaskStatus;
  completedAt?: string; // ISO timestamptz
  metadata: TaskMetadata;
  createdAt: string; // ISO timestamptz
  updatedAt: string; // ISO timestamptz
  deletedAt?: string; // ISO timestamptz
};

export type NotificationQueueItem = {
  id: string;
  taskId: string;
  notificationId: string;
  scheduledForLocal: string; // ISO with timezone
  scheduledForUtc: string; // ISO UTC
  timezone: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  updatedAt: string;
};
