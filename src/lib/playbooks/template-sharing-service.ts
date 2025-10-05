/**
 * Template Sharing Service
 *
 * Handles sharing playbooks as community templates with proper PII stripping,
 * validation, and analytics tracking.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AnalyticsClient } from '@/lib/analytics';

import type { Playbook } from './sanitize-playbook';
import {
  sanitizePlaybookForSharing,
  validatePlaybookForSharing,
} from './sanitize-playbook';

export interface ShareTemplateOptions {
  playbook: Playbook;
  authorHandle: string;
  description?: string;
  license?: string;
  isPublic?: boolean;
}

export interface CommunityTemplate {
  id: string;
  authorId: string;
  authorHandle: string;
  name: string;
  description?: string;
  setup: 'auto_indoor' | 'auto_outdoor' | 'photo_indoor' | 'photo_outdoor';
  locale: string;
  license: string;
  steps: any[];
  phaseOrder: string[];
  totalWeeks?: number;
  taskCount: number;
  adoptionCount: number;
  ratingAverage?: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export class TemplateSharingService {
  constructor(
    private supabase: SupabaseClient,
    private analytics: AnalyticsClient
  ) {}

  /**
   * Shares a playbook as a community template
   *
   * @param options - Sharing options including playbook and metadata
   * @returns The created community template
   */
  async shareTemplate(
    options: ShareTemplateOptions
  ): Promise<CommunityTemplate> {
    const {
      playbook,
      authorHandle,
      description,
      license,
      isPublic = true,
    } = options;

    // Validate playbook before sharing
    const validation = validatePlaybookForSharing(playbook);
    if (!validation.valid) {
      throw new Error(
        `Playbook validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Sanitize playbook to remove PII
    const sanitized = sanitizePlaybookForSharing(playbook, authorHandle);

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to share templates');
    }

    // Insert template into database
    const { data, error } = await this.supabase
      .from('community_playbook_templates')
      .insert({
        author_id: user.id,
        author_handle: authorHandle,
        name: sanitized.name,
        description: description || null,
        setup: sanitized.setup,
        locale: sanitized.locale,
        license: license || 'CC-BY-SA',
        steps: sanitized.steps,
        phase_order: sanitized.phaseOrder,
        total_weeks: sanitized.totalWeeks,
        task_count: sanitized.taskCount,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to share template: ${error.message}`);
    }

    // Track analytics event
    await this.analytics.track('playbook_saved_as_template', {
      playbookId: playbook.id,
      templateName: sanitized.name,
      isPublic,
    });

    return this.mapToTemplate(data);
  }

  /**
   * Gets a community template by ID
   */
  async getTemplate(templateId: string): Promise<CommunityTemplate | null> {
    const { data, error } = await this.supabase
      .from('community_playbook_templates')
      .select('*')
      .eq('id', templateId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToTemplate(data);
  }

  /**
   * Lists community templates with filtering and pagination
   */
  async listTemplates(options?: {
    setup?: string;
    locale?: string;
    sortBy?: 'created_at' | 'rating_average' | 'adoption_count';
    limit?: number;
    offset?: number;
  }): Promise<{ templates: CommunityTemplate[]; total: number }> {
    const {
      setup,
      locale,
      sortBy = 'created_at',
      limit = 20,
      offset = 0,
    } = options || {};

    let query = this.supabase
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
      throw new Error(`Failed to list templates: ${error.message}`);
    }

    return {
      templates: (data || []).map((t) => this.mapToTemplate(t)),
      total: count || 0,
    };
  }

  /**
   * Deletes a template (soft delete)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to delete templates');
    }

    const { error } = await this.supabase
      .from('community_playbook_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', templateId)
      .eq('author_id', user.id);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Updates a template
   */
  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string;
    }
  ): Promise<CommunityTemplate> {
    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to update templates');
    }

    const { data, error } = await this.supabase
      .from('community_playbook_templates')
      .update(updates)
      .eq('id', templateId)
      .eq('author_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return this.mapToTemplate(data);
  }

  /**
   * Maps database row to CommunityTemplate
   */
  private mapToTemplate(data: any): CommunityTemplate {
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
  }
}
