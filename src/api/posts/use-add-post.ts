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
  .refine((obj) => Boolean(obj.uri), {
    message:
      'URI is required for attachments. ID-based attachments are not currently supported.',
  });

// Derive TypeScript type from schema for single source of truth
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

// Type for remote attachment metadata
interface RemoteAttachmentMetadata {
  width?: number;
  height?: number;
  bytes?: number;
  aspectRatio?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  resizedPath?: string;
  thumbnailPath?: string;
}

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

// Helper function to process local file attachments
const processLocalAttachment = async (
  attachment: AttachmentInput,
  uploadedPaths: string[]
): Promise<MediaPayload> => {
  // Validate file size before processing
  const validation = await validateFileSize(attachment.uri!);
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
  const variants = await captureAndStore(attachment.uri!);

  // Hash the original for content-addressable storage
  const contentHash = await hashFileContent(variants.original);

  // Upload variants to Supabase Storage
  const uploadResult = await uploadCommunityMediaVariants(
    user.id,
    variants,
    contentHash
  );

  // Track uploaded paths for rollback
  uploadedPaths.push(
    uploadResult.originalPath,
    uploadResult.resizedPath,
    uploadResult.thumbnailPath
  );

  // Build media payload for server
  return {
    originalPath: uploadResult.originalPath,
    resizedPath: uploadResult.resizedPath,
    thumbnailPath: uploadResult.thumbnailPath,
    width: uploadResult.metadata.width,
    height: uploadResult.metadata.height,
    aspectRatio: uploadResult.metadata.aspectRatio,
    bytes: uploadResult.metadata.bytes,
  };
};

// Helper function to process remote attachments
const processRemoteAttachment = (attachment: AttachmentInput): MediaPayload => {
  const metadata = attachment.metadata as RemoteAttachmentMetadata | undefined;
  const width = Number(metadata?.width ?? metadata?.dimensions?.width ?? 0);
  const height = Number(metadata?.height ?? metadata?.dimensions?.height ?? 0);
  const bytes = Number(metadata?.bytes ?? attachment.size ?? 0);

  if (!width || !height || !bytes) {
    throw new Error(
      'Remote attachments must include width, height, and byte size metadata'
    );
  }

  const aspectRatio = metadata?.aspectRatio ?? width / height;
  const resizedPath = metadata?.resizedPath ?? attachment.uri;
  const thumbnailPath = metadata?.thumbnailPath ?? attachment.uri;

  return {
    originalPath: attachment.uri!,
    resizedPath,
    thumbnailPath,
    width,
    height,
    aspectRatio,
    bytes,
  };
};

// Helper function to process attachments
const processAttachments = async (
  attachments: AttachmentInput[]
): Promise<{ mediaPayloads: MediaPayload[]; uploadedPaths: string[] }> => {
  const mediaPayloads: MediaPayload[] = [];
  const uploadedPaths: string[] = [];

  for (const attachment of attachments) {
    if (attachment.uri) {
      const isLocalFile =
        attachment.uri.startsWith('file://') ||
        attachment.uri.startsWith('content://');

      if (isLocalFile) {
        // Local file - validate and process
        const mediaPayload = await processLocalAttachment(
          attachment,
          uploadedPaths
        );
        mediaPayloads.push(mediaPayload);
      } else {
        // Remote prefill attachment - already uploaded asset
        // Skip client-side processing and pass through untouched
        const mediaPayload = processRemoteAttachment(attachment);
        mediaPayloads.push(mediaPayload);
      }
    }
  }

  return { mediaPayloads, uploadedPaths };
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

    // Process first photo attachment if present (backend only supports single media)
    const { mediaPayloads, uploadedPaths } =
      variables.attachments && variables.attachments.length > 0
        ? await processAttachments([variables.attachments[0]])
        : { mediaPayloads: [], uploadedPaths: [] };

    try {
      return await client({
        url: 'posts/add',
        method: 'POST',
        data: {
          title: variables.title,
          body: variables.body,
          media: mediaPayloads.length > 0 ? mediaPayloads[0] : undefined,
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
