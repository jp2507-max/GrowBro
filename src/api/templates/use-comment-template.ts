/**
 * React Query mutation hook for commenting on templates
 */

import { createMutation } from 'react-query-kit';

import { TemplateAdoptionService } from '@/lib/playbooks/template-adoption-service';
import { supabase } from '@/lib/supabase';

import type { CommentTemplateParams } from './types';

/**
 * Hook to comment on a community template
 */
export const useCommentTemplate = createMutation<void, CommentTemplateParams>({
  mutationFn: async (variables) => {
    const service = new TemplateAdoptionService(supabase);

    return service.commentOnTemplate(
      variables.templateId,
      variables.comment,
      variables.userHandle
    );
  },
});
