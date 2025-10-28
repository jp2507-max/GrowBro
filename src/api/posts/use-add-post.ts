import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';
import { z } from 'zod';

import { client } from '../common';
import type { Post } from './types';

export const attachmentInputSchema = z.object({
  id: z.string().optional(),
  filename: z.string(),
  uri: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Derive TypeScript type from schema for single source of truth
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

type Variables = {
  title: string;
  body: string;
  attachments?: AttachmentInput[];
  sourceAssessmentId?: string;
};
type Response = Post;

export const useAddPost = createMutation<Response, Variables, AxiosError>({
  mutationFn: async (variables): Promise<Response> => {
    // Validate attachments array if present
    if (variables.attachments) {
      const validationResult = z
        .array(attachmentInputSchema)
        .safeParse(variables.attachments);

      if (!validationResult.success) {
        throw new Error(
          `Invalid attachments: ${validationResult.error.message}`
        );
      }
    }

    return client({
      url: 'posts/add',
      method: 'POST',
      data: variables,
    }).then((response) => response.data);
  },
});
