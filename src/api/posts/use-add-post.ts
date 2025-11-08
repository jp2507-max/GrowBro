import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';
import { z } from 'zod';

import { client } from '@/api/common';
import type { Post } from '@/api/posts/types';
import {
  cleanupCommunityMedia,
  uploadCommunityMediaVariants,
} from '@/lib/media/community-media-upload-service';
import { validateFileSize } from '@/lib/media/file-validation';
import { hashFileContent } from '@/lib/media/photo-hash';
import { captureAndStore } from '@/lib/media/photo-storage-service';
import { supabase } from '@/lib/supabase';

export const attachmentInputSchema = z
  .object({
    id: z.string().optional(),
    filename: z.string(),
    uri: z.string().optional(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((obj) => Boolean(obj.id || obj.uri), {
    message: 'Either id or uri must be provided',
  });

// Derive TypeScript type from schema for single source of truth
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

// Media payload interface for post attachments
export interface MediaPayload {
  originalPath: string;
  resizedPath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  aspectRatio: number;
  bytes: number;
}

type Variables = {
  title: string;
  body: string;
  attachments?: AttachmentInput[];
  sourceAssessmentId?: string;
};
type Response = Post;

// Helper function to process attachments
const processAttachments = async (
  attachments: AttachmentInput[]
): Promise<MediaPayload[]> => {
  const mediaPayloads: MediaPayload[] = [];
  for (const attachment of attachments) {
    if (attachment.uri) {
      const isLocalFile =
        attachment.uri.startsWith('file://') ||
        attachment.uri.startsWith('content://');

      if (isLocalFile) {
        // Local file - validate and process
        // Validate file size before processing
        const validation = await validateFileSize(attachment.uri);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid file size');
        }

        // Get current user ID
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User must be authenticated to upload media');
        }

        // Generate photo variants (original, resized, thumbnail)
        const variants = await captureAndStore(attachment.uri);

        // Hash the original for content-addressable storage
        const contentHash = await hashFileContent(variants.original);

        // Upload variants to Supabase Storage
        const uploadResult = await uploadCommunityMediaVariants(
          user.id,
          variants,
          contentHash
        );

        // Build media payload for server
        const mediaPayload: MediaPayload = {
          originalPath: uploadResult.originalPath,
          resizedPath: uploadResult.resizedPath,
          thumbnailPath: uploadResult.thumbnailPath,
          width: uploadResult.metadata.width,
          height: uploadResult.metadata.height,
          aspectRatio: uploadResult.metadata.aspectRatio,
          bytes: uploadResult.metadata.bytes,
        };
        mediaPayloads.push(mediaPayload);
      } else {
        // Remote prefill attachment - already uploaded asset
        // Skip client-side processing and pass through untouched
        const mediaPayload: MediaPayload = {
          originalPath: attachment.uri,
          resizedPath: attachment.uri, // Use same URL for all variants
          thumbnailPath: attachment.uri, // Use same URL for all variants
          width: 0, // Server will determine dimensions
          height: 0, // Server will determine dimensions
          aspectRatio: 1, // Default square aspect ratio
          bytes: attachment.size || 0,
        };
        mediaPayloads.push(mediaPayload);
      }
    }
  }
  return mediaPayloads;
};

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

    // Process photo attachments if present
    const mediaPayloads = variables.attachments
      ? await processAttachments(variables.attachments)
      : [];

    // Track uploaded paths for rollback on failure
    const uploadedPaths: string[] = [];
    mediaPayloads.forEach((media) => {
      if (media.originalPath) uploadedPaths.push(media.originalPath);
      if (media.resizedPath) uploadedPaths.push(media.resizedPath);
      if (media.thumbnailPath) uploadedPaths.push(media.thumbnailPath);
    });

    try {
      return await client({
        url: 'posts/add',
        method: 'POST',
        data: {
          title: variables.title,
          body: variables.body,
          media: mediaPayloads.length > 0 ? mediaPayloads : undefined,
          sourceAssessmentId: variables.sourceAssessmentId,
        },
      }).then((response) => response.data);
    } catch (error) {
      // Rollback: cleanup uploaded files if post creation failed
      if (uploadedPaths.length > 0) {
        console.warn(
          'Post creation failed, cleaning up uploaded media:',
          uploadedPaths
        );
        await cleanupCommunityMedia(uploadedPaths).catch((cleanupError) => {
          console.error('Failed to cleanup uploaded media:', cleanupError);
        });
      }
      throw error;
    }
  },
});
