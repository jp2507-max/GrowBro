import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';
import { z } from 'zod';

import { client } from '../common';
import type { Post } from './types';

export type AttachmentInput = {
  id?: string;
  filename: string;
  uri?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  metadata?: Record<string, unknown>;
};

export const attachmentInputSchema = z.object({
  id: z.string().optional(),
  filename: z.string(),
  uri: z.string().optional(),
  url: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type Variables = {
  title: string;
  body: string;
  attachments?: AttachmentInput[];
  sourceAssessmentId?: string;
};
type Response = Post;

export const useAddPost = createMutation<Response, Variables, AxiosError>({
  mutationFn: async (variables) =>
    client({
      url: 'posts/add',
      method: 'POST',
      data: variables,
    }).then((response) => response.data),
});
