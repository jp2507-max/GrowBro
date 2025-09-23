import { client } from '@/api/common';

export type AppealPayload = {
  contentId: string | number;
  reason: string;
  details?: string;
};

export type AppealResult = { status: 'sent' | 'queued'; submittedAt: number };

export async function apiSubmitAppeal(payload: AppealPayload): Promise<void> {
  await client.post('/moderation/appeal', payload);
}
