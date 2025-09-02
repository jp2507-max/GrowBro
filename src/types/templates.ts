export type TemplateStep = {
  id: string;
  title: string;
  description?: string;
  /** Days offset relative to anchorDate (can be negative) */
  offsetDays: number;
  /** ISO time-of-day in HH:mm format (24h) applied in target timezone */
  timeOfDay: string;
  /** Minutes before due time to schedule reminder (optional) */
  reminderMinutesBefore?: number;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description?: string;
  steps: TemplateStep[];
};

export type TemplatePreviewTask = {
  seriesId?: string;
  title: string;
  description?: string;
  dueAtLocal: string;
  dueAtUtc: string;
  timezone: string;
  reminderAtLocal?: string;
  reminderAtUtc?: string;
  plantId?: string;
  metadata?: Record<string, unknown>;
};

export type TemplatePreview = {
  tasks: TemplatePreviewTask[];
  totalCount: number;
  dateRange: { start: Date; end: Date };
};
