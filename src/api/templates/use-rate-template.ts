/**
 * React Query mutation hook for rating templates
 */

import { createMutation } from 'react-query-kit';

import { TemplateAdoptionService } from '@/lib/playbooks/template-adoption-service';
import { supabase } from '@/lib/supabase';

import type { RateTemplateParams } from './types';

/**
 * Hook to rate a community template
 */
export const useRateTemplate = createMutation<void, RateTemplateParams>({
  mutationFn: async (variables) => {
    const service = new TemplateAdoptionService(supabase);

    return service.rateTemplate(
      variables.templateId,
      variables.rating,
      variables.review
    );
  },
});
