/**
 * React Query hooks for community templates
 */

import { createQuery } from 'react-query-kit';

import { supabase } from '@/lib/supabase';

import type { CommunityTemplate, TemplateListParams } from './types';

/**
 * Hook to fetch community templates list
 */
export const useTemplates = createQuery<
  { templates: CommunityTemplate[]; total: number },
  TemplateListParams
>({
  queryKey: ['templates'],
  fetcher: async (params) => {
    const {
      setup,
      locale,
      sortBy = 'created_at',
      limit = 20,
      offset = 0,
    } = params;

    let query = supabase
      .from('community_playbook_templates')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (setup) {
      query = query.eq('setup', setup);
    }

    if (locale) {
      query = query.eq('locale', locale);
    }

    // Apply sorting
    if (sortBy === 'rating_average') {
      query = query.order('rating_average', {
        ascending: false,
        nullsFirst: false,
      });
    } else if (sortBy === 'adoption_count') {
      query = query.order('adoption_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return {
      templates: (data || []).map((t) => ({
        id: t.id,
        authorId: t.author_id,
        authorHandle: t.author_handle,
        name: t.name,
        description: t.description,
        setup: t.setup,
        locale: t.locale,
        license: t.license,
        steps: t.steps,
        phaseOrder: t.phase_order,
        totalWeeks: t.total_weeks,
        taskCount: t.task_count,
        adoptionCount: t.adoption_count,
        ratingAverage: t.rating_average,
        ratingCount: t.rating_count,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      total: count || 0,
    };
  },
});

/**
 * Hook to fetch a single template by ID
 */
export const useTemplate = createQuery<CommunityTemplate, { id: string }>({
  queryKey: ['template'],
  fetcher: async ({ id }) => {
    const { data, error } = await supabase
      .from('community_playbook_templates')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    if (!data) {
      throw new Error('Template not found');
    }

    return {
      id: data.id,
      authorId: data.author_id,
      authorHandle: data.author_handle,
      name: data.name,
      description: data.description,
      setup: data.setup,
      locale: data.locale,
      license: data.license,
      steps: data.steps,
      phaseOrder: data.phase_order,
      totalWeeks: data.total_weeks,
      taskCount: data.task_count,
      adoptionCount: data.adoption_count,
      ratingAverage: data.rating_average,
      ratingCount: data.rating_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
});

/**
 * Hook to fetch template comments
 */
export const useTemplateComments = createQuery<
  any[],
  { templateId: string; limit?: number; offset?: number }
>({
  queryKey: ['template-comments'],
  fetcher: async ({ templateId, limit = 20, offset = 0 }) => {
    const { data, error } = await supabase
      .from('template_comments')
      .select('*')
      .eq('template_id', templateId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    return data || [];
  },
});
