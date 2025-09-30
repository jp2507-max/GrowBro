export type RemoteNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | string | null;
  deepLink?: string | null;
  createdAt: string;
  readAt?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  messageId?: string | null;
};

export type NotificationPage = {
  items: RemoteNotification[];
  nextCursor?: string | null;
  unreadCount?: number;
};
