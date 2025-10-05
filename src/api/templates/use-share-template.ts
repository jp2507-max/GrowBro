/**
 * React Query mutation hook for sharing templates
 */

import { createMutation } from 'react-query-kit';

import { getAnalyticsClient } from '@/lib/analytics-registry';
import type { Playbook } from '@/lib/playbooks/sanitize-playbook';
import { TemplateSharingService } from '@/lib/playbooks/template-sharing-service';
import { supabase } from '@/lib/supabase';

import type { CommunityTemplate } from './types';

interface ShareTemplateVariables {
  playbook: Playbook;
  authorHandle: string;
  description?: string;
  license?: string;
  isPublic?: boolean;
}

/**
 * Hook to share a playbook as a community template
 */
export const useShareTemplate = createMutation<
  CommunityTemplate,
  ShareTemplateVariables
>({
  mutationFn: async (variables) => {
    const analytics = getAnalyticsClient();
    const service = new TemplateSharingService(supabase, analytics);

    return service.shareTemplate({
      playbook: variables.playbook,
      authorHandle: variables.authorHandle,
      description: variables.description,
      license: variables.license,
      isPublic: variables.isPublic,
    });
  },
});
