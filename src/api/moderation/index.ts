import { client } from '@/api/common';

export type ReportPayload = { contentId: string | number; reason: string };
export type SimpleUserPayload = { userId: string | number };
export type DeletePayload = { contentId: string | number };

export async function apiReportContent(payload: ReportPayload): Promise<void> {
  await client.post('/moderation/report', payload);
}

export async function apiBlockUser(payload: SimpleUserPayload): Promise<void> {
  await client.post('/moderation/block', payload);
}

export async function apiMuteUser(payload: SimpleUserPayload): Promise<void> {
  await client.post('/moderation/mute', payload);
}

export async function apiDeleteOwnContent(
  payload: DeletePayload
): Promise<void> {
  await client.post('/moderation/delete', payload);
}
