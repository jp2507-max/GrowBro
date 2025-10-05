/**
 * React Query hooks for community templates
 */

import { createQuery } from 'react-query-kit';

import { supabase } from '@/lib/supabase';

import type {
  CommunityTemplate,
  TemplateComment,
  TemplateListParams,
} from './types';

/**
 * Maps a database row from community_playbook_templates to CommunityTemplate
 */
function mapDbRowToCommunityTemplate(row: any): CommunityTemplate {
  return {
    id: row.id,
    authorId: row.author_id,
    authorHandle: row.author_handle,
    name: row.name,
    description: row.description,
    setup: row.setup,
    locale: row.locale,
    license: row.license,
    steps: row.steps,
    phaseOrder: row.phase_order,
    totalWeeks: row.total_weeks,
    taskCount: row.task_count,
    adoptionCount: row.adoption_count,
    ratingAverage: row.rating_average,
    ratingCount: row.rating_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a database row from template_comments to TemplateComment
 */
function mapDbRowToTemplateComment(row: any): TemplateComment {
  return {
    id: row.id,
    templateId: row.template_id,
    authorId: row.user_id,
    content: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userHandle: row.user_handle,
  };
}

/**
 * Hook to fetch community templates list
 */
/*
 * NOTE (React Query keys):
 * The original hooks registered static query keys (['templates'], ['template'],
 * ['template-comments']) while their fetchers depend on runtime variables
 * (filters, ids, pagination). React Query caches results by the query key, so
 * using a static key causes cache collisions: for example, fetching
 * useTemplate({ id: 'a' }) and later useTemplate({ id: 'b' }) will map both
 * requests to the same cache entry and can return the wrong template.
 *
 * To avoid this, include the input variables in the query key. Examples:
 *  - useTemplates: ['templates', { setup, locale, sortBy, limit, offset }]
 *  - useTemplate: ['template', id]
 *  - useTemplateComments: ['template-comments', { templateId, limit, offset }]
 *
 * Keep keys as small and serializable values when possible (strings, numbers,
 * arrays, or plain objects). This ensures queries are cached/separated by their
 * inputs and prevents UI showing stale or incorrect data when users navigate
 * between different templates or pages.
 */
const _useTemplates = createQuery<
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
      templates: (data || []).map(mapDbRowToCommunityTemplate),
      total: count || 0,
    };
  },
});

// Wrapper that preserves the simple call signature used across the app
// while forwarding the inputs into react-query-kit's `variables` so the
// final cache key becomes ['templates', variables].
export function useTemplates(variables: TemplateListParams) {
  return _useTemplates({ variables });
}

/**
 * Hook to fetch a single template by ID
 */
const _useTemplate = createQuery<CommunityTemplate, { id: string }>({
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

    return mapDbRowToCommunityTemplate(data);
  },
});

export function useTemplate(variables: { id: string }) {
  return _useTemplate({ variables });
}

/**
 * Hook to fetch template comments
 */
const _useTemplateComments = createQuery<
  TemplateComment[],
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

    return (data || []).map(mapDbRowToTemplateComment);
  },
});

export function useTemplateComments(variables: {
  templateId: string;
  limit?: number;
  offset?: number;
}) {
  return _useTemplateComments({ variables });
}
