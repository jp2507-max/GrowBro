/**
 * React Query mutation hook for adopting templates
 */

import { createMutation } from 'react-query-kit';

import type { AdoptedPlaybook } from '@/lib/playbooks/template-adoption-service';
import { TemplateAdoptionService } from '@/lib/playbooks/template-adoption-service';
import { supabase } from '@/lib/supabase';

import type { AdoptTemplateParams } from './types';

/**
 * Hook to adopt a community template
 */
export const useAdoptTemplate = createMutation<
  AdoptedPlaybook,
  AdoptTemplateParams
>({
  mutationFn: async (variables) => {
    const service = new TemplateAdoptionService(supabase);

    return service.adoptTemplate({
      templateId: variables.templateId,
      plantId: variables.plantId,
      customizations: variables.customizations,
    });
  },
});
